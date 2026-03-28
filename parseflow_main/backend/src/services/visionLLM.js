const axios = require("axios");
const fs = require("fs");

const GROQ_API_KEY = process.env.GROQ_API_KEY;

const SYSTEM_PROMPT = `You are an intelligent multimodal document classification and extraction engine for a system called ParseFlow.

Return STRICT JSON only. Do NOT add prose or explanation.

OBJECTIVE:
1. Perform OCR on the provided image.
2. Return full extracted text from OCR in an "extracted_text" field.
3. Identify the specific document type in "document_type" (examples: Aadhaar Card, PAN Card, Passport, Driving License, GSTR 3B, GST Return, Form 16, ITR Acknowledgment, Bank Statement, Invoice, Receipt, Legal Agreement, Business Registration, Coding Notes, Class Notes, Unknown).
3. Extract key fields when present (name, id_number, date_of_birth, document_number, issuing_authority).
4. Assign storage category in "category" using ONLY one of: Identity, Financial, Legal, Compliance, Tax, Business, Other.
5. IMPORTANT: category must be broad taxonomy (example: if document_type is "GSTR 3B", category must be "Tax").
6. Suggest folder as Category/Document_Type.
7. If the document is any compliance artifact (for example: certificate of compliance, conformity certificate, ISO compliance certificate, CSA/FCC/CE compliance records, regulatory compliance forms), category MUST be "Compliance" and folder MUST start with "Compliance/".
8. Provide both "confidence" and "accuracy" as percentage between 0 and 100 (integer preferred). "accuracy" must represent this Vision analysis confidence.
9. If content does NOT clearly fit Identity/Financial/Legal/Compliance/Tax/Business, set category to "Other" and keep a meaningful alternate name in "document_type" (example: "Coding Notes", "Study Notes", "General Notes").

RULES:
- NEVER return text outside JSON.
- NEVER hallucinate fields — if missing set to null.
- If unreadable or fully ambiguous -> document_type = "Unknown", category = "Other".

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "extracted_text": "",
  "document_type": "",
  "category": "",
  "folder": "",
  "accuracy": 0,
  "confidence": 0,
  "key_fields": {
    "name": null,
    "id_number": null,
    "date_of_birth": null,
    "document_number": null,
    "issuing_authority": null
  }
}
`;

function normalizeConfidencePercent(value) {
  if (value === null || value === undefined) return 0;

  let num = value;
  if (typeof num === 'string') {
    const cleaned = num.replace('%', '').trim();
    num = Number(cleaned);
  }

  if (!Number.isFinite(num)) return 0;

  // Convert 0..1 fractions into 0..100 percentages.
  if (num > 0 && num <= 1) {
    num = num * 100;
  }

  if (num < 0) return 0;
  if (num > 100) return 100;
  return Math.round(num);
}

async function analyzeImageWithLLM(filePath) {
  try {
    const imageBase64 = fs.readFileSync(filePath, { encoding: "base64" });

    const payload = {
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this document image and return JSON." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
          ]
        }
      ],
      temperature: 0.2
    };

    // Debug: small preview
    try {
      console.log('Vision LLM payload size:', String(JSON.stringify(payload).length));
    } catch (e) {}

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      payload,
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 60000
      }
    );

    let output = null;
    try {
      output = response.data.choices[0].message.content;
      if (typeof output === 'string') output = output.trim();
    } catch (e) {
      console.error('Vision LLM: unexpected response shape', e);
      throw new Error('Vision LLM invalid response');
    }

    // Extract JSON substring safely
    if (typeof output === 'string') {
      const start = output.indexOf('{');
      const end = output.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        const jsonStr = output.slice(start, end + 1);
        try {
          const parsed = JSON.parse(jsonStr);
          parsed.extracted_text = typeof parsed.extracted_text === 'string' ? parsed.extracted_text : '';
          parsed.accuracy = normalizeConfidencePercent(parsed.accuracy ?? parsed.confidence);
          parsed.confidence = normalizeConfidencePercent(parsed.confidence);
          if (!parsed.confidence && parsed.accuracy) {
            parsed.confidence = parsed.accuracy;
          }
          return parsed;
        } catch (e) {
          console.error('Vision LLM JSON parse error:', e.message);
        }
      }
    }

    // If provider returned structured object already
    if (typeof output === 'object') {
      output.extracted_text = typeof output.extracted_text === 'string' ? output.extracted_text : '';
      output.accuracy = normalizeConfidencePercent(output.accuracy ?? output.confidence);
      output.confidence = normalizeConfidencePercent(output.confidence);
      if (!output.confidence && output.accuracy) {
        output.confidence = output.accuracy;
      }
      return output;
    }

    // Fallback
    return {
      extracted_text: '',
      document_type: 'Unknown',
      category: 'Other',
      folder: 'Other/Unknown',
      accuracy: 0,
      confidence: 0,
      key_fields: {
        name: null,
        id_number: null,
        date_of_birth: null,
        document_number: null,
        issuing_authority: null
      }
    };

  } catch (err) {
    try {
      console.error('VISION LLM ERROR:', err.response?.status, err.response?.data || err.message || err);
    } catch (e) {
      console.error('VISION LLM ERROR fallback:', err.message || err);
    }
    return {
      extracted_text: '',
      document_type: 'Unknown',
      category: 'Other',
      folder: 'Other/Unknown',
      accuracy: 0,
      confidence: 0,
      key_fields: {
        name: null,
        id_number: null,
        date_of_birth: null,
        document_number: null,
        issuing_authority: null
      }
    };
  }
}

module.exports = { analyzeImageWithLLM };
