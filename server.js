const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const OpenAI = require('openai');

const app = express();

// ALLOW ALL ORIGINS FOR TESTING (You can lock this down later)
app.use(cors({ origin: '*' }));
app.use(express.json());

// DeepSeek Setup
const deepseek = new OpenAI({
  // This pulls the key from Render's environment variables
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});

// Set up multer for file uploads (storing in memory)
const upload = multer({ storage: multer.memoryStorage() });

// The Drafting Endpoint
app.post('/api/agents/email-draft', upload.single('attachment'), async (req, res) => {
  try {
    const emailText = req.body.emailText || "";
    const attachment = req.file;
    let attachmentText = "";

    // 1. Process the attachment if one was uploaded
    if (attachment) {
      if (attachment.mimetype === 'application/pdf') {
        const pdfData = await pdfParse(attachment.buffer);
        attachmentText = pdfData.text;
      } else if (
        attachment.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        attachment.mimetype === 'application/msword'
      ) {
        const docxData = await mammoth.extractRawText({ buffer: attachment.buffer });
        attachmentText = docxData.value;
      }
    }

    // 2. Set up the system prompt for the AI
    const systemPrompt = `You are an expert South African legal assistant. 
    Draft a professional reply to the incoming email. 
    If attachment text is provided, analyze it and incorporate relevant details.
    Ensure the tone is formal, clear, and POPIA compliant.
    Do not invent facts. If information is missing, politely ask for it.`;

    // 3. Combine the email and attachment text for the AI
    let userPrompt = `Incoming Email:\n${emailText}\n\n`;
    if (attachmentText) {
      userPrompt += `Attachment Content:\n${attachmentText}\n\n`;
    }
    userPrompt += `Please draft a reply.`;

    // 4. Call the DeepSeek API
    const completion = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2, // Lower temperature for more focused, legal-style drafting
    });

    const draftReply = completion.choices[0].message.content;

    // 5. Send the result back to the frontend
    res.json({ draftReply: draftReply });

  } catch (error) {
    console.error("Error generating draft:", error);
    res.status(500).json({ error: "Failed to generate draft. Please check server logs." });
  }
});

// Health check route
app.get('/', (req, res) => {
  res.send('SA Law AI Backend is running.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});