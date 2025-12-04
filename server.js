// I din server.js, opdater /add-to-collection ruten:

app.post('/add-to-collection', async (req, res) => {
  // ... (variabel definitioner og credentials tjek forbliver de samme) ...
  const { productId, collectionId, source, shop } = req.body || {};
  // ... (logs og missing ID tjek forbliver de samme) ...
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

    console.log('Shopify response status:', resp.status);
    console.log('Shopify response body:', json);

    if (!resp.ok) {
        // --- VIGTIG NY FEJLHÅNDTERING HER ---
        const errorDetails = json.errors || json.details;
        if (resp.status === 422 && JSON.stringify(errorDetails).includes('already exists')) {
            console.log('Produktet er allerede i kollektionen, returnerer success alligevel.');
            return res.json({ 
                success: true, 
                message: 'Product already existed in collection',
                shopify: json
            });
        }
        // --- Slut på ny fejlhåndtering ---

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
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});
