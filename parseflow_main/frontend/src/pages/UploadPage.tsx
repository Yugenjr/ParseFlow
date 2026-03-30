import { Upload, CloudUpload, X, FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { useState, useCallback, useMemo, useRef } from "react";
import { uploadDocument } from "@/lib/backend-api";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const RECENT_UPLOAD_DOC_ID_KEY = "parseflow_recent_upload_doc_id";
const RECENT_UPLOAD_SNAPSHOT_KEY = "parseflow_recent_upload_snapshot";

interface RecentUploadSnapshot {
  documentId: string;
  filename: string;
  documentType: string;
  confidence: number;
  category: string;
  createdAt: string;
}

interface QueueItem {
  id: string;
  file: File;
  name: string;
  size: string;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  message?: string;
}

export default function UploadPage() {
  const { getAuthToken, syncUser } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [lastResultJson, setLastResultJson] = useState<string>("");
  const [recentlyProcessedName, setRecentlyProcessedName] = useState<string>("");
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  const progressTimersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    return () => {
      Object.values(progressTimersRef.current).forEach((timerId) => {
        window.clearInterval(timerId);
      });
      progressTimersRef.current = {};
    };
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const humanSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const addFiles = useCallback((files: FileList | File[]) => {
    const acceptedExt = new Set(["pdf", "jpg", "jpeg", "png"]);
    const acceptedMime = new Set(["application/pdf", "image/jpeg", "image/png"]);
    const maxSizeBytes = 25 * 1024 * 1024;

    const items: QueueItem[] = Array.from(files).map((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const extOk = acceptedExt.has(ext);
      const mimeOk = !file.type || acceptedMime.has(file.type);
      const sizeOk = file.size <= maxSizeBytes;

      if (!extOk || !mimeOk) {
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          name: file.name,
          size: humanSize(file.size),
          progress: 100,
          status: "error",
          message: "Unsupported file type. Use PDF, JPG, or PNG."
        };
      }

      if (!sizeOk) {
        return {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          name: file.name,
          size: humanSize(file.size),
          progress: 100,
          status: "error",
          message: "File exceeds 25MB limit."
        };
      }

      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        name: file.name,
        size: humanSize(file.size),
        progress: 0,
        status: "queued"
      };
    });

    setQueue((q) => [...q, ...items]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  }, [addFiles]);

  const handleChooseFiles = () => {
    inputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  };

  const removeItem = (id: string) => setQueue((q) => q.filter((i) => i.id !== id));

  const isUploading = useMemo(() => queue.some((q) => q.status === "uploading"), [queue]);

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const getReliableToken = async () => {
    // Clerk token can be briefly unavailable right after redirect; retry a few times.
    for (let i = 0; i < 6; i++) {
      const token = await getAuthToken();
      if (token) return token;
      await wait(250);
    }
    return null;
  };

  const uploadAll = async () => {
    if (isUploading) return;
    await syncUser().catch(() => {
      // Continue and let token/upload path surface concrete error.
    });

    const token = await getReliableToken();
    if (!token) {
      setQueue((prev) => prev.map((item) => ({
        ...item,
        status: item.status === "queued" ? "error" : item.status,
        progress: item.status === "queued" ? 100 : item.progress,
        message: item.status === "queued" ? "Authentication token missing. Please sign out and sign in again." : item.message
      })));
      return;
    }

    const queuedItems = queue.filter((q) => q.status === "queued" || q.status === "error");
    let latestSuccessDocId = "";
    let latestSuccessName = "";
    let latestSnapshot: RecentUploadSnapshot | null = null;
    let successCount = 0;

    for (const item of queuedItems) {
      const clearProgressTimer = () => {
        const timerId = progressTimersRef.current[item.id];
        if (timerId) {
          window.clearInterval(timerId);
          delete progressTimersRef.current[item.id];
        }
      };

      clearProgressTimer();
      setQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, status: "uploading", progress: 0, message: undefined } : q));

      progressTimersRef.current[item.id] = window.setInterval(() => {
        setQueue((prev) => prev.map((q) => {
          if (q.id !== item.id || q.status !== "uploading") return q;
          const nextProgress = Math.min(92, q.progress + (q.progress < 70 ? 6 : 3));
          return { ...q, progress: nextProgress };
        }));
      }, 200);

      try {
        const payload = await uploadDocument(item.file, token, (percent) => {
          setQueue((prev) => prev.map((q) => {
            if (q.id !== item.id) return q;
            const next = Math.min(92, Math.max(q.progress, percent));
            return { ...q, progress: next, status: "uploading" };
          }));
        });
        clearProgressTimer();
        setLastResultJson(JSON.stringify(payload.result, null, 2));
        latestSuccessDocId = payload.document?._id || latestSuccessDocId;
        latestSuccessName = item.name;
        latestSnapshot = {
          documentId: payload.document?._id || "",
          filename: payload.document?.filename || item.name,
          documentType: String(payload.result?.document_type || payload.document?.document_type || "Document"),
          confidence: Number(payload.document?.accuracy ?? payload.document?.confidence ?? 0),
          category: String(
            payload.document?.storage?.category ||
              payload.document?.classification?.category ||
              payload.document?.category ||
              "Other",
          ),
          createdAt: payload.document?.createdAt || new Date().toISOString(),
        };
        successCount += 1;
        setQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, status: "done", progress: 100, message: String(payload.result?.document_type || "Processed") } : q));
      } catch (err) {
        clearProgressTimer();
        const message = axios.isAxiosError(err)
          ? String(err.response?.data?.error || err.message || "Upload failed")
          : err instanceof Error
            ? err.message
            : "Upload failed";
        setQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, status: "error", progress: 100, message } : q));
      }
    }

    if (successCount > 0) {
      if (latestSuccessDocId) {
        localStorage.setItem(RECENT_UPLOAD_DOC_ID_KEY, latestSuccessDocId);
      }
      if (latestSnapshot) {
        localStorage.setItem(RECENT_UPLOAD_SNAPSHOT_KEY, JSON.stringify(latestSnapshot));
      }
      setRecentlyProcessedName(latestSuccessName);
      setShowFeedbackPrompt(true);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="font-heading text-3xl text-foreground tracking-wider">UPLOAD DOCUMENTS</h2>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-3 border-dashed p-12 flex flex-col items-center gap-4 transition-all duration-200 rounded-sm ${
          isDragging ? "border-primary bg-secondary" : "border-primary/40 bg-secondary/30"
        }`}
        style={{ borderWidth: '3px' }}
      >
        <div className="h-16 w-16 rounded-sm gradient-primary flex items-center justify-center">
          <CloudUpload className="h-8 w-8 text-primary-foreground" />
        </div>
        <div className="text-center">
          <p className="font-heading text-3xl text-foreground tracking-wider">DROP FILES HERE</p>
          <p className="text-muted-foreground font-body text-sm mt-1">or tap to browse</p>
          <p className="font-mono text-[10px] text-muted-foreground mt-2">PDF / JPG / PNG · MAX 25MB</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          multiple
          onChange={handleInputChange}
          className="hidden"
        />
        <button
          onClick={handleChooseFiles}
          className="mt-2 h-12 px-8 gradient-primary text-primary-foreground font-heading text-lg tracking-wider rounded-sm hover:opacity-90 active:scale-[0.97] transition-all duration-200"
        >
          <Upload className="h-4 w-4 mr-2 inline" />
          CHOOSE FILES
        </button>
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-heading text-xl text-foreground tracking-wider">UPLOAD QUEUE</h3>
          <div className="space-y-2">
            {queue.map((item) => (
              <div key={item.id} className="card-brutal flex items-center gap-4">
                <div className="h-9 w-9 rounded-sm bg-secondary flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1.5">
                    <p className="font-body text-sm font-medium text-foreground truncate">{item.name}</p>
                    <span className="font-mono text-[10px] text-muted-foreground ml-2 shrink-0">{item.size}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-sm overflow-hidden">
                    <div
                      className="h-full gradient-primary rounded-sm transition-all duration-200"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                  {item.message && (
                    <p className={`mt-1 font-mono text-[10px] ${item.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                      {item.message}
                    </p>
                  )}
                </div>
                <span className="font-mono text-xs font-semibold text-primary ml-2">{item.progress}%</span>
                {item.status === "done" && <CheckCircle2 className="h-4 w-4 text-success" />}
                {item.status === "error" && <AlertTriangle className="h-4 w-4 text-destructive" />}
                <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive transition-colors duration-200">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={uploadAll}
            disabled={queue.length === 0 || isUploading}
            className="w-full h-12 gradient-primary text-primary-foreground font-heading text-xl tracking-wider rounded-sm hover:opacity-90 active:scale-[0.97] transition-all duration-200 disabled:opacity-60"
          >
            UPLOAD ALL
          </button>
        </div>
      )}

      {lastResultJson && (
        <div className="card-brutal">
          <h3 className="font-heading text-xl text-foreground tracking-wider mb-2">LATEST MODEL OUTPUT</h3>
          <pre className="bg-background border border-border rounded-sm p-3 font-mono text-xs overflow-x-auto">
            {lastResultJson}
          </pre>
        </div>
      )}

      {showFeedbackPrompt && (
        <div className="card-brutal border-l-4 border-l-primary space-y-3">
          <p className="font-heading text-xl text-foreground tracking-wider">FEEDBACK REQUEST</p>
          <p className="font-body text-sm text-muted-foreground">
            {recentlyProcessedName
              ? `Please review classification feedback for ${recentlyProcessedName}.`
              : "Please review classification feedback for your recent upload."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate('/feedback')}
              className="h-10 px-4 gradient-primary text-primary-foreground font-mono text-xs uppercase tracking-wider rounded-sm hover:opacity-90 transition-opacity duration-200"
            >
              GIVE FEEDBACK NOW
            </button>
            <button
              onClick={() => setShowFeedbackPrompt(false)}
              className="h-10 px-4 bg-secondary text-muted-foreground hover:text-foreground font-mono text-xs uppercase tracking-wider rounded-sm transition-colors duration-200"
            >
              LATER
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
