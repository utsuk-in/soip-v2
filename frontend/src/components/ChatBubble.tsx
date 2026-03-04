import React from "react";
import Markdown from "react-markdown";
import { Bot, User } from "lucide-react";
import OpportunityCard from "./OpportunityCard";
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
            : "bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700"
        }`}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div className={`max-w-[75%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-2xl rounded-tr-md shadow-sm"
              : "bg-white/80 backdrop-blur border border-stone-200 text-stone-800 rounded-2xl rounded-tl-md"
          }`}
        >
          {isUser ? (
            <p>{content}</p>
          ) : (
            <Markdown
              components={{
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-600 underline hover:text-brand-700">
                    {children}
                  </a>
                ),
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
          <div className="mt-2 space-y-2">
            {citedOpportunities.slice(0, 3).map((opp) => (
              <OpportunityCard
                key={opp.id}
                opportunity={opp}
                compact
                onClick={() => onOpportunityClick?.(opp.id)}
              />
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
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700 flex items-center justify-center flex-shrink-0">
        <Bot size={16} />
      </div>
      <div className="bg-white/80 backdrop-blur border border-stone-200 rounded-2xl rounded-tl-md px-4 py-3">
        <div className="flex gap-1">
          <span className="typing-dot w-2 h-2 bg-brand-400 rounded-full" />
          <span className="typing-dot w-2 h-2 bg-brand-400 rounded-full" />
          <span className="typing-dot w-2 h-2 bg-brand-400 rounded-full" />
        </div>
      </div>
    </div>
  );
}
