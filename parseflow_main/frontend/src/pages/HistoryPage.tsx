import { Search, FileText, Check, AlertTriangle, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { fetchUserDocuments, type BackendDocument } from "@/lib/backend-api";

function formatUploadedAt(ts: string): string {
  const when = new Date(ts);
  if (Number.isNaN(when.getTime())) return 'time unavailable';
  return when.toLocaleString();
}

const filters = ["All", "Identity", "Financial", "Legal", "Compliance", "Tax", "Business"];

const statusIcon: Record<string, React.ReactNode> = {
  success: <Check className="h-4 w-4 text-success" />,
  warning: <AlertTriangle className="h-4 w-4 text-warning" />,
  error: <X className="h-4 w-4 text-destructive" />,
};

function getHistoryStatus(item: BackendDocument): 'success' | 'warning' | 'error' {
  const score = Number(item.accuracy ?? item.confidence ?? 0);
  if (item.method === 'Storage Sync') return 'success';
  if (score >= 80) return 'success';
  if (score > 50) return 'warning';
  return 'error';
}

export default function HistoryPage() {
  const { user, getAuthToken } = useAuth();
  const [docs, setDocs] = useState<BackendDocument[]>([]);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const token = await getAuthToken();
      if (!token) return;
      const backendDocs = await fetchUserDocuments(token);
      setDocs(backendDocs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    };
    load().catch(() => setDocs([]));
  }, [user, getAuthToken]);

  const filtered = docs
    .filter(d => filter === "All" || d.category === filter)
    .filter(d => !search || d.filename.toLowerCase().includes(search.toLowerCase()));

  const openDoc = (doc: BackendDocument) => {
    if (!doc.fileUrl) return;
    const backendBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    window.open(`${backendBaseUrl}${doc.fileUrl}`, '_blank');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="font-heading text-3xl text-foreground tracking-wider">HISTORY</h2>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search history..."
            className="w-full h-11 pl-10 pr-4 bg-card border border-border rounded-sm font-body text-sm text-foreground focus:outline-none focus:border-primary transition-colors duration-200"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-sm font-mono text-[10px] uppercase tracking-wider transition-all duration-200 ${
                filter === f ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="card-brutal text-center py-8">
            <p className="font-heading text-2xl text-muted-foreground">NO RESULTS</p>
          </div>
        ) : (
          filtered.map((item) => {
            const score = Number(item.accuracy ?? item.confidence ?? 0);
            return (
            <div
              key={item._id}
              onClick={() => openDoc(item)}
              className={`card-brutal card-brutal-hover flex items-center gap-4 ${item.fileUrl ? 'cursor-pointer' : ''}`}
            >
              <div className="h-10 w-10 rounded-sm bg-secondary flex items-center justify-center shrink-0 text-lg">
                📄
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body text-sm font-medium text-foreground truncate">{item.filename}</p>
                <p className="font-mono text-[10px] text-muted-foreground">
                  {item.category} · Uploaded {formatUploadedAt(item.createdAt)}
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-2 w-20">
                <div className="flex-1 h-2 bg-muted rounded-sm overflow-hidden">
                  <div
                    className={`h-full rounded-sm ${score > 85 ? 'bg-success' : score > 60 ? 'bg-warning' : 'bg-destructive'}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">{score}%</span>
              </div>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-sm bg-secondary text-primary">{item.method}</span>
              {statusIcon[getHistoryStatus(item)]}
            </div>
            );
          })
        )}
      </div>

      <button className="w-full py-3 font-mono text-xs text-primary hover:underline uppercase tracking-wider">
        LOAD MORE
      </button>
    </div>
  );
}
