import { MoreVertical, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { fetchUserDocuments, type BackendDocument } from "@/lib/backend-api";

const CUSTOM_FOLDERS_KEY = "parseflow_custom_folders";

const categoryConfig: Record<string, { emoji: string; color: string }> = {
  Identity: { emoji: '🪪', color: 'border-l-primary' },
  Financial: { emoji: '💰', color: 'border-l-success' },
  Legal: { emoji: '⚖', color: 'border-l-accent' },
  Compliance: { emoji: '📋', color: 'border-l-warning' },
  Tax: { emoji: '💼', color: 'border-l-destructive' },
  Business: { emoji: '🏢', color: 'border-l-muted-foreground' },
};

export default function DocumentsPage() {
  const { user, getAuthToken } = useAuth();
  const [docs, setDocs] = useState<BackendDocument[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [customFolders, setCustomFolders] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_FOLDERS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setCustomFolders(parsed.filter((v) => typeof v === "string"));
      }
    } catch {
      setCustomFolders([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CUSTOM_FOLDERS_KEY, JSON.stringify(customFolders));
  }, [customFolders]);

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

  const catCounts: Record<string, number> = {};
  docs.forEach(d => { catCounts[d.category] = (catCounts[d.category] || 0) + 1; });

  const categories = Object.entries(categoryConfig).map(([name, cfg]) => ({
    name,
    ...cfg,
    count: catCounts[name] || 0,
  }));

  const filteredDocs = selectedCat ? docs.filter(d => d.category === selectedCat) : docs;

  const visibleCustomFolders = customFolders.filter((folder) => {
    if (!selectedCat) return true;
    const category = folder.split("/")[0] || "Other";
    return category === selectedCat;
  });

  const folderGroups = filteredDocs.reduce<Record<string, BackendDocument[]>>((acc, doc) => {
    const category = doc.storage?.category || doc.category || 'Other';
    const docType = doc.storage?.docType || doc.document_type || 'Unknown';
    const key = `${category}/${docType}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  visibleCustomFolders.forEach((folder) => {
    if (!folderGroups[folder]) {
      folderGroups[folder] = [];
    }
  });

  const sortedFolders = Object.entries(folderGroups).sort((a, b) => a[0].localeCompare(b[0]));

  const openDoc = (doc: BackendDocument) => {
    if (!doc.fileUrl) return;
    const backendBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    window.open(`${backendBaseUrl}${doc.fileUrl}`, '_blank');
  };

  const normalizeFolderInput = (value: string) => {
    const cleaned = value
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean)
      .join("/");
    if (!cleaned.includes("/")) {
      return `Other/${cleaned || "Custom"}`;
    }
    return cleaned;
  };

  const createCustomFolder = () => {
    const input = window.prompt("Enter folder path (example: Other/Personal_Notes)");
    if (!input) return;

    const normalized = normalizeFolderInput(input);
    if (!normalized) return;

    const exists = sortedFolders.some(([folder]) => folder.toLowerCase() === normalized.toLowerCase());
    if (exists) {
      window.alert("Folder already exists.");
      return;
    }

    setCustomFolders((prev) => [...prev, normalized]);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <h2 className="font-heading text-3xl text-foreground tracking-wider">DOCUMENT ORGANIZER</h2>

      {/* Category Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {categories.map((cat) => (
          <button
            key={cat.name}
            onClick={() => setSelectedCat(selectedCat === cat.name ? null : cat.name)}
            className={`card-brutal card-brutal-hover flex flex-col items-center gap-2 py-5 cursor-pointer ${
              selectedCat === cat.name ? 'border-primary border-2' : ''
            }`}
          >
            <span className="text-2xl">{cat.emoji}</span>
            <span className="font-heading text-lg text-foreground tracking-wider">{cat.name.toUpperCase()}</span>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-sm bg-secondary text-muted-foreground">
              {cat.count}
            </span>
          </button>
        ))}
      </div>

      {/* Document List */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-heading text-xl text-foreground tracking-wider">
            {selectedCat ? `${selectedCat.toUpperCase()} FOLDERS` : 'ALL FOLDERS'}
          </h3>
          <button
            onClick={createCustomFolder}
            className="h-9 px-3 rounded-sm gradient-primary text-primary-foreground font-mono text-[10px] uppercase tracking-wider hover:opacity-90 transition-opacity duration-200"
          >
            Create Folder
          </button>
        </div>
        <div className="space-y-4">
          {sortedFolders.length === 0 ? (
            <div className="card-brutal text-center py-8">
              <p className="font-heading text-2xl text-muted-foreground">NO DOCUMENTS</p>
              <p className="font-body text-sm text-muted-foreground mt-1">Upload documents to see them here</p>
            </div>
          ) : (
            sortedFolders.map(([folder, folderDocs]) => (
              <div key={folder} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{folder}</p>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded-sm bg-secondary text-muted-foreground">{folderDocs.length}</span>
                </div>
                <div className="space-y-2">
                  {folderDocs.length === 0 ? (
                    <div className="card-brutal border-dashed border border-border text-center py-4">
                      <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Custom Folder Ready</p>
                      <p className="font-body text-xs text-muted-foreground mt-1">Upload files and classify into this folder later</p>
                    </div>
                  ) : (
                    folderDocs.map((doc) => (
                      <div
                        key={doc._id}
                        onClick={() => openDoc(doc)}
                        className={`card-brutal card-brutal-hover flex items-center gap-4 border-l-4 ${categoryConfig[doc.category]?.color || ''} ${doc.fileUrl ? 'cursor-pointer' : ''}`}
                      >
                        <div className="h-10 w-10 rounded-sm bg-secondary flex items-center justify-center shrink-0 text-lg">
                          📄
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-sm font-medium text-foreground truncate">{doc.filename}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString()}</p>
                        </div>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-sm bg-secondary text-primary uppercase">
                          {doc.category}
                        </span>
                        <button className="text-muted-foreground hover:text-foreground transition-colors duration-200">
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={createCustomFolder}
        className="fixed bottom-6 right-24 z-40 h-14 w-14 rounded-sm gradient-primary flex items-center justify-center text-primary-foreground shadow-card hover:opacity-90 transition-opacity duration-200"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
