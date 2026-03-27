import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

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

export function ChatPanel() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [guideMessages, setGuideMessages] = useState<Message[]>([
    { role: 'bot', text: 'Welcome to ParseFlow. I can guide you through upload, classification, organizing, and export. Ask me anything.' },
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [guideMessages]);

  const messages = guideMessages;
  const setMessages = setGuideMessages;

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: 'user', text: input.trim() };
    const response = getGuideResponse(input);
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
              <div className="flex-1 h-10 font-mono text-xs uppercase tracking-wider flex items-center px-3">
                <span className="gradient-primary text-primary-foreground">🛤️ GUIDE</span>
              </div>
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
              placeholder={'Ask about ParseFlow...'}
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
