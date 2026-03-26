import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = isRegister
      ? await register(name, email, password)
      : await login(email, password);

    setLoading(false);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Authentication failed');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-[600px]">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-heading text-6xl gradient-text tracking-wider">PARSEFLOW</h1>
          <p className="font-mono text-sm text-muted-foreground mt-2">DOCUMENT INTELLIGENCE VAULT</p>
        </div>

        {/* Auth Card */}
        <div className="card-brutal">
          <h2 className="font-heading text-3xl text-foreground mb-6">
            {isRegister ? 'CREATE VAULT' : 'ENTER VAULT'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="font-mono text-xs text-muted-foreground uppercase tracking-wider block mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-12 px-4 bg-background border border-border rounded-sm font-body text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors duration-200"
                  placeholder="John Doe"
                  required
                />
              </div>
            )}

            <div>
              <label className="font-mono text-xs text-muted-foreground uppercase tracking-wider block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 px-4 bg-background border border-border rounded-sm font-body text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors duration-200"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="font-mono text-xs text-muted-foreground uppercase tracking-wider block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-4 bg-background border border-border rounded-sm font-body text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors duration-200"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="px-3 py-2 bg-destructive/10 border border-destructive/30 rounded-sm">
                <p className="font-mono text-xs text-destructive">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 gradient-primary text-primary-foreground font-heading text-xl tracking-wider rounded-sm transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'PROCESSING...' : isRegister ? 'CREATE VAULT' : 'ENTER VAULT'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-border">
            <button
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
              className="font-body text-sm text-primary hover:underline"
            >
              {isRegister ? 'Already have a vault? Login' : 'New user? Create vault'}
            </button>
          </div>

          <div className="mt-4 px-3 py-2 bg-secondary rounded-sm">
            <p className="font-mono text-xs text-muted-foreground">
              DEMO → test@test.com / password123
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
