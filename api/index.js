const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const cors = require('cors');

const app = express();

app.use(express.json());

app.use(cors({
  origin: 'https://biscooboo.vercel.app',
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
}));

// Check environment variables
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error('Missing Razorpay credentials');
}

// Razorpay
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Biscooboo backend is running',
    timestamp: new Date().toISOString()
  });
});

// Create Razorpay order
app.post('/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt } = req.body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        error: 'Invalid amount'
      });
    }

    if (amount < 100) {
      return res.status(400).json({
        error: 'Minimum order amount is ₹1'
      });
    }

    console.log(`Creating Razorpay order: ${amount} paise`);

    const order = await razorpayInstance.orders.create({
      amount: Math.round(amount),
      currency,
      receipt: receipt || `receipt_${Date.now()}`
    });

    console.log(`Razorpay order created: ${order.id}`);

    return res.json(order);

  } catch (error) {
    console.error('Create order error:', error);

    return res.status(500).json({
      error: error.message || 'Failed to create Razorpay order'
    });
  }
});

// Verify payment
app.post('/verify-payment', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        verified: false,
        error: 'Missing payment verification fields'
      });
    }

    const body =
      razorpay_order_id + '|' + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac(
        'sha256',
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(body)
      .digest('hex');

    const verified =
      expectedSignature === razorpay_signature;

    if (!verified) {
      return res.status(400).json({
        verified: false,
        message: 'Payment signature verification failed'
      });
    }

    console.log('Payment verified:', razorpay_payment_id);

    return res.json({
      verified: true,
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id
    });

  } catch (error) {
    console.error('Payment verification error:', error);

    return res.status(500).json({
      verified: false,
      error: error.message
    });
  }
});

// Email endpoint
app.post('/send-order-email', async (req, res) => {
  try {
    const { email, subject, message } = req.body;

    console.log(
      `Email request received for ${email}`
    );

    // Email provider can be added later

    return res.json({
      success: true,
      message: 'Email request received',
      email,
      subject
    });

  } catch (error) {
    console.error('Email error:', error);

    return res.status(500).json({
      error: error.message
    });
  }
});

module.exports = app;
