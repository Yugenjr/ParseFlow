import { useMemo, useState } from "react";
import { Clipboard, FileJson, FileText, Loader2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

type OutputMode = "text" | "json";

interface ExtractedPage {
  page: number;
  text: string;
}

export default function ExportPage() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<OutputMode | null>(null);
  const [result, setResult] = useState<string>("");

  const fileInfo = useMemo(() => {
    if (!file) return "No file selected";
    const kb = (file.size / 1024).toFixed(1);
    return `${file.name} (${kb} KB)`;
  }, [file]);

  const readPdfPages = async (pdfFile: File): Promise<ExtractedPage[]> => {
    const data = await pdfFile.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data }).promise;
    const pages: ExtractedPage[] = [];

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      pages.push({ page: pageNumber, text });
    }

    return pages;
  };

  const convertToText = async () => {
    if (!file) {
      toast({ title: "NO FILE", description: "Please select a PDF file first." });
      return;
    }
    if (file.type !== "application/pdf") {
      toast({ title: "INVALID FILE", description: "Only PDF files are supported." });
      return;
    }

    setLoading(true);
    setMode("text");
    try {
      const pages = await readPdfPages(file);
      const textOutput = pages.map((p) => `--- Page ${p.page} ---\n${p.text || "[No text found]"}`).join("\n\n");
      setResult(textOutput);
      toast({ title: "DONE", description: "PDF converted to text." });
    } catch (error) {
      setResult("");
      setMode(null);
      toast({ title: "CONVERSION FAILED", description: error instanceof Error ? error.message : "Could not parse this PDF." });
    } finally {
      setLoading(false);
    }
  };

  const convertToJson = async () => {
    if (!file) {
      toast({ title: "NO FILE", description: "Please select a PDF file first." });
      return;
    }
    if (file.type !== "application/pdf") {
      toast({ title: "INVALID FILE", description: "Only PDF files are supported." });
      return;
    }

    setLoading(true);
    setMode("json");
    try {
      const pages = await readPdfPages(file);
      const output = {
        filename: file.name,
        sizeBytes: file.size,
        extractedAt: new Date().toISOString(),
        pageCount: pages.length,
        pages,
      };
      setResult(JSON.stringify(output, null, 2));
      toast({ title: "DONE", description: "PDF converted to JSON." });
    } catch (error) {
      setResult("");
      setMode(null);
      toast({ title: "CONVERSION FAILED", description: error instanceof Error ? error.message : "Could not parse this PDF." });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!result) {
      toast({ title: "NOTHING TO COPY", description: "Convert a PDF first." });
      return;
    }
    await navigator.clipboard.writeText(result);
    toast({ title: "COPIED", description: "Output copied to clipboard." });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <h2 className="font-heading text-3xl text-foreground tracking-wider">EXPORT</h2>

      <div className="card-brutal space-y-4">
        <div className="flex items-center gap-3">
          <Upload className="h-5 w-5 text-primary" />
          <h3 className="font-heading text-xl text-foreground tracking-wider">LOCAL PDF CONVERTER</h3>
        </div>

        <p className="font-body text-sm text-muted-foreground">
          Select a PDF from your system, then convert it to plain text or JSON. Output is shown only in this UI and not stored.
        </p>

        <label className="block">
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              const next = e.target.files?.[0] ?? null;
              setFile(next);
              setResult("");
              setMode(null);
            }}
            className="block w-full rounded-sm border border-border bg-background px-3 py-2 font-body text-sm text-foreground file:mr-3 file:rounded-sm file:border-0 file:bg-primary file:px-3 file:py-1 file:font-mono file:text-xs file:text-primary-foreground"
          />
        </label>

        <p className="font-mono text-xs text-muted-foreground">{fileInfo}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={convertToText}
            disabled={loading}
            className="h-11 rounded-sm border border-primary text-primary font-mono text-xs hover:bg-secondary transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && mode === "text" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            TO TEXT
          </button>

          <button
            onClick={convertToJson}
            disabled={loading}
            className="h-11 rounded-sm border border-primary text-primary font-mono text-xs hover:bg-secondary transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && mode === "json" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
            TO JSON
          </button>

          <button
            onClick={copyToClipboard}
            disabled={loading || !result}
            className="h-11 rounded-sm gradient-primary text-primary-foreground font-mono text-xs hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Clipboard className="h-4 w-4" />
            COPY OUTPUT
          </button>
        </div>
      </div>

      <div className="card-brutal">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading text-xl text-foreground tracking-wider">OUTPUT</h3>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-sm bg-secondary text-primary uppercase">
            {mode ? mode : "idle"}
          </span>
        </div>

        <pre className="w-full min-h-[380px] max-h-[65vh] overflow-auto rounded-sm border border-border bg-background p-3 font-mono text-xs text-foreground whitespace-pre-wrap break-words">
          {result || "No output yet. Select a PDF and choose TO TEXT or TO JSON."}
        </pre>
      </div>
    </div>
  );
}
