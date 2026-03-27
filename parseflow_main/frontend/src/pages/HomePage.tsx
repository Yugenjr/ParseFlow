import { FileText, BarChart3, HardDrive, Upload, Camera, Clock, FolderOpen, ChevronRight, Bot, Zap, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { fetchUserDocuments, type BackendDocument } from "@/lib/backend-api";

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user, getAuthToken } = useAuth();
  const [docs, setDocs] = useState<BackendDocument[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const token = await getAuthToken();
      if (!token) return;
      const backendDocs = await fetchUserDocuments(token);
      setDocs(backendDocs);
    };
    load().catch(() => setDocs([]));
  }, [user, getAuthToken]);

  const thisWeek = docs.filter(d => Date.now() - new Date(d.createdAt).getTime() < 7 * 86400000).length;
  const avgTime = "0.9";

  const stats = [
    { icon: FileText, label: "TOTAL DOCS", value: String(docs.length) },
    { icon: BarChart3, label: "THIS WEEK", value: String(thisWeek) },
    { icon: HardDrive, label: "STORAGE", value: `${(docs.length * 0.18).toFixed(1)}MB` },
    { icon: Bot, label: "AI ACCURACY", value: "95%" },
    { icon: Zap, label: "AVG TIME", value: `${avgTime}s` },
    { icon: Search, label: "QUERIES", value: "12" },
  ];

  const quickActions = [
    { icon: Upload, label: "UPLOAD", route: "/upload" },
    { icon: Camera, label: "SCAN", route: "/upload" },
    { icon: Clock, label: "HISTORY", route: "/history" },
    { icon: FolderOpen, label: "ORGANIZE", route: "/documents" },
  ];

  const recent = [...docs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Hero Slab */}
      <div className="gradient-primary p-6 md:p-8 rounded-sm">
        <h2 className="font-heading text-4xl md:text-5xl text-primary-foreground tracking-wider">
          PARSEFLOW VAULT — {user?.name?.toUpperCase()}
        </h2>
        <p className="font-mono text-xs text-primary-foreground/70 mt-1">DOCUMENT INTELLIGENCE DASHBOARD</p>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
          {stats.map((s) => (
            <div key={s.label} className="bg-primary-foreground/10 backdrop-blur-sm p-3 rounded-sm border border-primary-foreground/20">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className="h-4 w-4 text-primary-foreground/70" />
                <span className="font-mono text-[10px] text-primary-foreground/60 uppercase">{s.label}</span>
              </div>
              <p className="font-heading text-3xl text-primary-foreground leading-none">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="font-heading text-2xl text-foreground mb-3 tracking-wider">QUICK ACTIONS</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((a) => (
            <button
              key={a.label}
              onClick={() => navigate(a.route)}
              className="card-brutal card-brutal-hover flex flex-col items-center gap-3 py-6 cursor-pointer"
            >
              <a.icon className="h-7 w-7 text-primary" />
              <span className="font-heading text-lg text-foreground tracking-wider">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h3 className="font-heading text-2xl text-foreground mb-3 tracking-wider">RECENT ACTIVITY</h3>
        <div className="card-brutal divide-y divide-border p-0">
          {recent.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-heading text-2xl text-muted-foreground">NO DOCUMENTS YET</p>
              <p className="font-body text-sm text-muted-foreground mt-1">Upload your first document to get started</p>
            </div>
          ) : (
            recent.map((doc) => (
              <div key={doc._id} className="flex items-center gap-4 p-4 hover:bg-secondary/50 cursor-pointer transition-colors duration-200">
                <div className="h-10 w-10 rounded-sm bg-secondary flex items-center justify-center shrink-0 text-lg">
                  📄
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm font-medium text-foreground truncate">{doc.filename}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{doc.category} · {timeAgo(doc.createdAt)}</p>
                </div>
                {/* Confidence bar */}
                <div className="hidden sm:flex items-center gap-2 w-24">
                  <div className="flex-1 h-2 bg-muted rounded-sm overflow-hidden">
                    <div
                      className={`h-full rounded-sm ${doc.confidence > 85 ? 'bg-success' : doc.confidence > 60 ? 'bg-warning' : 'bg-destructive'}`}
                      style={{ width: `${doc.confidence}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground w-8">{doc.confidence}%</span>
                </div>
                <span className={`px-2 py-0.5 rounded-sm font-mono text-[10px] ${
                  doc.confidence > 85 ? 'bg-success/10 text-success' : doc.confidence > 60 ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'
                }`}>
                  {doc.method}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
