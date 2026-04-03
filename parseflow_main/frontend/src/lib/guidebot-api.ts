const BACKEND_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export type GuideBotMessage = {
  role: "user" | "assistant";
  text: string;
};

const PII_PATTERNS: RegExp[] = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  /\b(?:\+?\d{1,3}[\s-]?)?(?:\d[\s-]?){10,13}\b/g,
  /\b[A-Z]{5}\d{4}[A-Z]\b/gi,
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  /\b\d{9,18}\b/g,
];

function redactPII(text: string): string {
  return PII_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, "[REDACTED]"), text);
}

function formatChatMessages(history: GuideBotMessage[]) {
  const trimmed = history.slice(-12);
  return trimmed.map((message) => ({
    role: message.role,
    text: redactPII(message.text),
  }));
}

export async function askGuideBot(history: GuideBotMessage[], token: string): Promise<string> {
  const response = await fetch(`${BACKEND_BASE_URL}/api/guidebot/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages: formatChatMessages(history),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GuideBot request failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { reply?: string };
  const content = data.reply?.trim();
  if (!content) {
    throw new Error("GuideBot returned an empty response.");
  }

  return redactPII(content);
}
