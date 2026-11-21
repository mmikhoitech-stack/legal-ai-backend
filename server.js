const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 10000;

// Allow your frontend to talk to this backend
app.use(cors());
app.use(express.json());

// Health Check
app.get('/', (req, res) => {
  res.send("Backend is Live and Running!");
});

// 🚀 THE SECURE EMAIL ROUTE
app.post('/api/secure-email/send', (req, res) => {
  const { to, subject, message } = req.body || {};
  
  console.log(`[SUCCESS] Email received for: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Message: ${message}`);

  // Send success back to frontend
  return res.status(200).json({ 
    ok: true, 
    message: "Email sent successfully (Mock)" 
  });
});

// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});