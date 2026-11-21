require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { randomUUID } = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 3000;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json({ limit: '256kb' }));

// --- AUTHENTICATION MIDDLEWARE ---
const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ ok: false, error: 'UNAUTHENTICATED', message: 'No token provided' });
  }
  req.user = { id: 'user_' + token.substring(0, 8) };
  next();
};

// --- RATE LIMITER (20 emails per 10 mins) ---
const emailLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, 
  max: 20,
  message: { ok: false, error: 'RATE_LIMITED', message: 'Too many emails sent. Try again in 10 minutes.' }
});

// --- MAIL TRANSPORT ---
const getTransporter = () => {
  if (!process.env.SMTP_HOST) {
    console.log("⚠️ No SMTP configured. Emails will be logged to console.");
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
};

// ==========================================
// YOUR EXISTING ROUTES
// ==========================================
app.post('/api/agents/email-draft', (req, res) => {
  res.json({ ok: true, message: "Draft generated" });
});

app.get('/', (req, res) => {
  res.send("Onus Probandi Backend is Live and Running");
});

// ==========================================
// 🚀 THE FIX: SECURE EMAIL SEND ROUTE
// ==========================================
app.post('/api/secure-email/send', requireAuth, emailLimiter, async (req, res) => {
  const { to = '', subject = '', message = '' } = req.body || {};
  
  const details = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) details.to = 'Invalid email address';
  if (!subject || subject.length > 200) details.subject = 'Subject must be 1-200 characters';
  if (!message || message.length > 20000) details.message = 'Message must be 1-20000 characters';
  
  if (Object.keys(details).length > 0) {
    return res.status(400).json({ ok: false, error: 'VALIDATION', details });
  }

  try {
    const reqId = randomUUID();
    console.log(`[SECURE EMAIL] Sending to: ${to} | Subject: ${subject}`);

    const transporter = getTransporter();
    
    if (transporter) {
      await transporter.sendMail({
        from: process.env.MAIL_FROM || '"Onus Probandi" <no-reply@onusprobandi.guru>',
        to: to,
        subject: subject,
        text: message,
      });
    } else {
      console.log("Mock Email Content:", message);
    }

    return res.status(200).json({ 
      ok: true, 
      id: reqId, 
      sentAt: new Date().toISOString() 
    });

  } catch (error) {
    console.error(`[SECURE EMAIL ERROR]`, error);
    return res.status(502).json({ 
      ok: false, 
      error: 'MAIL_TRANSPORT', 
      message: 'Failed to send email via mail server.' 
    });
  }
});

// --- START SERVER ---
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});