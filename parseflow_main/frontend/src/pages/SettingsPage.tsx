import { Moon, Sun, Bell, Shield, User, ChevronRight, LogOut, Link2, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { fetchGoogleDriveAuthUrl, fetchGoogleDriveStatus } from "@/lib/backend-api";
import { useToast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains("dark"));
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const { user, logout, getAuthToken } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const toggleDark = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    const loadDriveStatus = async () => {
      const token = await getAuthToken();
      if (!token) return;
      try {
        const status = await fetchGoogleDriveStatus(token);
        setDriveConnected(status.connected);
      } catch {
        setDriveConnected(false);
      }
    };
    loadDriveStatus();
  }, [getAuthToken]);

  const handleConnectGoogleDrive = async () => {
    setDriveLoading(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        toast({ title: 'AUTH REQUIRED', description: 'Please login again.' });
        return;
      }
      const oauthUrl = await fetchGoogleDriveAuthUrl(token);
      window.location.href = oauthUrl;
    } catch (err) {
      toast({
        title: 'GOOGLE DRIVE CONNECT FAILED',
        description: err instanceof Error ? err.message : 'Unable to start Google OAuth.',
      });
    } finally {
      setDriveLoading(false);
    }
  };

  const settingsItems = [
    { icon: User, label: "PROFILE", description: "Manage account details" },
    { icon: Bell, label: "NOTIFICATIONS", description: "Configure alerts" },
    { icon: Shield, label: "PRIVACY & SECURITY", description: "Password and data settings" },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="font-heading text-3xl text-foreground tracking-wider">SETTINGS</h2>

      {/* User Info */}
      <div className="card-brutal">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-sm gradient-primary flex items-center justify-center text-primary-foreground font-heading text-2xl">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-heading text-xl text-foreground tracking-wider">{user?.name?.toUpperCase()}</p>
            <p className="font-mono text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="card-brutal">
        <h3 className="font-heading text-xl mb-4 text-foreground tracking-wider">APPEARANCE</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isDark ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
            <div>
              <p className="font-body text-sm font-medium text-foreground">Dark Mode</p>
              <p className="font-mono text-[10px] text-muted-foreground">TOGGLE DARK THEME</p>
            </div>
          </div>
          <button
            onClick={toggleDark}
            className={`relative h-7 w-12 rounded-sm transition-colors duration-200 ${isDark ? "bg-primary" : "bg-muted"}`}
          >
            <span className={`absolute top-0.5 h-6 w-6 rounded-sm bg-card shadow-md transition-transform duration-200 ${isDark ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>
      </div>

      {/* Account Settings */}
      <div className="card-brutal p-0">
        <h3 className="font-heading text-xl p-5 pb-2 text-foreground tracking-wider">ACCOUNT</h3>
        <div className="divide-y divide-border">
          {settingsItems.map((item) => (
            <button key={item.label} className="w-full flex items-center gap-4 p-5 hover:bg-secondary/50 transition-colors duration-200 text-left">
              <item.icon className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1">
                <p className="font-body text-sm font-medium text-foreground">{item.label}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{item.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>

      {/* Cloud Sync */}
      <div className="card-brutal">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {driveConnected ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : (
              <Link2 className="h-5 w-5 text-primary" />
            )}
            <div>
              <p className="font-body text-sm font-medium text-foreground">Google Drive Sync</p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {driveConnected ? 'CONNECTED · NEW UPLOADS AUTO-SYNC' : 'OPTIONAL · CONNECT ONCE FOR AUTO-SYNC'}
              </p>
            </div>
          </div>

          <button
            onClick={handleConnectGoogleDrive}
            disabled={driveLoading || driveConnected}
            className="h-9 px-4 border border-primary text-primary font-mono text-xs rounded-sm hover:bg-secondary transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {driveConnected ? 'CONNECTED' : driveLoading ? 'CONNECTING...' : 'CONNECT GOOGLE DRIVE'}
          </button>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full card-brutal flex items-center gap-3 text-destructive hover:bg-destructive/10 transition-colors duration-200"
      >
        <LogOut className="h-5 w-5" />
        <span className="font-heading text-lg tracking-wider">LOGOUT</span>
      </button>
    </div>
  );
}
