const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Validate environment variables
if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error('❌ ERROR: Missing Razorpay credentials in .env file');
  console.error('Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
  process.exit(1);
}

// Initialize Razorpay
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

console.log('✅ Razorpay initialized with Key ID:', process.env.RAZORPAY_KEY_ID.substring(0, 10) + '...');

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ✅ Create Razorpay Order
app.post('/create-order', async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt } = req.body;

    // Validate input
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount. Must be a positive number.' });
    }

    // Razorpay minimum amount is 100 paise (₹1)
    if (amount < 100) {
      return res.status(400).json({ error: 'Minimum order amount is 100 paise (₹1)' });
    }

    console.log(`Creating order: ${amount} paise, currency: ${currency}`);

    const order = await razorpayInstance.orders.create({
      amount: Math.round(amount), // in paise
      currency: currency,
      receipt: receipt || `receipt_${Date.now()}`,
    });

    console.log(`✅ Order created:`, order.id);
    res.json(order);
  } catch (error) {
    console.error('❌ Order creation error:', error.message);
    
    // Handle Razorpay-specific errors
    if (error.statusCode === 401) {
      return res.status(401).json({ error: 'Razorpay authentication failed. Check your credentials.' });
    }

    res.status(500).json({ 
      error: error.message || 'Failed to create order',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ✅ Verify Razorpay Payment Signature
app.post('/verify-payment', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Validate input
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      const missing = [];
      if (!razorpay_order_id) missing.push('razorpay_order_id');
      if (!razorpay_payment_id) missing.push('razorpay_payment_id');
      if (!razorpay_signature) missing.push('razorpay_signature');
      
      console.warn('❌ Verification failed - Missing fields:', missing);
      return res.status(400).json({ 
        verified: false,
        error: `Missing required fields: ${missing.join(', ')}`
      });
    }

    // Recreate signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    console.log(`Verifying payment: Order ${razorpay_order_id}, Payment ${razorpay_payment_id}`);

    // Compare signatures
    if (expectedSignature === razorpay_signature) {
      console.log(`✅ Payment verified successfully`);
      res.json({ 
        verified: true, 
        message: 'Payment signature verified',
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id
      });
    } else {
      console.warn('❌ Signature mismatch detected - potential fraud attempt');
      res.status(400).json({ 
        verified: false, 
        message: 'Payment signature verification failed'
      });
    }
  } catch (error) {
    console.error('❌ Payment verification error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to verify payment',
      message: 'Internal server error'
    });
  }
});

// ✅ Send Order Email (optional)
app.post('/send-order-email', async (req, res) => {
  try {
    const { email, subject, message } = req.body;

    // TODO: Integrate with your email service (SendGrid, Nodemailer, etc.)
    console.log(`Email would be sent to ${email} with subject: ${subject}`);

    res.json({ 
      success: true, 
      message: 'Email functionality to be implemented',
      email,
      subject
    });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Export the Express app for Vercel serverless functions.
// Keep app.listen only for local development / traditional Node hosting.
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Biscooboo backend server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
