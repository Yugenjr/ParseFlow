import { CloudUpload, Search, Tag, FileSpreadsheet, Check } from "lucide-react";

const steps = [
  { icon: CloudUpload, label: "UPLOADING", pct: 100 },
  { icon: Search, label: "ANALYZING", pct: 73 },
  { icon: Tag, label: "CLASSIFYING", pct: 0 },
  { icon: FileSpreadsheet, label: "EXTRACTING", pct: 0 },
];

export default function ProcessingPage() {
  const activeStep = 1;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <h2 className="font-heading text-3xl text-foreground text-center tracking-wider">PROCESSING DOCUMENT</h2>

      {/* Circular Progress */}
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="relative h-36 w-36">
          <svg className="h-36 w-36 -rotate-90" viewBox="0 0 144 144">
            <circle cx="72" cy="72" r="60" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
            <circle
              cx="72" cy="72" r="60" fill="none"
              stroke="url(#gradProgress)" strokeWidth="8"
              strokeLinecap="butt"
              strokeDasharray={`${2 * Math.PI * 60}`}
              strokeDashoffset={`${2 * Math.PI * 60 * (1 - 0.73)}`}
              className="transition-all duration-200"
            />
            <defs>
              <linearGradient id="gradProgress" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(253 91% 64%)" />
                <stop offset="100%" stopColor="hsl(197 100% 50%)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-heading text-4xl text-foreground">73%</span>
          </div>
        </div>
        <p className="font-mono text-xs text-muted-foreground">invoice-2026-03.pdf</p>
      </div>

      {/* Terminal Stepper */}
      <div className="card-brutal font-mono text-sm p-0">
        {steps.map((step, i) => {
          const isDone = i < activeStep;
          const isActive = i === activeStep;

          return (
            <div key={step.label} className={`flex items-center gap-4 px-5 py-4 border-b border-border last:border-0 ${isActive ? 'bg-secondary' : ''}`}>
              <div className={`h-8 w-8 rounded-sm flex items-center justify-center shrink-0 ${
                isDone ? 'bg-success text-primary-foreground' :
                isActive ? 'gradient-primary text-primary-foreground animate-pulse-ring' :
                'border border-muted text-muted-foreground'
              }`}>
                {isDone ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
              </div>
              <span className={`flex-1 uppercase tracking-wider ${isActive ? 'text-foreground font-semibold' : isDone ? 'text-success' : 'text-muted-foreground'}`}>
                {isDone ? '✓' : isActive ? '█' : '□'} {step.label}
              </span>
              <span className="text-muted-foreground">
                {isDone ? '100%' : isActive ? `${step.pct}%` : '—'}
              </span>
              {i < steps.length - 1 && <span className="text-muted-foreground/40">──</span>}
            </div>
          );
        })}
      </div>

      {/* Skeleton */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-muted rounded-sm shimmer" />
        ))}
      </div>
    </div>
  );
}
