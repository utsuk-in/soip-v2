import React from "react";
import Markdown from "react-markdown";
import { Bot, User, ExternalLink } from "lucide-react";
import type { Opportunity } from "../lib/api";

interface Props {
  role: "user" | "assistant";
  content: string;
  citedOpportunities?: Opportunity[];
  onOpportunityClick?: (id: string) => void;
}

export default function ChatBubble({ role, content, citedOpportunities, onOpportunityClick }: Props) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-3 animate-fade-in ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser
            ? "bg-gradient-to-br from-brand-500 to-accent-500 text-white"
            : "bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700 dark:from-brand-900 dark:to-brand-800 dark:text-brand-100"
        }`}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div className={`max-w-[75%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-2xl rounded-tr-md shadow-sm"
              : "bg-white/80 dark:bg-stone-900/80 backdrop-blur border border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-100 rounded-2xl rounded-tl-md"
          }`}
        >
          {isUser ? (
            <p>{content}</p>
          ) : (
            <Markdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              }}
            >
              {content}
            </Markdown>
          )}
        </div>

        {!isUser && citedOpportunities && citedOpportunities.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {citedOpportunities.map((opp) => (
              <button
                key={opp.id}
                onClick={() => onOpportunityClick?.(opp.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-brand-600 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors"
              >
                {opp.title}
                <ExternalLink size={12} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-in">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700 dark:from-brand-900 dark:to-brand-800 dark:text-brand-100 flex items-center justify-center flex-shrink-0">
        <Bot size={16} />
      </div>
      <div className="bg-white/80 dark:bg-stone-900/80 backdrop-blur border border-stone-200 dark:border-stone-800 rounded-2xl rounded-tl-md px-4 py-3">
        <div className="flex gap-1">
          <span className="typing-dot w-2 h-2 bg-brand-400 rounded-full" />
          <span className="typing-dot w-2 h-2 bg-brand-400 rounded-full" />
          <span className="typing-dot w-2 h-2 bg-brand-400 rounded-full" />
        </div>
      </div>
    </div>
  );
}
