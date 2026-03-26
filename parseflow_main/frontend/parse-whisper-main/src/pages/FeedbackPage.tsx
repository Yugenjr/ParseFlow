import { useState } from "react";
import { Check, Edit, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const categories = ["Identity", "Financial", "Legal", "Compliance", "Tax", "Business"];

export default function FeedbackPage() {
  const [feedback, setFeedback] = useState<'correct' | 'edit' | 'wrong' | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("Financial");
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  const handleSubmit = () => {
    toast({ title: "FEEDBACK SUBMITTED", description: "Thank you for improving our AI model." });
    setFeedback(null);
    setNotes("");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="font-heading text-3xl text-foreground tracking-wider">FEEDBACK</h2>

      {/* Document context */}
      <div className="card-brutal border-l-4 border-l-primary">
        <p className="font-mono text-xs text-muted-foreground uppercase mb-1">LAST CLASSIFICATION</p>
        <p className="font-heading text-2xl text-foreground tracking-wider">INVOICE — 97% CONFIDENCE</p>
        <p className="font-mono text-xs text-muted-foreground">Invoice_March_2026.pdf</p>
      </div>

      {/* Feedback buttons */}
      <div>
        <p className="font-heading text-xl text-foreground tracking-wider mb-3">WAS THIS CORRECT?</p>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => { setFeedback('correct'); handleSubmit(); }}
            className={`card-brutal card-brutal-hover flex flex-col items-center gap-2 py-4 ${feedback === 'correct' ? 'border-success border-2' : ''}`}
          >
            <Check className="h-6 w-6 text-success" />
            <span className="font-heading text-lg text-success tracking-wider">CORRECT</span>
          </button>
          <button
            onClick={() => setFeedback('edit')}
            className={`card-brutal card-brutal-hover flex flex-col items-center gap-2 py-4 ${feedback === 'edit' ? 'border-warning border-2' : ''}`}
          >
            <Edit className="h-6 w-6 text-warning" />
            <span className="font-heading text-lg text-warning tracking-wider">EDIT</span>
          </button>
          <button
            onClick={() => setFeedback('wrong')}
            className={`card-brutal card-brutal-hover flex flex-col items-center gap-2 py-4 ${feedback === 'wrong' ? 'border-destructive border-2' : ''}`}
          >
            <X className="h-6 w-6 text-destructive" />
            <span className="font-heading text-lg text-destructive tracking-wider">WRONG</span>
          </button>
        </div>
      </div>

      {/* Edit/Wrong form */}
      {(feedback === 'edit' || feedback === 'wrong') && (
        <div className="card-brutal space-y-4">
          <p className="font-heading text-xl text-foreground tracking-wider">CORRECT CATEGORY</p>
          <div className="grid grid-cols-3 gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`py-2 px-3 rounded-sm font-mono text-xs uppercase tracking-wider transition-all duration-200 ${
                  selectedCategory === cat ? 'gradient-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div>
            <label className="font-mono text-xs text-muted-foreground uppercase tracking-wider block mb-1">NOTES</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full h-24 p-3 bg-background border border-border rounded-sm font-body text-sm text-foreground focus:outline-none focus:border-primary resize-none transition-colors duration-200"
              placeholder="Additional feedback..."
            />
          </div>

          <button
            onClick={handleSubmit}
            className="w-full h-12 gradient-primary text-primary-foreground font-heading text-xl tracking-wider rounded-sm hover:opacity-90 active:scale-[0.97] transition-all duration-200"
          >
            SUBMIT FEEDBACK
          </button>
        </div>
      )}
    </div>
  );
}
