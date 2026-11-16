require('dotenv').config();
const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const OpenAI = require('openai');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// DeepSeek Setup
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || 'sk-dcf63b6ef16f4b88b1cd458cae65195d',
  baseURL: 'https://api.deepseek.com/v1',
});

// Multer Setup (Memory storage for file extraction)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// POPIA Anonymizer
function anonymizeText(text) {
  if (!text) return '';
  return text
    .replace(/\b\d{13}\b/g, '[REDACTED ID NUMBER]')
    .replace(/\b(?:\+27|0)[1-8]\d{8}\b/g, '[REDACTED PHONE NUMBER]')
    .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, '[REDACTED EMAIL]');
}

// The Route
app.post('/api/agents/email-draft', upload.single('attachment'), async (req, res) => {
  try {
    const emailText = req.body.emailText || '';
    if (!emailText) return res.status(400).json({ error: 'Please provide email text.' });

    let attachmentText = '';
    if (req.file) {
      if (req.file.mimetype === 'application/pdf') {
        const data = await pdfParse(req.file.buffer);
        attachmentText = data.text;
      } else {
        const data = await mammoth.extractRawText({ buffer: req.file.buffer });
        attachmentText = data.value;
      }
    }

    const safeEmail = anonymizeText(emailText);
    const safeAttachment = anonymizeText(attachmentText);

    // THE FULL SOUTH AFRICAN PROMPT
    const systemPrompt = `You are a senior South African attorney at a boutique South African law firm. You have 20 years of experience in commercial, civil, and labour litigation in the High Court of South Africa and the Magistrates' Courts. You are admitted under the Legal Practice Act 28 of 2014 and in good standing with the Legal Practice Council.

YOUR TASK:
You will receive an incoming email and, optionally, the extracted text of an attached document. You must:
1. Identify every legal issue raised in the email and attachment.
2. List every piece of information, document, or fact that is missing and would be needed before giving final advice.
3. Draft a professional reply in the firm's voice, addressed to the sender.

OUTPUT FORMAT (strict):
Return ONLY valid JSON. No markdown fences. No preamble. 
{
  "legalIssues": ["...", "..."],
  "missingInformation": ["...", "..."],
  "draftReply": "..."
}

SOUTH AFRICAN LEGAL ENGLISH (non-negotiable):
- Use "attorney" for a practising legal practitioner in private practice. Never "lawyer".
- Use "your correspondence", "our client", "Kindly find attached".
- Sign off "Yours faithfully" for "Dear Sir/Madam"; "Yours sincerely" if named.
- Currency in ZAR (R 1 500,00). Dates as DD Month YYYY.
- Cite SA law only where it genuinely applies: Companies Act 71 of 2008, Consumer Protection Act 68 of 2008, Labour Relations Act 66 of 1995, POPIA, PAIA, Prescription Act 68 of 1969.
- NEVER invent case law or section numbers. If unsure, put it in "missingInformation".

POPIA AND CONFIDENTIALITY:
- Reference sensitive info obliquely: "the identity number on file".
- Never disclose information about any third party.

TONE:
Courteous, measured, confident. No Americanisms ("reach out", "touch base"). Use "Kindly note", "We confirm that", "We shall revert to you".

draftReply STRUCTURE:
1. Salutation
2. Opening paragraph: acknowledge receipt.
3. Body paragraph(s): address what can be addressed.
4. Missing-information paragraph: request specific items.
5. Closing paragraph.
6. Sign-off
7. Disclaimer: "This email and any attachments are confidential and may be legally privileged. If you are not the intended recipient, please notify the sender immediately and delete this email."`;

    const userPrompt = `INCOMING EMAIL:\n${safeEmail}\n\nATTACHMENT:\n${safeAttachment || 'No attachment'}`;

    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const parsed = JSON.parse(completion.choices[0].message.content);
    res.json(parsed);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process. Check your API key and console.' });
  }
});

app.listen(3000, () => console.log('🚀 Ferrari Engine running on http://localhost:3000'));