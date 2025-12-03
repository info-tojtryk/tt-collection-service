const express = require('express');
const cors = require('cors'); // NYT

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * CORS – giv kun adgang fra din shop
 * Justér domæner hvis du også bruger .myshopify.com præview
 */
app.use(cors({
  origin: [
    'https://tojtryk.dk',
    'https://www.tojtryk.dk'
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Middleware til JSON
app.use(express.json());

// Health-check
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
    message: 'Request received on collection service'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`TT collection service listening on port ${PORT}`);
});
