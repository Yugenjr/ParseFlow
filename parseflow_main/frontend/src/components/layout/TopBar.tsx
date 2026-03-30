import { Bell, Search, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchRecentNotifications, type BackendNotification } from "@/lib/backend-api";

export function TopBar() {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains("dark"));
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<BackendNotification[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const { user, getAuthToken } = useAuth();

  const toggleDark = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

  const handleNotificationClick = async () => {
    const nextOpen = !isNotificationsOpen;
    setIsNotificationsOpen(nextOpen);
    if (!nextOpen) return;

    setIsLoadingNotifications(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setNotifications([]);
        return;
      }
      const items = await fetchRecentNotifications(token);
      setNotifications(items);
    } catch {
      setNotifications([]);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

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
        <div className="relative">
          <Button variant="ghost" size="icon" onClick={handleNotificationClick} className="relative text-muted-foreground rounded-sm">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 gradient-primary rounded-full" />
          </Button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 max-w-[90vw] border border-border bg-card rounded-sm shadow-card p-3 z-50">
              <div className="space-y-2">
                {isLoadingNotifications && <p className="text-sm text-muted-foreground">Loading...</p>}
                {!isLoadingNotifications && notifications.length === 0 && (
                  <p className="text-sm text-muted-foreground">No notifications</p>
                )}
                {!isLoadingNotifications && notifications.map((item) => (
                  <div key={item._id} className="border-b border-border last:border-0 pb-2 last:pb-0">
                    <p className="text-sm text-foreground">{item.message}</p>
                    <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
