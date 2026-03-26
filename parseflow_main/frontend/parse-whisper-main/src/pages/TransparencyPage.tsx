import { ArrowRight } from "lucide-react";

const pipelineSteps = [
  { label: 'UPLOAD', time: '120ms' },
  { label: 'OCR', time: '450ms' },
  { label: 'PRE-PROCESS', time: '80ms' },
  { label: 'CLASSIFY', time: '340ms' },
  { label: 'EXTRACT', time: '257ms' },
];

export default function TransparencyPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <h2 className="font-heading text-3xl text-foreground tracking-wider">TRANSPARENCY</h2>

      {/* Pipeline Flowchart */}
      <div>
        <h3 className="font-heading text-xl text-foreground tracking-wider mb-3">PIPELINE FLOWCHART</h3>
        <div className="card-brutal overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {pipelineSteps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-2">
                <div className="bg-secondary border border-border rounded-sm px-4 py-3 text-center">
                  <p className="font-heading text-lg text-foreground tracking-wider">{step.label}</p>
                  <p className="font-mono text-[10px] text-primary">{step.time}</p>
                </div>
                {i < pipelineSteps.length - 1 && (
                  <ArrowRight className="h-5 w-5 text-primary shrink-0" />
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 font-mono text-xs text-muted-foreground">
            TOTAL: {pipelineSteps.reduce((s, p) => s + parseInt(p.time), 0)}ms | HIGHLIGHTED PATH: OCR → LLM CLASSIFICATION
          </div>
        </div>
      </div>

      {/* Metrics Gauges */}
      <div>
        <h3 className="font-heading text-xl text-foreground tracking-wider mb-3">METRICS</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { label: 'PROCESSING TIME', value: '1,247ms', bar: 62 },
            { label: 'OCR CONFIDENCE', value: '96%', bar: 96 },
            { label: 'CLASSIFICATION', value: '97%', bar: 97 },
          ].map(m => (
            <div key={m.label} className="card-brutal">
              <p className="font-mono text-[10px] text-muted-foreground uppercase mb-2">{m.label}</p>
              <p className="font-heading text-3xl text-primary mb-2">{m.value}</p>
              <div className="h-2 bg-muted rounded-sm overflow-hidden">
                <div className="h-full gradient-primary rounded-sm" style={{ width: `${m.bar}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reasoning */}
      <div>
        <h3 className="font-heading text-xl text-foreground tracking-wider mb-3">AI REASONING</h3>
        <div className="card-brutal">
          <p className="font-body text-sm text-foreground leading-relaxed">
            The document was classified as an <strong>Invoice</strong> based on the following signals:
          </p>
          <ul className="mt-3 space-y-2 font-body text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary font-mono">01.</span> Presence of "Invoice" keyword in header region (OCR confidence: 98%)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-mono">02.</span> Structured table with line items, quantities, and amounts detected
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-mono">03.</span> GST/Tax number pattern matched (GSTIN format validated)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-mono">04.</span> LLM cross-validation confirmed document type with 97% confidence
            </li>
          </ul>
        </div>
      </div>

      {/* Model Details */}
      <div>
        <h3 className="font-heading text-xl text-foreground tracking-wider mb-3">MODEL DETAILS</h3>
        <div className="card-brutal p-0 divide-y divide-border font-mono text-xs">
          {[
            { key: 'OCR ENGINE', value: 'Tesseract v5.3' },
            { key: 'CLASSIFICATION MODEL', value: 'ParseFlow-Classify-v2' },
            { key: 'EXTRACTION MODEL', value: 'ParseFlow-Extract-v1' },
            { key: 'API VERSION', value: 'v2.1.0' },
            { key: 'TOKEN COUNT', value: '2,847 tokens' },
            { key: 'COST', value: '$0.0042' },
          ].map((item, i) => (
            <div key={item.key} className={`flex justify-between px-5 py-3 ${i % 2 === 0 ? 'bg-secondary/30' : ''}`}>
              <span className="text-muted-foreground">{item.key}</span>
              <span className="text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
