import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Send, PanelLeftClose, PanelLeft, Plus, Sparkles } from "lucide-react";
import { sendChatMessage, getChatSessions, getChatSession, type ChatMessage, type ChatSession, type Opportunity } from "../lib/api";
import ChatBubble, { TypingIndicator } from "../components/ChatBubble";

const SUGGESTED_PROMPTS = [
  "what hackathons are coming up?",
  "show me AI internships",
  "fellowships for engineering students",
  "what should I explore based on my skills?",
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
        content: "oops, something broke. try again?",
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
        <aside className="w-64 bg-white/80 backdrop-blur-xl border-r border-stone-200/60 flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-stone-100 flex items-center justify-between">
            <button
              onClick={startNew}
              className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-brand-500/25 transition-all flex-1"
            >
              <Plus size={16} /> new chat
            </button>
            <button onClick={() => setSidebarOpen(false)} className="ml-2 p-1.5 text-stone-400 hover:text-stone-600 transition-colors">
              <PanelLeftClose size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-0.5">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => loadSession(s.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm truncate transition-all ${
                  s.id === activeSessionId
                    ? "bg-brand-50 text-brand-700 font-medium border-l-2 border-brand-500"
                    : "text-stone-500 hover:bg-stone-100 hover:text-stone-700"
                }`}
              >
                {s.title || "untitled"}
              </button>
            ))}
            {sessions.length === 0 && (
              <p className="text-xs text-stone-400 text-center py-4">no convos yet</p>
            )}
          </div>
        </aside>
      )}

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute left-0 top-1/2 z-10 p-1.5 bg-white/80 backdrop-blur border border-stone-200 rounded-r-xl text-stone-400 hover:text-brand-600 transition-colors"
          >
            <PanelLeft size={16} />
          </button>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white flex items-center justify-center mb-4 shadow-glow">
                <Sparkles size={28} />
              </div>
              <h2 className="text-xl font-bold text-stone-800 mb-1 font-display">ask soip anything</h2>
              <p className="text-stone-400 mb-8 max-w-md text-sm">
                get personalized opp recs, powered by AI
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    className="px-4 py-3 bg-white/70 backdrop-blur border border-stone-200 rounded-2xl text-sm text-stone-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 hover:-translate-y-0.5 hover:shadow-md transition-all text-left"
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
        <div className="border-t border-stone-200/60 bg-white/70 backdrop-blur-xl p-4">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-3 max-w-3xl mx-auto"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="what are you looking for?"
              disabled={sending}
              className="flex-1 px-5 py-3 bg-stone-100 border-0 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="px-4 py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-full hover:shadow-lg hover:shadow-brand-500/25 transition-all disabled:opacity-40"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
