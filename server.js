// server.js
const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;

// Middleware til JSON
app.use(express.json());

// Health-check route
app.get('/', (req, res) => {
  res.send('TT collection service is running');
});

/**
 * Dummy endpoint som modtager "tilføj til kollektion"-requests
 * Body: { customerId, productId, variantId, source }
 */
app.post('/add-to-collection', (req, res) => {
  const { customerId, productId, variantId, source } = req.body || {};

  console.log('--- Add to collection request ---');
  console.log('Customer:', customerId);
  console.log('Product:', productId);
  console.log('Variant:', variantId);
  console.log('Source:', source);
  console.log('---------------------------------');

  res.json({
    ok: true,
    message: 'Request received on collection service',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`TT collection service listening on port ${PORT}`);
});
