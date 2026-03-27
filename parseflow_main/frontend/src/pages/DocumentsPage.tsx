import {
  MoreVertical,
  Upload,
  UserRound,
  Landmark,
  Scale,
  ClipboardCheck,
  ReceiptText,
  Building2,
  FolderOpen,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { deleteUserDocument, fetchUserDocuments, uploadDocumentToFolder, type BackendDocument } from "@/lib/backend-api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CUSTOM_FOLDERS_KEY = "parseflow_custom_folders";

const categoryConfig: Record<string, { icon: LucideIcon; color: string }> = {
  Identity: { icon: UserRound, color: 'border-l-primary' },
  Financial: { icon: Landmark, color: 'border-l-success' },
  Legal: { icon: Scale, color: 'border-l-accent' },
  Compliance: { icon: ClipboardCheck, color: 'border-l-warning' },
  Tax: { icon: ReceiptText, color: 'border-l-destructive' },
  Business: { icon: Building2, color: 'border-l-muted-foreground' },
  Other: { icon: FolderOpen, color: 'border-l-border' },
};

export default function DocumentsPage() {
  const { user, getAuthToken } = useAuth();
  const [docs, setDocs] = useState<BackendDocument[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<BackendDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [folderUploadTarget, setFolderUploadTarget] = useState<string | null>(null);
  const [uploadingFolder, setUploadingFolder] = useState<string | null>(null);
  const folderUploadInputRef = useRef<HTMLInputElement | null>(null);

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const getReliableToken = async () => {
    for (let i = 0; i < 6; i += 1) {
      const token = await getAuthToken();
      if (token) return token;
      await wait(250);
    }
    return null;
  };

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
    const backendBaseUrl = import.meta.env.VITE_BACKEND_URL || 'http://10.0.111.131:5000';
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

  const confirmDeleteDocument = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const token = await getReliableToken();
      if (!token) {
        throw new Error('Authentication token missing. Please sign in again.');
      }

      await deleteUserDocument(deleteTarget._id, token);
      setDocs((prev) => prev.filter((doc) => doc._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete document. Please try again.';
      window.alert(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const openFolderUploadPicker = (folder: string) => {
    setFolderUploadTarget(folder);
    if (folderUploadInputRef.current) {
      folderUploadInputRef.current.value = '';
      folderUploadInputRef.current.click();
    }
  };

  const onFolderFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files && event.target.files[0];
    if (!file || !folderUploadTarget) return;

    setUploadingFolder(folderUploadTarget);
    try {
      const token = await getReliableToken();
      if (!token) throw new Error('Authentication token missing. Please sign in again.');

      const response = await uploadDocumentToFolder(file, folderUploadTarget, token);
      if (response && response.document) {
        setDocs((prev) => [response.document, ...prev]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload into folder. Please try again.';
      window.alert(message);
    } finally {
      setUploadingFolder(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <h2 className="font-heading text-3xl text-foreground tracking-wider">DOCUMENT ORGANIZER</h2>

      <input
        ref={folderUploadInputRef}
        type="file"
        className="hidden"
        onChange={onFolderFileSelected}
      />

      {/* Category Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        {categories.map((cat) => (
          <button
            key={cat.name}
            onClick={() => setSelectedCat(selectedCat === cat.name ? null : cat.name)}
            className={`card-brutal card-brutal-hover flex flex-col items-center gap-2 py-5 cursor-pointer ${
              selectedCat === cat.name ? 'border-primary border-2' : ''
            }`}
          >
            <cat.icon className="h-7 w-7 text-primary" strokeWidth={1.8} />
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openFolderUploadPicker(folder)}
                      className="h-7 px-2 rounded-sm bg-secondary text-foreground hover:bg-secondary/80 transition-colors duration-200 font-mono text-[10px] uppercase tracking-wider"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Upload className="h-3 w-3" />
                        {uploadingFolder === folder ? 'Uploading...' : 'Upload Here'}
                      </span>
                    </button>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-sm bg-secondary text-muted-foreground">{folderDocs.length}</span>
                  </div>
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
                        <div className="h-10 w-10 rounded-sm bg-secondary flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5 text-primary" strokeWidth={1.8} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-body text-sm font-medium text-foreground truncate">{doc.filename}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString()}</p>
                        </div>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded-sm bg-secondary text-primary uppercase">
                          {doc.category}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => e.stopPropagation()}
                              className="text-muted-foreground hover:text-foreground transition-colors duration-200"
                              aria-label="More actions"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(doc);
                              }}
                              className="text-destructive"
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteTarget?.filename || 'this document'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteDocument();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
