import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Volume2, VolumeX, Bot, Send, X, Loader2, Mic, MicOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { askGuideBot, type GuideBotMessage } from "@/lib/guidebot-api";

interface Message extends GuideBotMessage {}

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

type SpeechRecognitionErrorEvent = {
  error: string;
};

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

export function ChatPanel() {
  const { user, getAuthToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "GuideBot is ready. I can walk you through Upload, Documents, History, Export, folder classification, and basic UI actions.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [listeningHint, setListeningHint] = useState("");
  const [lastAssistantReply, setLastAssistantReply] = useState("");
  const [buttonPos, setButtonPos] = useState({ x: 0, y: 0 });
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const transcriptBaseRef = useRef("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ pointerX: 0, pointerY: 0, originX: 0, originY: 0 });
  const hasMovedRef = useRef(false);

  const BUTTON_SIZE = 56;
  const BUTTON_MARGIN = 24;

  const clampButtonPosition = (x: number, y: number) => {
    const maxX = Math.max(BUTTON_MARGIN, window.innerWidth - BUTTON_SIZE - BUTTON_MARGIN);
    const maxY = Math.max(BUTTON_MARGIN, window.innerHeight - BUTTON_SIZE - BUTTON_MARGIN);
    return {
      x: Math.min(Math.max(x, BUTTON_MARGIN), maxX),
      y: Math.min(Math.max(y, BUTTON_MARGIN), maxY),
    };
  };

  const positionButtonBottomRight = () => {
    setButtonPos({
      x: Math.max(BUTTON_MARGIN, window.innerWidth - BUTTON_SIZE - BUTTON_MARGIN),
      y: Math.max(BUTTON_MARGIN, window.innerHeight - BUTTON_SIZE - BUTTON_MARGIN),
    });
  };

  useEffect(() => {
    positionButtonBottomRight();

    const onResize = () => {
      setButtonPos((prev) => clampButtonPosition(prev.x, prev.y));
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setSpeechEnabled(typeof window !== "undefined" && "speechSynthesis" in window);

    const speechWindow = window as SpeechRecognitionWindow;
    const SpeechRecognitionCtor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    setMicEnabled(Boolean(SpeechRecognitionCtor));
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += `${piece} `;
        } else {
          interim += piece;
        }
      }

      if (finalText.trim()) {
        const nextBase = `${transcriptBaseRef.current} ${finalText}`.trim();
        transcriptBaseRef.current = nextBase;
      }

      const composed = `${transcriptBaseRef.current} ${interim}`.trim();
      setInput(composed);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setListeningHint("Mic input failed. Try again.");
    };

    recognition.onend = () => {
      setIsListening(false);
      setListeningHint("");
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // no-op
      }
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
      setIsListening(false);
      setListeningHint("");
      return;
    }

    try {
      transcriptBaseRef.current = input.trim();
      recognition.start();
      setIsListening(true);
      setListeningHint("Listening... your voice will appear in the text box.");
    } catch {
      setIsListening(false);
      setListeningHint("Could not start mic.");
    }
  };

  const stopSpeaking = () => {
    if (speechEnabled) {
      window.speechSynthesis.cancel();
    }
  };

  const handleTogglePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();

    dragStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      originX: buttonPos.x,
      originY: buttonPos.y,
    };
    hasMovedRef.current = false;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - dragStartRef.current.pointerX;
      const dy = moveEvent.clientY - dragStartRef.current.pointerY;

      if (!hasMovedRef.current && Math.hypot(dx, dy) > 4) {
        hasMovedRef.current = true;
      }

      const next = clampButtonPosition(
        dragStartRef.current.originX + dx,
        dragStartRef.current.originY + dy,
      );
      setButtonPos(next);
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      if (!hasMovedRef.current) {
        setIsOpen(true);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const speakText = (text: string) => {
    if (!speechEnabled || !text.trim()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage: Message = { role: "user", text: input.trim() };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setIsSending(true);

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error("Authentication token missing. Please sign in again.");
      }

      const reply = await askGuideBot(nextMessages, token);
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
      setLastAssistantReply(reply);

      if (autoSpeak) {
        speakText(reply);
      }
    } catch (error) {
      const errorText = error instanceof Error ? error.message : "GuideBot could not respond right now.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `I hit an issue: ${errorText}. Please check GuideBot env settings and try again.`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Toggle Button */}
      {!isOpen && (
        <button
          onPointerDown={handleTogglePointerDown}
          style={{ left: `${buttonPos.x}px`, top: `${buttonPos.y}px` }}
          className="fixed z-50 h-14 w-14 gradient-primary rounded-full flex items-center justify-center text-primary-foreground font-heading text-2xl shadow-card hover:opacity-90 transition-opacity duration-200 touch-none"
          aria-label="Open GuideBot"
        >
          <Bot className="h-7 w-7" />
        </button>
      )}

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-1.5rem)] h-[520px] bg-card border border-border rounded-sm shadow-card-hover flex flex-col">
          {/* Header */}
          <div className="flex items-center border-b border-border">
            <div className="flex-1 h-10 font-mono text-xs uppercase tracking-wider flex items-center px-3 gap-2">
              <span className="h-6 px-2 rounded-sm gradient-primary text-primary-foreground inline-flex items-center">GuideBot</span>
            </div>
            <div className="h-10 px-1 flex items-center gap-1">
              <button
                onClick={() => setAutoSpeak((v) => !v)}
                disabled={!speechEnabled}
                className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors duration-200"
                title={speechEnabled ? (autoSpeak ? "Disable voice output" : "Enable voice output") : "Speech not supported in this browser"}
                aria-label={autoSpeak ? "Disable voice output" : "Enable voice output"}
              >
                {autoSpeak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors duration-200"
                aria-label="Close GuideBot"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-sm font-body text-sm whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "gradient-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-3 py-2 rounded-sm font-body text-sm bg-secondary text-foreground inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-2 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-1">
              <span>No personal details will be included</span>
              <button
                onClick={() => speakText(lastAssistantReply)}
                disabled={!speechEnabled || !lastAssistantReply}
                className="hover:text-foreground disabled:opacity-40"
              >
                Replay Voice
              </button>
            </div>
            {listeningHint && (
              <p className="px-1 text-[10px] font-mono uppercase tracking-wider text-primary">{listeningHint}</p>
            )}
            <div className="grid grid-cols-[auto,1fr,80px] gap-2 items-stretch">
              <button
                onClick={toggleListening}
                disabled={!micEnabled || isSending}
                className="h-full min-h-9 px-2 border border-border text-muted-foreground rounded-sm hover:text-foreground transition-colors duration-200 disabled:opacity-40 inline-flex items-center justify-center"
                title={micEnabled ? (isListening ? "Stop microphone input" : "Start microphone input") : "Speech recognition not supported in this browser"}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="h-9 px-3 bg-background border border-border rounded-sm font-body text-sm text-foreground focus:outline-none focus:border-primary transition-colors duration-200"
                placeholder="Speak or type your question..."
                disabled={isSending}
              />
              <div className="grid grid-rows-2 gap-1">
                <button
                  onClick={() => {
                    void handleSend();
                  }}
                  className="h-full px-2 gradient-primary text-primary-foreground font-mono text-[10px] rounded-sm hover:opacity-90 transition-opacity duration-200 disabled:opacity-60 inline-flex items-center justify-center gap-1"
                  disabled={isSending || !input.trim()}
                >
                  <Send className="h-3 w-3" /> Send
                </button>
                <button
                  onClick={stopSpeaking}
                  disabled={!speechEnabled}
                  className="h-full px-2 border border-border text-muted-foreground rounded-sm hover:text-foreground transition-colors duration-200 disabled:opacity-40 text-[10px] font-mono uppercase"
                  title="Stop voice output"
                >
                  Stop Voice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
