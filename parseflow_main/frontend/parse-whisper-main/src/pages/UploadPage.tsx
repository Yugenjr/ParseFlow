import { Upload, CloudUpload, X, FileText } from "lucide-react";
import { useState, useCallback } from "react";

interface QueueItem {
  id: string;
  name: string;
  size: string;
  progress: number;
}

export default function UploadPage() {
  const [queue, setQueue] = useState<QueueItem[]>([
    { id: "1", name: "Invoice_March.pdf", size: "2.4 MB", progress: 75 },
    { id: "2", name: "ID_Card_Front.jpg", size: "1.1 MB", progress: 30 },
  ]);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const removeItem = (id: string) => setQueue((q) => q.filter((i) => i.id !== id));

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="font-heading text-3xl text-foreground tracking-wider">UPLOAD DOCUMENTS</h2>

      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDragLeave}
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
        <button className="mt-2 h-12 px-8 gradient-primary text-primary-foreground font-heading text-lg tracking-wider rounded-sm hover:opacity-90 active:scale-[0.97] transition-all duration-200">
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
                </div>
                <span className="font-mono text-xs font-semibold text-primary ml-2">{item.progress}%</span>
                <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive transition-colors duration-200">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button className="w-full h-12 gradient-primary text-primary-foreground font-heading text-xl tracking-wider rounded-sm hover:opacity-90 active:scale-[0.97] transition-all duration-200">
            UPLOAD ALL
          </button>
        </div>
      )}
    </div>
  );
}
