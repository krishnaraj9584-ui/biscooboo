const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(express.json());

app.use(cors({
  origin: [
    "https://biscooboocookies.in",
    "https://www.biscooboocookies.in"
  ],
  credentials: true
}));

app.get("/", (req, res) => {
  res.json({
    message: "Backend Running"
  });
});

app.post("/create-order", async (req, res) => {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const { amount } = req.body;

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: "receipt_" + Date.now()
    });

    res.json(order);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.post("/verify-payment", (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    const body =
      razorpay_order_id + "|" + razorpay_payment_id;

    const expected = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET
      )
      .update(body)
      .digest("hex");

    if (expected === razorpay_signature) {
      return res.json({ success: true });
    }

    return res.status(400).json({
      success: false
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
});

module.exports = app;
