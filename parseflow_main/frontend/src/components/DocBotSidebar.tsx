import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserDocuments, type BackendDocument } from '@/lib/backend-api';

type Message = { role: 'user' | 'bot'; text: string };

function getDocResponse(input: string, docs: BackendDocument[]): string {
  const lower = input.toLowerCase();

  if (lower.includes('pan') && lower.includes('number')) {
    const pan = docs.find(d => d.filename.toLowerCase().includes('pan'));
    const panValue = (pan?.metadata?.PAN || pan?.metadata?.id_number || pan?.metadata?.document_number) as string | undefined;
    if (panValue) return `Your PAN number is ${panValue} (from ${pan.filename})`;
    return 'No PAN card found in your vault.';
  }

  if (lower.includes('aadhaar') || lower.includes('aadhar') || lower.includes('uid')) {
    const aadhaar = docs.find(d => d.filename.toLowerCase().includes('aadhaar') || d.filename.toLowerCase().includes('aadhar'));
    const uid = (aadhaar?.metadata?.UID || aadhaar?.metadata?.id_number || aadhaar?.metadata?.document_number) as string | undefined;
    if (uid) return `Your Aadhaar UID is ${uid} (from ${aadhaar.filename})`;
    return 'No Aadhaar card found in your vault.';
  }

  if (lower.includes('passport')) {
    const passport = docs.find(d => d.filename.toLowerCase().includes('passport'));
    const passportNo = (passport?.metadata?.['Passport No'] || passport?.metadata?.document_number || passport?.metadata?.id_number) as string | undefined;
    const expiry = (passport?.metadata?.Expiry || passport?.metadata?.expiry_date) as string | undefined;
    if (passportNo) return `Passport No: ${passportNo}, Expiry: ${expiry || 'N/A'}`;
    return 'No passport found in your vault.';
  }

  if (lower.includes('invoice') || lower.includes('amount') || lower.includes('total')) {
    const inv = docs.find(d => d.category === 'Financial' && (d.filename.toLowerCase().includes('invoice') || d.document_type.toLowerCase().includes('receipt')));
    const invNo = (inv?.metadata?.['Invoice No'] || inv?.metadata?.document_number) as string | undefined;
    const amount = (inv?.metadata?.Total || inv?.metadata?.Amount || inv?.metadata?.amount) as string | undefined;
    if (inv) return `Latest invoice: ${invNo || inv.filename} - Total: ${amount || 'N/A'}`;
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
    const gross = (sal?.metadata?.Gross || sal?.metadata?.gross_amount) as string | undefined;
    const net = (sal?.metadata?.Net || sal?.metadata?.net_amount) as string | undefined;
    const month = (sal?.metadata?.Month || sal?.metadata?.month) as string | undefined;
    if (sal) return `Latest salary: Gross ${gross || 'N/A'}, Net ${net || 'N/A'} (${month || ''})`;
    return 'No salary slips found in your vault.';
  }

  return `I can search your vault for: PAN number, Aadhaar UID, passport details, invoices, salary info, document counts, categories. What would you like to know?`;
}

export function DocBotSidebar() {
  const { user, getAuthToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: 'Ask me about your vault: PAN, Aadhaar, passports, invoices, counts.' },
  ]);
  const [input, setInput] = useState('');
  const [docs, setDocs] = useState<BackendDocument[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const token = await getAuthToken();
      if (!token) return;
      const backendDocs = await fetchUserDocuments(token);
      setDocs(backendDocs);
    };
    load().catch(() => setDocs([]));
  }, [user, getAuthToken]);

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
