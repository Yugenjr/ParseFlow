import { FileJson, Table, Clipboard, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const rawJson = `{
  "invoice_number": "INV-2026-0847",
  "date": "2026-03-15",
  "vendor": "Acme Solutions Pvt Ltd",
  "amount": 42500.00,
  "total": 50150.00
}`;

export default function ExportPage() {
  const { toast } = useToast();

  const copyToClipboard = () => {
    navigator.clipboard.writeText(rawJson);
    toast({ title: "COPIED", description: "Data copied to clipboard." });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="font-heading text-3xl text-foreground tracking-wider">EXPORT</h2>

      {/* Export cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card-brutal card-brutal-hover">
          <div className="flex items-center gap-3 mb-3">
            <FileJson className="h-6 w-6 text-primary" />
            <h3 className="font-heading text-xl text-foreground tracking-wider">JSON</h3>
          </div>
          <pre className="bg-background border border-border rounded-sm p-3 font-mono text-[10px] text-foreground/80 max-h-32 overflow-y-auto mb-3">
            {rawJson}
          </pre>
          <button className="w-full h-10 gradient-primary text-primary-foreground font-mono text-xs rounded-sm hover:opacity-90 transition-opacity duration-200">
            DOWNLOAD JSON
          </button>
        </div>

        <div className="card-brutal card-brutal-hover">
          <div className="flex items-center gap-3 mb-3">
            <Table className="h-6 w-6 text-success" />
            <h3 className="font-heading text-xl text-foreground tracking-wider">CSV</h3>
          </div>
          <div className="bg-background border border-border rounded-sm p-3 font-mono text-[10px] text-foreground/80 max-h-32 overflow-y-auto mb-3">
            invoice_number,date,vendor,amount{'\n'}
            INV-2026-0847,2026-03-15,Acme,42500
          </div>
          <button className="w-full h-10 bg-success text-primary-foreground font-mono text-xs rounded-sm hover:opacity-90 transition-opacity duration-200">
            DOWNLOAD CSV
          </button>
        </div>

        <div className="card-brutal card-brutal-hover">
          <div className="flex items-center gap-3 mb-3">
            <Clipboard className="h-6 w-6 text-accent" />
            <h3 className="font-heading text-xl text-foreground tracking-wider">CLIPBOARD</h3>
          </div>
          <p className="font-body text-sm text-muted-foreground mb-3">Copy all extracted data to your clipboard for quick pasting.</p>
          <button
            onClick={copyToClipboard}
            className="w-full h-10 bg-accent text-accent-foreground font-mono text-xs rounded-sm hover:opacity-90 transition-opacity duration-200"
          >
            COPY TO CLIPBOARD
          </button>
        </div>
      </div>

      {/* Integrations */}
      <div>
        <h3 className="font-heading text-xl text-foreground tracking-wider mb-3">INTEGRATIONS</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="card-brutal flex items-center justify-between">
            <div>
              <p className="font-heading text-lg text-foreground tracking-wider">GOOGLE SHEETS</p>
              <p className="font-mono text-[10px] text-muted-foreground">SYNC EXTRACTED DATA</p>
            </div>
            <button className="h-9 px-4 border border-primary text-primary font-mono text-xs rounded-sm hover:bg-secondary transition-colors duration-200 flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> CONNECT
            </button>
          </div>
          <div className="card-brutal flex items-center justify-between">
            <div>
              <p className="font-heading text-lg text-foreground tracking-wider">GOOGLE DRIVE</p>
              <p className="font-mono text-[10px] text-muted-foreground">BACKUP VAULT TO CLOUD</p>
            </div>
            <button className="h-9 px-4 border border-primary text-primary font-mono text-xs rounded-sm hover:bg-secondary transition-colors duration-200 flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> CONNECT
            </button>
          </div>
        </div>
      </div>

      {/* Export History */}
      <div>
        <h3 className="font-heading text-xl text-foreground tracking-wider mb-3">EXPORT HISTORY</h3>
        <div className="card-brutal p-0 divide-y divide-border">
          {[
            { format: 'JSON', file: 'Invoice_March.json', time: '2h ago' },
            { format: 'CSV', file: 'All_Documents.csv', time: '1d ago' },
            { format: 'JSON', file: 'Aadhaar_Extract.json', time: '3d ago' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="font-body text-sm text-foreground">{item.file}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{item.time}</p>
              </div>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-sm bg-secondary text-primary">{item.format}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
