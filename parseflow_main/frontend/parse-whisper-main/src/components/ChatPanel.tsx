import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDocsByUser, type Document } from '@/lib/indexeddb';

type Tab = 'guide' | 'doc';

interface Message {
  role: 'user' | 'bot';
  text: string;
}

const guideKB: Record<string, string> = {
  'upload': 'Go to Upload in the sidebar. Drag & drop files (PDF/JPG/PNG ≤25MB) or click to browse. Hit UPLOAD ALL to process.',
  'classify': 'After upload, ParseFlow AI automatically classifies documents into categories: Identity, Financial, Legal, Compliance, Tax, Business.',
  'organize': 'Use the Documents page to view category folders. Click any folder to see documents. Use the ⋮ menu to View, Edit, Delete, or Move.',
  'history': 'The History page shows all processed documents with timestamps, confidence scores, and status indicators.',
  'export': 'Go to Export to download data as JSON, CSV, or copy to clipboard. Integration with Google Sheets available.',
  'confidence': 'Confidence scores: Green (>85%) = high accuracy, Amber (60-85%) = review recommended, Red (<60%) = manual check needed.',
  'search': 'Use the search bar in the top bar or on individual pages to find documents by name, category, or extracted data.',
  'default': 'I can help with: upload, classify, organize, history, export, confidence scores, search. What do you need?',
};

function getGuideResponse(input: string): string {
  const lower = input.toLowerCase();
  for (const [key, value] of Object.entries(guideKB)) {
    if (key !== 'default' && lower.includes(key)) return value;
  }
  if (lower.includes('help') || lower.includes('how')) return guideKB.default;
  return guideKB.default;
}

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

export function ChatPanel() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('guide');
  const [guideMessages, setGuideMessages] = useState<Message[]>([
    { role: 'bot', text: 'Welcome to ParseFlow. I can guide you through upload, classification, organizing, and export. Ask me anything.' },
  ]);
  const [docMessages, setDocMessages] = useState<Message[]>([
    { role: 'bot', text: 'I can query your personal vault. Ask about your PAN number, Aadhaar UID, invoices, or any document data.' },
  ]);
  const [input, setInput] = useState('');
  const [docs, setDocs] = useState<Document[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      getDocsByUser(user.id).then(setDocs);
    }
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [guideMessages, docMessages]);

  const messages = tab === 'guide' ? guideMessages : docMessages;
  const setMessages = tab === 'guide' ? setGuideMessages : setDocMessages;

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: 'user', text: input.trim() };
    const response = tab === 'guide' ? getGuideResponse(input) : getDocResponse(input, docs);
    setMessages(prev => [...prev, userMsg, { role: 'bot', text: response }]);
    setInput('');
  };

  if (!user) return null;

  return (
    <>
      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 gradient-primary rounded-sm flex items-center justify-center text-primary-foreground font-heading text-2xl shadow-card hover:opacity-90 transition-opacity duration-200"
        >
          💬
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[350px] h-[500px] bg-card border border-border rounded-sm shadow-card-hover flex flex-col">
          {/* Header */}
          <div className="flex items-center border-b border-border">
            <button
              onClick={() => setTab('guide')}
              className={`flex-1 h-10 font-mono text-xs uppercase tracking-wider transition-colors duration-200 ${
                tab === 'guide' ? 'gradient-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              🛤️ GUIDE
            </button>
            <button
              onClick={() => setTab('doc')}
              className={`flex-1 h-10 font-mono text-xs uppercase tracking-wider transition-colors duration-200 ${
                tab === 'doc' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              📄 DOCBOT
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-sm font-body text-sm ${
                    msg.role === 'user'
                      ? 'gradient-primary text-primary-foreground'
                      : 'bg-secondary text-foreground'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-2 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              className="flex-1 h-9 px-3 bg-background border border-border rounded-sm font-body text-sm text-foreground focus:outline-none focus:border-primary transition-colors duration-200"
              placeholder={tab === 'guide' ? 'Ask about ParseFlow...' : 'Query your vault...'}
            />
            <button
              onClick={handleSend}
              className="h-9 px-3 gradient-primary text-primary-foreground font-mono text-xs rounded-sm hover:opacity-90 transition-opacity duration-200"
            >
              SEND
            </button>
          </div>
        </div>
      )}
    </>
  );
}
