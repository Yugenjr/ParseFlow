import { Moon, Sun, Bell, Shield, User, ChevronRight, LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function SettingsPage() {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains("dark"));
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const toggleDark = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
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
