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
 * Add product to customer's personal collection
 * Body: { customerId, productId, collectionId, variantId, source, shop }
 */
app.post('/add-to-collection', async (req, res) => {
  const { customerId, productId, collectionId, source, shop } = req.body || {};

  console.log('--- Add to collection request ---');
  console.log('Customer:', customerId);
  console.log('Product:', productId);
  console.log('Collection:', collectionId);
  console.log('Source:', source);
  console.log('Shop from body:', shop);
  console.log('---------------------------------');

  if (!productId || !collectionId) {
    return res.status(400).json({
      success: false,
      error: 'Missing productId or collectionId'
    });
  }

  try {
    // Brug env hvis sat, ellers shop fra body
    const shopDomain = process.env.SHOPIFY_SHOP || shop;
    const adminToken = process.env.SHOPIFY_ADMIN_TOKEN;

    if (!shopDomain || !adminToken) {
      console.error('Missing SHOPIFY_SHOP or SHOPIFY_ADMIN_TOKEN env');
      return res.status(500).json({
        success: false,
        error: 'Server misconfigured (no Shopify credentials)'
      });
    }

    const url = `https://${shopDomain}/admin/api/2024-01/collects.json`;

    const payload = {
      collect: {
        product_id: Number(productId),
        collection_id: Number(collectionId)
      }
    };

    console.log('Calling Shopify:', url, payload);

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

    console.log('Shopify response status:', resp.status);
    console.log('Shopify response body:', json);

    if (!resp.ok) {
      return res.status(500).json({
        success: false,
        error: 'Shopify API error',
        details: json
      });
    }

    return res.json({
      success: true,
      message: 'Product added to collection',
      shopify: json
    });
  } catch (err) {
    console.error('Server error in /add-to-collection:', err);
    return res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`TT collection service listening on port ${PORT}`);
});
