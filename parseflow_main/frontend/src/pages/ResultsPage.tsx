import { CreditCard, Copy, ChevronDown, Bot, ScanText, Info } from "lucide-react";
import { useState } from "react";

const extractedFields = [
  { label: "Invoice Number", value: "INV-2026-0847" },
  { label: "Date", value: "March 15, 2026" },
  { label: "Vendor", value: "Acme Solutions Pvt Ltd" },
  { label: "Amount", value: "₹42,500.00" },
  { label: "Tax (GST)", value: "₹7,650.00" },
  { label: "Total", value: "₹50,150.00" },
];

const rawJson = `{
  "invoice_number": "INV-2026-0847",
  "date": "2026-03-15",
  "vendor": "Acme Solutions Pvt Ltd",
  "amount": 42500.00,
  "tax_gst": 7650.00,
  "total": 50150.00,
  "confidence": 0.97
}`;

export default function ResultsPage() {
  const [viewMode, setViewMode] = useState<"structured" | "raw">("structured");
  const [showDebug, setShowDebug] = useState(false);

  const copyText = (text: string) => navigator.clipboard.writeText(text);

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="font-heading text-3xl text-foreground tracking-wider">RESULTS</h2>

      {/* Classification Card */}
      <div className="card-brutal border-l-[6px] border-l-primary">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-sm bg-secondary flex items-center justify-center shrink-0 text-2xl">
            🪪
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-heading text-2xl text-foreground tracking-wider">AADHAAR CARD</h3>
              <span className="font-mono text-xs px-2 py-0.5 rounded-sm bg-success/10 text-success">87% ▓▓▓▓░░</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-sm font-mono text-[10px] bg-secondary text-primary">
                <Bot className="h-3 w-3" /> AI MODEL
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-sm font-mono text-[10px] bg-accent/10 text-accent">
                <ScanText className="h-3 w-3" /> OCR+LLM
              </span>
            </div>
          </div>
          <button className="text-muted-foreground hover:text-foreground transition-colors duration-200">
            <Info className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Extracted Data */}
      <div className="card-brutal p-0">
        <div className="flex items-center border-b border-border">
          <button
            onClick={() => setViewMode("structured")}
            className={`h-10 px-4 font-mono text-xs uppercase tracking-wider transition-colors duration-200 ${
              viewMode === "structured" ? "gradient-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Structured
          </button>
          <button
            onClick={() => setViewMode("raw")}
            className={`h-10 px-4 font-mono text-xs uppercase tracking-wider transition-colors duration-200 ${
              viewMode === "raw" ? "gradient-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Raw JSON
          </button>
        </div>

        {viewMode === "structured" ? (
          <div className="divide-y divide-border">
            {extractedFields.map((f, i) => (
              <div key={f.label} className={`flex items-center justify-between px-5 py-3.5 ${i % 2 === 0 ? "bg-secondary/30" : ""}`}>
                <span className="font-mono text-xs text-muted-foreground uppercase">{f.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-body text-sm font-medium text-foreground">{f.value}</span>
                  <button onClick={() => copyText(f.value)} className="text-muted-foreground hover:text-primary transition-colors duration-200">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4">
            <pre className="bg-background border border-border rounded-sm p-4 font-mono text-sm text-foreground overflow-x-auto">
              {rawJson}
            </pre>
            <button onClick={() => copyText(rawJson)} className="mt-2 flex items-center gap-1 font-mono text-xs text-primary hover:underline">
              <Copy className="h-3.5 w-3.5" /> COPY ALL
            </button>
          </div>
        )}
      </div>

      {/* Debug Panel */}
      <button
        onClick={() => setShowDebug(!showDebug)}
        className="flex items-center gap-2 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 uppercase tracking-wider"
      >
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showDebug ? "rotate-180" : ""}`} />
        DEBUG & PIPELINE INFO
      </button>
      {showDebug && (
        <div className="card-brutal space-y-4">
          <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-3">AI PATH → OCR → LLM</div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "PIPELINE TIME", value: "1,247ms" },
              { label: "OCR CONFIDENCE", value: "96%" },
              { label: "CLASSIFICATION", value: "97%" },
            ].map((m) => (
              <div key={m.label} className="text-center p-3 bg-secondary rounded-sm">
                <p className="font-heading text-2xl text-primary">{m.value}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>
          <div className="bg-background border border-border rounded-sm p-3">
            <p className="font-mono text-[10px] text-muted-foreground uppercase mb-1">RAW OCR DUMP</p>
            <pre className="font-mono text-xs text-foreground/80 max-h-32 overflow-y-auto">
              INVOICE NUMBER: INV-2026-0847{'\n'}DATE: 15/03/2026{'\n'}VENDOR: Acme Solutions Pvt Ltd{'\n'}SUBTOTAL: 42,500.00{'\n'}GST@18%: 7,650.00{'\n'}TOTAL: 50,150.00
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
