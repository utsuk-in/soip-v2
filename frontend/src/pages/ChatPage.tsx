import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Send, PanelLeftClose, PanelLeft, Plus } from "lucide-react";
import { sendChatMessage, getChatSessions, getChatSession, type ChatMessage, type ChatSession, type Opportunity } from "../lib/api";
import ChatBubble, { TypingIndicator } from "../components/ChatBubble";

const SUGGESTED_PROMPTS = [
  "What hackathons are coming up?",
  "Show me AI internships",
  "Fellowships for engineering students",
  "What should I explore based on my skills?",
];

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citedOpportunities?: Opportunity[];
}

export default function ChatPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getChatSessions().then(setSessions).catch(() => {});
  }, []);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      setInput(q);
      setActiveSessionId(undefined);
      setMessages([]);
    }
  }, [searchParams]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const loadSession = async (id: string) => {
    setActiveSessionId(id);
    try {
      const detail = await getChatSession(id);
      setMessages(
        detail.messages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
        }))
      );
    } catch {
      setMessages([]);
    }
  };

  const handleSend = async (text?: string) => {
    const message = text || input.trim();
    if (!message || sending) return;
    setInput("");

    const userMsg: DisplayMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: message,
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await sendChatMessage(message, activeSessionId);
      setActiveSessionId(res.session_id);

      const assistantMsg: DisplayMessage = {
        id: res.message.id,
        role: "assistant",
        content: res.message.content,
        citedOpportunities: res.cited_opportunities,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      getChatSessions().then(setSessions).catch(() => {});
    } catch (err: any) {
      const errMsg: DisplayMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
    }
  };

  const startNew = () => {
    setActiveSessionId(undefined);
    setMessages([]);
    setInput("");
  };

  const isEmpty = messages.length === 0 && !sending;

  return (
    <div className="flex h-full">
      {/* Session sidebar */}
      {sidebarOpen && (
        <aside className="w-64 bg-surface border-r border-line flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-line-light flex items-center justify-between">
            <button
              onClick={startNew}
              className="flex items-center gap-2 px-3 py-2 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 rounded-lg text-sm font-medium hover:bg-brand-100 dark:hover:bg-brand-900/40 flex-1"
            >
              <Plus size={16} /> New chat
            </button>
            <button onClick={() => setSidebarOpen(false)} className="ml-2 p-1.5 text-content-muted hover:text-content-secondary">
              <PanelLeftClose size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-0.5">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => loadSession(s.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${
                  s.id === activeSessionId
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 font-medium"
                    : "text-content-secondary hover:bg-hover"
                }`}
              >
                {s.title || "Untitled"}
              </button>
            ))}
            {sessions.length === 0 && (
              <p className="text-xs text-content-muted text-center py-4">No conversations yet</p>
            )}
          </div>
        </aside>
      )}

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toggle sidebar button */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute left-0 top-1/2 z-10 p-1.5 bg-surface border border-line rounded-r-lg text-content-muted hover:text-content-secondary"
          >
            <PanelLeft size={16} />
          </button>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300 flex items-center justify-center mb-4">
                <Send size={28} />
              </div>
              <h2 className="text-xl font-semibold text-content mb-2">Ask SOIP anything</h2>
              <p className="text-content-tertiary mb-8 max-w-md">
                Get personalized opportunity recommendations powered by AI.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    className="px-4 py-3 bg-surface border border-line rounded-xl text-sm text-content-secondary hover:border-brand-300 hover:shadow-sm transition-all text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <ChatBubble
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  citedOpportunities={msg.citedOpportunities}
                  onOpportunityClick={(id) => navigate(`/browse/${id}`)}
                />
              ))}
              {sending && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-line bg-surface p-4">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-3 max-w-3xl mx-auto"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about opportunities..."
              disabled={sending}
              className="flex-1 px-4 py-3 border border-line rounded-xl text-sm bg-surface text-content placeholder:text-content-muted focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="px-4 py-3 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-40"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
