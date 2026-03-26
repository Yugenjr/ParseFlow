import { Bell, Search, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function TopBar() {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains("dark"));
  const { user } = useAuth();

  const toggleDark = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 md:px-6 gap-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="text-muted-foreground" />
        <span className="font-heading text-xl gradient-text md:hidden tracking-wider">PARSEFLOW</span>
      </div>

      <div className="hidden md:flex flex-1 max-w-md mx-auto">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search documents..."
            className="w-full h-10 pl-10 pr-4 bg-background border border-border rounded-sm font-body text-sm text-foreground focus:outline-none focus:border-primary transition-colors duration-200"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggleDark} className="text-muted-foreground rounded-sm">
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground rounded-sm">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 gradient-primary rounded-full" />
        </Button>
        <div className="flex items-center gap-2 ml-1">
          <div className="h-9 w-9 rounded-sm gradient-primary flex items-center justify-center text-primary-foreground font-mono font-semibold text-sm">
            {initials}
          </div>
          <span className="hidden md:block font-mono text-xs text-muted-foreground">{user?.name}</span>
        </div>
      </div>
    </header>
  );
}
