const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS – åbn for alle domæner (kan strammes op senere)
app.use(cors());

// Middleware til JSON
app.use(express.json());

// Health-check
app.get('/', (req, res) => {
  res.send('TT collection service is running');
});

/**
 * Hjælpefunktion til at hente Shopify-legitimationsoplysninger
 */
function getShopifyCredentials(shop) {
  const shopDomain = process.env.SHOPIFY_SHOP || shop;
  const adminToken = process.env.SHOPIFY_ADMIN_TOKEN;

  if (!shopDomain || !adminToken) {
    console.error('Missing SHOPIFY_SHOP or SHOPIFY_ADMIN_TOKEN env');
    return null;
  }
  return { shopDomain, adminToken };
}

/**
 * Add product to customer's personal collection
 * Body: { customerId, productId, collectionId, variantId, source, shop }
 */
app.post('/add-to-collection', async (req, res) => {
  const { productId, collectionId, source, shop } = req.body || {};

  console.log('--- Add to collection request ---');
  // ... (logs forbliver de samme) ...

  if (!productId || !collectionId) {
    return res.status(400).json({ success: false, error: 'Missing productId or collectionId' });
  }

  const credentials = getShopifyCredentials(shop);
  if (!credentials) {
    return res.status(500).json({ success: false, error: 'Server misconfigured (no Shopify credentials)' });
  }
  const { shopDomain, adminToken } = credentials;

  try {
    const url = `https://${shopDomain}/admin/api/2024-01/collects.json`;

    const payload = {
      collect: {
        product_id: Number(productId),
        collection_id: Number(collectionId)
      }
    };

    // ... (fetch logik forbliver den samme) ...
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': adminToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const text = await resp.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      json = { raw: text };
    }

    // Håndter Shopify API fejl, f.eks. hvis produktet allerede er i kollektionen
    if (!resp.ok) {
        // Specifik fejlhåndtering for "already exists" hvis nødvendigt
        return res.status(500).json({
            success: false,
            error: 'Shopify API error',
            details: json
        });
    }

    return res.json({ success: true, message: 'Product added to collection', shopify: json });

  } catch (err) {
    console.error('Server error in /add-to-collection:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * NY RUTE: Remove product from customer's personal collection
 * Body: { customerId, productId, collectionId, shop }
 */
app.post('/remove-from-collection', async (req, res) => {
    const { productId, collectionId, shop } = req.body || {};

    console.log('--- Remove from collection request ---');
    console.log('Product:', productId);
    console.log('Collection:', collectionId);
    console.log('---------------------------------');

    if (!productId || !collectionId) {
        return res.status(400).json({ success: false, error: 'Missing productId or collectionId' });
    }

    const credentials = getShopifyCredentials(shop);
    if (!credentials) {
        return res.status(500).json({ success: false, error: 'Server misconfigured (no Shopify credentials)' });
    }
    const { shopDomain, adminToken } = credentials;

    try {
        // Først skal vi finde ID'et på "collect"-objektet, der forbinder produktet og kollektionen
        const searchUrl = `https://${shopDomain}/admin/api/2024-01/collects.json?product_id=${productId}&collection_id=${collectionId}`;

        const searchResp = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'X-Shopify-Access-Token': adminToken,
                'Accept': 'application/json'
            },
        });

        const searchJson = await searchResp.json();
        const collect = searchJson.collects[0]; // Får fat i det første (og eneste) match

        if (!collect || !collect.id) {
            console.log('Collect association not found, nothing to delete.');
            return res.status(404).json({ success: false, error: 'Product not found in collection' });
        }

        const collectId = collect.id;
        const deleteUrl = `https://${shopDomain}/admin/api/2024-01/collects/${collectId}.json`;

        // Nu sletter vi "collect"-objektet
        const deleteResp = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
                'X-Shopify-Access-Token': adminToken
            },
        });

        if (!deleteResp.ok) {
            return res.status(500).json({ success: false, error: 'Shopify API error during deletion' });
        }

        // Shopify DELETE returnerer ofte tom krop med 200/204 status
        return res.json({ success: true, message: 'Product removed from collection' });

    } catch (err) {
        console.error('Server error in /remove-from-collection:', err);
        return res.status(500).json({ success: false, error: 'Server error' });
    }
});


// Start server
app.listen(PORT, () => {
  console.log(`TT collection service listening on port ${PORT}`);
});
