const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const cors = require('cors');
require('dotenv').config();

const app = express();

// CORS and preflight handling must run before API routes.
app.use(cors());
app.options(/.*/, cors());
app.use(express.json());

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

const razorpay = keyId && keySecret
  ? new Razorpay({ key_id: keyId, key_secret: keySecret })
  : null;

if (!razorpay) {
  console.error('Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET environment variable.');
}

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    razorpayConfigured: Boolean(razorpay),
    timestamp: new Date().toISOString()
  });
});

app.post('/create-order', async (req, res) => {
  try {
    if (!razorpay) {
      return res.status(500).json({
        error: 'Razorpay is not configured. Check backend Vercel environment variables.'
      });
    }

    const { amount, currency = 'INR', receipt } = req.body || {};

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        error: 'Invalid amount. Amount must be a positive number in paise.'
      });
    }

    if (amount < 100) {
      return res.status(400).json({ error: 'Minimum order amount is 100 paise (₹1).' });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount),
      currency,
      receipt: receipt || `receipt_${Date.now()}`
    });

    return res.json(order);
  } catch (error) {
    console.error('Order creation error:', error);
    if (error.statusCode === 401) {
      return res.status(401).json({
        error: 'Razorpay authentication failed. Check backend credentials.'
      });
    }
    return res.status(500).json({ error: error.message || 'Failed to create order.' });
  }
});

app.post('/verify-payment', (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        verified: false,
        error: 'Missing razorpay_order_id, razorpay_payment_id, or razorpay_signature.'
      });
    }

    if (!keySecret) {
      return res.status(500).json({ verified: false, error: 'Razorpay is not configured.' });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto.createHmac('sha256', keySecret).update(body).digest('hex');
    const expected = Buffer.from(expectedSignature, 'utf8');
    const received = Buffer.from(razorpay_signature, 'utf8');
    const valid = expected.length === received.length && crypto.timingSafeEqual(expected, received);

    if (!valid) {
      return res.status(400).json({
        verified: false,
        message: 'Payment signature verification failed.'
      });
    }

    return res.json({
      verified: true,
      message: 'Payment signature verified.',
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    return res.status(500).json({ verified: false, error: 'Failed to verify payment.' });
  }
});

// Placeholder only; connect an email provider to send actual emails.
app.post('/send-order-email', (req, res) => {
  const { email, subject } = req.body || {};
  console.log(`Email endpoint called for ${email || '(no email)'}; subject: ${subject || '(none)'}`);
  return res.json({ success: true, message: 'Email functionality is not configured yet.' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Biscooboo backend running on port ${PORT}`));
}
