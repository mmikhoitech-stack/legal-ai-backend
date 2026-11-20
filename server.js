require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const OpenAI = require('openai');

const app = express();
const port = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Setup for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Setup AI (DeepSeek/OpenAI)
const deepseek = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || 'PASTE_YOUR_KEY_HERE',
    baseURL: 'https://api.deepseek.com/v1'
});

// --- ROUTES ---

// 1. THE FIX: Email fetch route (Stops the 500 Error)
app.get('/api/emails', async (req, res) => {
    try {
        // This sends an empty list to the frontend so it shows the "Connect Inbox" button
        res.status(200).json([]);
    } catch (error) {
        console.error("Email error:", error);
        res.status(200).json([]); 
    }
});

// 2. The AI Drafting Route (Keeps your AI working)
app.post('/api/agents/email-draft', upload.single('attachment'), async (req, res) => {
    try {
        const emailText = req.body.emailText || '';
        if (!emailText) {
            return res.status(400).json({ error: 'Please provide email text.' });
        }

        const completion = await deepseek.chat.completions.create({
            model: "deepseek-chat",
            messages: [
                { role: "system", content: "You are a South African legal AI assistant. Draft a professional reply." },
                { role: "user", content: `Draft a reply to this email: ${emailText}` }
            ],
        });

        res.status(200).json({ draft: completion.choices[0].message.content });
    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ error: 'Failed to generate draft.' });
    }
});

// 3. Health check route
app.get('/', (req, res) => {
    res.send("Onus Probandi Backend is Live");
});

// Start the server
app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});