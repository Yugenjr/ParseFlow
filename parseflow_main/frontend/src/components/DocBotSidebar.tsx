import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDocsByUser, type Document } from '@/lib/indexeddb';

type Message = { role: 'user' | 'bot'; text: string };

function getDocResponse(input: string, docs: Document[]): string {
  const lower = input.toLowerCase();

  if (lower.includes('pan') && lower.includes('number')) {
    const pan = docs.find(d => d.filename.toLowerCase().includes('pan'));
    if (pan?.extraction?.PAN) return `Your PAN number is ${pan.extraction.PAN} (from ${pan.filename})`;
    return 'No PAN card found in your vault.';
  }

  if (lower.includes('aadhaar') || lower.includes('aadhar') || lower.includes('uid')) {
    const aadhaar = docs.find(d => d.filename.toLowerCase().includes('aadhaar'));
    if (aadhaar?.extraction?.UID) return `Your Aadhaar UID is ${aadhaar.extraction.UID} (from ${aadhaar.filename})`;
    return 'No Aadhaar card found in your vault.';
  }

  if (lower.includes('passport')) {
    const passport = docs.find(d => d.filename.toLowerCase().includes('passport'));
    if (passport?.extraction?.['Passport No']) return `Passport No: ${passport.extraction['Passport No']}, Expiry: ${passport.extraction.Expiry || 'N/A'}`;
    return 'No passport found in your vault.';
  }

  if (lower.includes('invoice') || lower.includes('amount') || lower.includes('total')) {
    const inv = docs.find(d => d.category === 'Financial' && d.filename.toLowerCase().includes('invoice'));
    if (inv?.extraction) return `Latest invoice: ${inv.extraction['Invoice No'] || inv.filename} — Total: ${inv.extraction.Total || inv.extraction.Amount || 'N/A'}`;
    return 'No invoices found in your vault.';
  }

  if (lower.includes('how many') || lower.includes('total doc') || lower.includes('count')) {
    return `You have ${docs.length} documents in your vault across ${new Set(docs.map(d => d.category)).size} categories.`;
  }

  if (lower.includes('categor') || lower.includes('folder')) {
    const cats: Record<string, number> = {};
    docs.forEach(d => { cats[d.category] = (cats[d.category] || 0) + 1; });
    return Object.entries(cats).map(([k, v]) => `${k}: ${v}`).join(' | ');
  }

  if (lower.includes('salary') || lower.includes('income')) {
    const sal = docs.find(d => d.filename.toLowerCase().includes('salary'));
    if (sal?.extraction) return `Latest salary: Gross ${sal.extraction.Gross || 'N/A'}, Net ${sal.extraction.Net || 'N/A'} (${sal.extraction.Month || ''})`;
    return 'No salary slips found in your vault.';
  }

  return `I can search your vault for: PAN number, Aadhaar UID, passport details, invoices, salary info, document counts, categories. What would you like to know?`;
}

export function DocBotSidebar() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: 'Ask me about your vault: PAN, Aadhaar, passports, invoices, counts.' },
  ]);
  const [input, setInput] = useState('');
  const [docs, setDocs] = useState<Document[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) getDocsByUser(user.id).then(setDocs);
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: 'user', text: input.trim() };
    const response = getDocResponse(input, docs);
    setMessages(prev => [...prev, userMsg, { role: 'bot', text: response }]);
    setInput('');
  };

  if (!user) return null;

  return (
    <div className="mt-4 px-4">
      <div className="mb-2 font-mono text-xs uppercase text-muted-foreground">📄 DOCBOT</div>
      <div className="h-40 overflow-y-auto rounded-sm border border-border bg-surface p-2">
        {messages.map((m, i) => (
          <div key={i} className={`mb-2 text-sm ${m.role === 'user' ? 'text-right' : ''}`}>
            <div className={`inline-block max-w-full px-2 py-1 rounded-sm ${m.role === 'user' ? 'gradient-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Query your vault..."
          className="flex-1 h-8 px-2 bg-background border border-border rounded-sm text-sm"
        />
        <button onClick={handleSend} className="h-8 px-2 bg-primary text-primary-foreground rounded-sm text-sm">Ask</button>
      </div>
    </div>
  );
}
