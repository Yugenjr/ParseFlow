import { Home, FileText, Upload, History, Settings, Download, MessageSquare, Eye, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Upload", url: "/upload", icon: Upload, isGradient: true },
  { title: "History", url: "/history", icon: History },
  { title: "Export", url: "/export", icon: Download },
  { title: "Transparency", url: "/transparency", icon: Eye },
  { title: "Feedback", url: "/feedback", icon: MessageSquare },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="pt-6 flex flex-col h-full">
        {!collapsed && (
          <div className="px-6 pb-6 border-b border-border mb-4">
            <h1 className="font-heading text-4xl gradient-text tracking-wider">PARSEFLOW</h1>
            <p className="font-mono text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">Document Vault</p>
          </div>
        )}
        {collapsed && (
          <div className="flex items-center justify-center pb-4 border-b border-border mb-4">
            <span className="font-heading text-2xl gradient-text">P</span>
          </div>
        )}
        <SidebarGroup className="flex-1">
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className={`flex items-center gap-3 px-4 py-3 rounded-sm transition-all duration-200 text-muted-foreground hover:text-foreground hover:border-l-2 hover:border-primary ${
                        item.isGradient ? "font-semibold" : ""
                      }`}
                      activeClassName="bg-secondary text-primary font-semibold border-l-2 border-primary"
                    >
                      <item.icon
                        className={`h-5 w-5 shrink-0 ${item.isGradient ? "text-primary" : ""}`}
                      />
                      {!collapsed && (
                        <span className="font-body text-sm">{item.title}</span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Logout */}
        <div className="p-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-200"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span className="font-body text-sm">Logout</span>}
          </button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
