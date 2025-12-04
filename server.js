const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * CORS – giv adgang fra både live-domæne og myshopify-preview
 */
app.use(cors({
  origin: [
    'https://tojtryk.dk',
    'https://www.tojtryk.dk',
    'https://tojtryk.myshopify.com'
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

  // VIGTIGT: svar med success: true (nemt at forstå i frontend)
  res.json({
    success: true,
    message: 'Request received on collection service'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`TT collection service listening on port ${PORT}`);
});
