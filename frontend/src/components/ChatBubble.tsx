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
          isUser ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-600"
        }`}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div className={`max-w-[75%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? "bg-brand-600 text-white rounded-tr-sm"
              : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm"
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

        {/* Inline opportunity cards */}
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
      <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center flex-shrink-0">
        <Bot size={16} />
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1">
          <span className="typing-dot w-2 h-2 bg-gray-400 rounded-full" />
          <span className="typing-dot w-2 h-2 bg-gray-400 rounded-full" />
          <span className="typing-dot w-2 h-2 bg-gray-400 rounded-full" />
        </div>
      </div>
    </div>
  );
}
