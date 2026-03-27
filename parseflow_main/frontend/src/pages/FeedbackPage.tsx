import { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserDocuments, type BackendDocument } from "@/lib/backend-api";

const FEEDBACK_LOG_KEY = "parseflow_feedback_log";
const HANDLED_TOP_DOC_ID_KEY = "parseflow_feedback_handled_top_doc_id";

type FeedbackChoice = "correct" | "wrong";

interface StoredFeedback {
  documentId: string;
  feedback: FeedbackChoice;
  originalCategory: string;
  correctedCategory: string;
  notes: string;
  createdAt: string;
}

interface FeedbackTarget {
  id: string;
  filename: string;
  documentType: string;
  confidence: number;
  category: string;
}

function getDocCategory(doc: BackendDocument): string {
  return doc.storage?.category || doc.classification?.category || doc.category || "Other";
}

function getDocType(doc: BackendDocument): string {
  return doc.classification?.document_type || doc.document_type || "Document";
}

function getDocConfidence(doc: BackendDocument): number {
  const raw = Number(doc.classification?.accuracy ?? doc.classification?.confidence ?? doc.accuracy ?? doc.confidence ?? 0);
  if (Number.isNaN(raw)) return 0;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export default function FeedbackPage() {
  const { user, getAuthToken } = useAuth();
  const { toast } = useToast();
  const [docs, setDocs] = useState<BackendDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [handledTopDocId, setHandledTopDocId] = useState<string>(() => localStorage.getItem(HANDLED_TOP_DOC_ID_KEY) || "");

  useEffect(() => {
    const loadDocs = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const token = await getAuthToken();
        if (!token) {
          setDocs([]);
          return;
        }
        const backendDocs = await fetchUserDocuments(token);
        const sorted = backendDocs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setDocs(sorted);
      } catch {
        setDocs([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadDocs();
  }, [user, getAuthToken]);

  const target = useMemo<FeedbackTarget | null>(() => {
    if (!docs.length) return null;

    const latestDoc = docs.reduce((latest, current) => {
      const latestTs = new Date(latest.createdAt).getTime();
      const currentTs = new Date(current.createdAt).getTime();
      return currentTs > latestTs ? current : latest;
    }, docs[0]);

    const latestTarget: FeedbackTarget = {
      id: latestDoc._id,
      filename: latestDoc.filename,
      documentType: getDocType(latestDoc),
      confidence: getDocConfidence(latestDoc),
      category: getDocCategory(latestDoc),
    };

    if (handledTopDocId && handledTopDocId === latestTarget.id) {
      return null;
    }

    return latestTarget;
  }, [docs, handledTopDocId]);

  const handleSubmit = (choice: FeedbackChoice) => {
    if (!target) return;

    const payload: StoredFeedback = {
      documentId: target.id,
      feedback: choice,
      originalCategory: target.category,
      correctedCategory: target.category,
      notes: choice === "wrong" ? "Marked as wrong" : "Marked as correct",
      createdAt: new Date().toISOString(),
    };

    try {
      const current = localStorage.getItem(FEEDBACK_LOG_KEY);
      const parsed = current ? (JSON.parse(current) as StoredFeedback[]) : [];
      const next = [payload, ...parsed].slice(0, 100);
      localStorage.setItem(FEEDBACK_LOG_KEY, JSON.stringify(next));
      localStorage.setItem(HANDLED_TOP_DOC_ID_KEY, target.id);
      setHandledTopDocId(target.id);
    } catch {
      // Ignore storage errors and keep UX responsive.
    }

    toast({ title: "FEEDBACK SUBMITTED", description: "Thank you for improving our AI model." });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="font-heading text-3xl text-foreground tracking-wider">FEEDBACK</h2>

      {isLoading ? (
        <div className="card-brutal border-l-4 border-l-primary">
          <p className="font-mono text-xs text-muted-foreground uppercase">Loading latest upload...</p>
        </div>
      ) : target ? (
        <>
          <div className="card-brutal border-l-4 border-l-primary">
            <p className="font-mono text-xs text-muted-foreground uppercase mb-1">LAST CLASSIFIED</p>
            <p className="font-heading text-2xl text-foreground tracking-wider">
              {target.documentType.toUpperCase()} - {target.confidence}% CONFIDENCE
            </p>
            <p className="font-mono text-xs text-muted-foreground">{target.filename}</p>
            <p className="font-mono text-xs text-muted-foreground mt-1">Detected category: {target.category}</p>
          </div>

          <div>
            <p className="font-heading text-xl text-foreground tracking-wider mb-3">WAS THIS CORRECT?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleSubmit("correct")}
                className="card-brutal card-brutal-hover flex flex-col items-center gap-2 py-4"
              >
                <Check className="h-6 w-6 text-success" />
                <span className="font-heading text-lg text-success tracking-wider">CORRECT</span>
              </button>
              <button
                onClick={() => handleSubmit("wrong")}
                className="card-brutal card-brutal-hover flex flex-col items-center gap-2 py-4"
              >
                <X className="h-6 w-6 text-destructive" />
                <span className="font-heading text-lg text-destructive tracking-wider">WRONG</span>
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="card-brutal border-l-4 border-l-primary">
          <p className="font-mono text-xs text-muted-foreground uppercase mb-1">NO PENDING FEEDBACK</p>
          <p className="font-body text-sm text-muted-foreground">
            Feedback for the current top history document is already submitted. A new top document will appear here automatically.
          </p>
        </div>
      )}
    </div>
  );
}
