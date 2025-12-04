const express = require('express');
const cors = require('cors');

const app = express(); // <--- Denne linje manglede i de partielle opdateringer
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
  if (!productId || !collectionId) {
    return res.status(400).json({ success: false, error: 'Missing productId or collectionId' });
  }

  const credentials = getShopifyCredentials(shop);
  if (!credentials) {
    return res.status(500).json({ success: false, error: 'Server misconfigured' });
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

    if (!resp.ok) {
        // Håndtering af "already exists" fejl
        const errorDetails = json.errors || json.details;
        if (resp.status === 422 && JSON.stringify(errorDetails).includes('already exists')) {
            return res.json({ success: true, message: 'Product already existed in collection', shopify: json });
        }
        return res.status(500).json({ success: false, error: 'Shopify API error', details: json });
    }

    return res.json({ success: true, message: 'Product added to collection', shopify: json });

  } catch (err) {
    console.error('Server error in /add-to-collection:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

/**
 * RUTE: Remove product from customer's personal collection
 * Body: { customerId, productId, collectionId, shop }
 */
app.post('/remove-from-collection', async (req, res) => {
    const { productId, collectionId, shop } = req.body || {};
    if (!productId || !collectionId) return res.status(400).json({ success: false, error: 'Missing IDs' });
    const credentials = getShopifyCredentials(shop);
    if (!credentials) return res.status(500).json({ success: false, error: 'Server misconfigured' });
    const { shopDomain, adminToken } = credentials;

    try {
        const searchUrl = `https://${shopDomain}/admin/api/2024-01/collects.json?product_id=${productId}&collection_id=${collectionId}`;
        const searchResp = await fetch(searchUrl, { method: 'GET', headers: { 'X-Shopify-Access-Token': adminToken } });
        const searchJson = await searchResp.json();
        
        if (!searchJson.collects || searchJson.collects.length === 0) {
            return res.status(404).json({ success: false, error: 'Product not found in collection' });
        }
        
        const collectId = searchJson.collects[0].id; // Korrekt brug af array index 0
        const deleteUrl = `https://${shopDomain}/admin/api/2024-01/collects/${collectId}.json`;

        const deleteResp = await fetch(deleteUrl, { method: 'DELETE', headers: { 'X-Shopify-Access-Token': adminToken } });

        if (!deleteResp.ok) {
             const errorText = await deleteResp.text();
            return res.status(500).json({ success: false, error: 'Shopify API error during deletion', details: errorText });
        }

        return res.json({ success: true, message: 'Product removed from collection' });

    } catch (err) {
        console.error('Server error in /remove-from-collection:', err);
        return res.status(500).json({ success: false, error: 'Server error' });
    }
});


/**
 * RUTE: Assign product/variant to an employee (via metafields på varianten)
 * Body: { productId, variantId, employeeName, shop }
 */
app.post('/assign-to-employee', async (req, res) => {
    const { productId, variantId, employeeName, shop } = req.body || {};

    console.log('--- Assign to Employee request ---');
    if (!productId || !variantId || !employeeName) {
        return res.status(400).json({ success: false, error: 'Missing productId, variantId, or employeeName' });
    }

    const credentials = getShopifyCredentials(shop);
    if (!credentials) {
        return res.status(500).json({ success: false, error: 'Server misconfigured' });
    }
    const { shopDomain, adminToken } = credentials;

    try {
        const metafieldUrl = `https://${shopDomain}/admin/api/2024-01/variants/${variantId}/metafields.json`;
        
        const metafieldPayload = {
            metafield: {
                namespace: "custom", 
                key: "assigned_employee", 
                value: employeeName,
                type: "single_line_text_field"
            }
        };

        const resp = await fetch(metafieldUrl, {
            method: 'POST',
            headers: {
                'X-Shopify-Access-Token': adminToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metafieldPayload)
        });

        if (!resp.ok) {
            const errorDetails = await resp.text();
            console.error("Shopify Metafield API Error:", errorDetails);
            return res.status(500).json({ success: false, error: 'Failed to assign employee via metafield', details: errorDetails });
        }

        return res.json({ success: true, message: `Variant ${variantId} assigned to ${employeeName}` });

    } catch (err) {
        console.error('Server error in /assign-to-employee:', err);
        return res.status(500).json({ success: false, error: 'Server error' });
    }
});


// Start server
app.listen(PORT, () => {
  console.log(`TT collection service listening on port ${PORT}`);
});
