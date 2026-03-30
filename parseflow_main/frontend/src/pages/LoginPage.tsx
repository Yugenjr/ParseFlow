import { useState } from 'react';
import { SignIn, SignUp } from '@clerk/react';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);

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

          <div className="flex justify-center">
            {isRegister ? (
              <SignUp
                routing="virtual"
                signInUrl="/login"
                forceRedirectUrl="/"
              />
            ) : (
              <SignIn
                routing="virtual"
                signUpUrl="/login"
                forceRedirectUrl="/"
              />
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-border">
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="font-body text-sm text-primary hover:underline"
            >
              {isRegister ? 'Already have a vault? Login' : 'New user? Create vault'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
