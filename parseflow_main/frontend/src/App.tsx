import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import UploadPage from "./pages/UploadPage";
import ProcessingPage from "./pages/ProcessingPage";
import ResultsPage from "./pages/ResultsPage";
import DocumentsPage from "./pages/DocumentsPage";
import HistoryPage from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";
import FeedbackPage from "./pages/FeedbackPage";
import ExportPage from "./pages/ExportPage";
import TransparencyPage from "./pages/TransparencyPage";
import DocBotPage from "./pages/DocBotPage";
import NotFound from "./pages/NotFound";
import { ChatPanel } from "./components/ChatPanel";

const queryClient = new QueryClient();

const vaultTaglines = [
  "Decrypting your document universe...",
  "Indexing folders for lightning-fast recall...",
  "Aligning OCR, ML, and semantic signals...",
  "Calibrating confidence gates at 97%...",
  "Preparing your secure parsing workspace...",
];

function VaultLoadingScreen() {
  const [taglineIndex, setTaglineIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTaglineIndex((prev) => (prev + 1) % vaultTaglines.length);
    }, 1700);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-xl card-brutal space-y-6">
        <div className="text-center space-y-2">
          <p className="font-heading text-2xl tracking-widest text-foreground">LOADING VAULT</p>
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-[0.25em]">ParseFlow Initialization</p>
        </div>

        <div className="relative h-3 rounded-sm bg-muted overflow-hidden border border-border">
          <div className="absolute inset-y-0 left-0 w-1/3 gradient-primary animate-pulse" />
          <div className="absolute inset-y-0 left-1/3 w-1/3 bg-primary/50 animate-pulse" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {["OCR", "CLASSIFY", "VERIFY"].map((step, index) => (
            <div key={step} className="rounded-sm border border-border bg-secondary/40 px-3 py-2 text-center">
              <p className="font-mono text-[10px] tracking-widest text-muted-foreground">{step}</p>
              <div className="mt-2 flex items-center justify-center gap-1">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={`${step}-${dot}`}
                    className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
                    style={{ animationDelay: `${(index * 0.2) + (dot * 0.15)}s` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="h-10 flex items-center justify-center rounded-sm border border-dashed border-border bg-secondary/20 px-4">
          <p className="font-body text-sm text-foreground text-center transition-opacity duration-300">
            {vaultTaglines[taglineIndex]}
          </p>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <VaultLoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return <DashboardLayout>{children}</DashboardLayout>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <VaultLoadingScreen />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
            <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/upload" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
            <Route path="/processing" element={<ProtectedRoute><ProcessingPage /></ProtectedRoute>} />
            <Route path="/results" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/feedback" element={<ProtectedRoute><FeedbackPage /></ProtectedRoute>} />
            <Route path="/docbot" element={<ProtectedRoute><DocBotPage /></ProtectedRoute>} />
            <Route path="/export" element={<ProtectedRoute><ExportPage /></ProtectedRoute>} />
            <Route path="/transparency" element={<ProtectedRoute><TransparencyPage /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <ChatPanel />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
