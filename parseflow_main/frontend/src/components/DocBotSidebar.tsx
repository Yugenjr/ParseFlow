import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { queryDocBot } from '@/lib/backend-api';

type Message = { role: 'user' | 'bot'; text: string };

export function DocBotSidebar() {
  const { user, getAuthToken } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: 'Ask me anything about ParseFlow or your documents. I can guide actions and answer from your stored files.' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: 'user', text: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Authentication token missing. Please sign in again.');
      const response = await queryDocBot(userMsg.text, token);
      setMessages(prev => [...prev, { role: 'bot', text: response.answer }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'DocBot failed to respond.';
      setMessages(prev => [...prev, { role: 'bot', text: `I hit an issue: ${msg}` }]);
    } finally {
      setIsLoading(false);
    }

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
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              void handleSend();
            }
          }}
          placeholder="Query your vault..."
          className="flex-1 h-8 px-2 bg-background border border-border rounded-sm text-sm"
          disabled={isLoading}
        />
        <button
          onClick={() => {
            void handleSend();
          }}
          className="h-8 px-2 bg-primary text-primary-foreground rounded-sm text-sm disabled:opacity-60"
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? '...' : 'Ask'}
        </button>
      </div>
    </div>
  );
}
