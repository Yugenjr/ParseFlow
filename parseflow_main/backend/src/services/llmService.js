const axios = require("axios");

const GROQ_API_KEY = process.env.GROQ_API_KEY;

const SYSTEM_PROMPT = `You are an intelligent document classification and organization engine for a system called ParseFlow.

Your task is to analyze OCR-extracted text from uploaded documents and return a STRICT JSON response.

You MUST NOT generate explanations. You MUST ONLY return valid JSON.

OBJECTIVE:
1. Identify the document type based on content.
2. Extract important metadata fields.
3. Assign the correct storage category.
4. Suggest a folder name for storage.
5. Provide a confidence score based on clarity of text.

SUPPORTED DOCUMENT TYPES:
Aadhaar Card, PAN Card, Passport, Driving License, Bank Statement, Invoice, Receipt, Tax Document, Legal Agreement, Business Registration, Unknown

STORAGE CATEGORIES:
Identity, Financial, Legal, Tax, Business, Other

FOLDER NAMING RULE:
Return a clean folder name in this format: <category>/<document_type> (e.g., Identity/Aadhaar_Card)

KEY FIELD EXTRACTION (PRIORITY RULES):
- Aadhaar: 12-digit numeric (may contain spaces). Example: 1234 5678 9123 or 123456789123
- PAN: 10-character alphanumeric, typically pattern: 5 letters + 4 digits + 1 letter (e.g., ABCDE1234F)
- Passport: ~8 character alphanumeric (e.g., A1234567)
- Driving License: country-specific formats; extract any contiguous alphanumeric token that looks like a DL number (5-20 chars)

Extract ONLY if available: name, id_number, date_of_birth, document_number, issuing_authority

CONFIDENCE LOGIC:
High (0.8–1.0): Clear structured document (IDs, headers, numbers)
Medium (0.5–0.79): Partial or noisy text
Low (<0.5): Unclear or insufficient data

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "document_type": "",
  "category": "",
  "folder": "",
  "confidence": 0.0,
  "key_fields": {
    "name": null,
    "id_number": null,
    "date_of_birth": null,
    "document_number": null,
    "issuing_authority": null
  }
}

RULES:
* NEVER return text outside JSON.
* NEVER hallucinate fields — if a field is not present, set it to null.
* NEVER invent document types outside the supported list.
* If unsure → document_type = "Unknown", category = "Other".

ADDITIONAL INSTRUCTION:
If you detect a clear ID number (Aadhaar/PAN/Passport/DL) populate \`key_fields.id_number\` with the detected value. Do not include any explanatory text.
`;

async function analyzeWithLLM(text) {
  try {
    const payload = {
      model: "llama3-70b-8192",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.2
    };

    // DEBUG: log payload size and first chars (avoid logging very large text)
    try {
      console.log('LLM payload size:', String(JSON.stringify(payload).length));
      console.log('LLM payload preview:', String(JSON.stringify(payload)).slice(0, 1000));
    } catch (e) {
      // ignore
    }

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      payload,
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    const output = response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message && response.data.choices[0].message.content;

    try {
      return JSON.parse(output);
    } catch (err) {
      console.error('LLM parse error:', err && err.message, 'raw output:', output);
      // Fall back to heuristic parsing if LLM returned non-JSON
      return heuristicParse(text);
    }

  } catch (err) {
    // Log full provider response when available
    try {
      if (err && err.response) {
        console.error('LLM ERROR status:', err.response.status);
        console.error('LLM ERROR data:', JSON.stringify(err.response.data));
      } else {
        console.error('LLM ERROR:', err.message || err);
      }
    } catch (e) {
      console.error('LLM ERROR (fallback):', err);
    }
    // If request failed, fall back to local heuristic parser
    try {
      return heuristicParse(text);
    } catch (e) {
      return {
        document_type: "Unknown",
        category: "Other",
        confidence: 0,
        key_fields: {}
      };
    }
  }
}

function heuristicParse(text) {
  const t = String(text || '');
  const result = {
    document_type: 'Unknown',
    category: 'Other',
    folder: 'Other/Unknown',
    confidence: 0.0,
    key_fields: {
      name: null,
      id_number: null,
      date_of_birth: null,
      document_number: null,
      issuing_authority: null
    }
  };

  // Aadhaar: 12 digits (allow spaces)
  const aad = t.match(/(\d{4}\s?\d{4}\s?\d{4})/);
  if (aad) {
    const id = aad[1].replace(/\s/g, '');
    result.document_type = 'Aadhaar Card';
    result.category = 'Identity';
    result.folder = 'Identity/Aadhaar_Card';
    result.key_fields.id_number = id;
    result.confidence = 0.75;
    return result;
  }

  // PAN: 5 letters + 4 digits + 1 letter
  const pan = t.match(/\b([A-Za-z]{5}[0-9]{4}[A-Za-z])\b/);
  if (pan) {
    result.document_type = 'PAN Card';
    result.category = 'Identity';
    result.folder = 'Identity/PAN_Card';
    result.key_fields.id_number = pan[1].toUpperCase();
    result.confidence = 0.8;
    return result;
  }

  // Passport: 8 alnum
  const pass = t.match(/\b([A-Za-z][0-9A-Za-z]{7})\b/);
  if (pass) {
    result.document_type = 'Passport';
    result.category = 'Identity';
    result.folder = 'Identity/Passport';
    result.key_fields.id_number = pass[1].toUpperCase();
    result.confidence = 0.7;
    return result;
  }

  // Driving license heuristic: look for DOB and 'License' or 'DL' keywords
  if (/\b(DL|Driving|License|Licence)\b/i.test(t) || /Date of Birth|DOB/i.test(t)) {
    // try to find an alphanumeric token 5-20 chars
    const dl = t.match(/\b([A-Za-z0-9]{5,20})\b/);
    if (dl) result.key_fields.id_number = dl[1];
    result.document_type = 'Driving License';
    result.category = 'Identity';
    result.folder = 'Identity/Driving_License';
    result.confidence = 0.6;
    return result;
  }

  // Fallback: look for keywords for Financial docs
  if (/Invoice|INVOICE|Total|Amount payable|Account No|Bank Statement|Statement/i.test(t)) {
    result.document_type = 'Invoice';
    result.category = 'Financial';
    result.folder = 'Financial/Invoice';
    result.confidence = 0.55;
    return result;
  }

  // Default unknown
  return result;
}

module.exports = { analyzeWithLLM };
