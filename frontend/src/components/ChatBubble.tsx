import React, { useMemo } from "react";
import Markdown from "react-markdown";
import { Bot, User } from "lucide-react";
import OpportunityCard from "./OpportunityCard";
import type { Opportunity } from "../lib/api";

interface Props {
  role: "user" | "assistant";
  content: string;
  citedOpportunities?: Opportunity[];
  onOpportunityClick?: (id: string) => void;
  onNavigate?: (path: string) => void;
}

export default function ChatBubble({ role, content, citedOpportunities, onOpportunityClick, onNavigate }: Props) {
  const isUser = role === "user";

  const urlToOppId = useMemo(() => {
    const map = new Map<string, string>();
    if (!citedOpportunities) return map;
    for (const opp of citedOpportunities) {
      if (opp.application_link) map.set(opp.application_link, opp.id);
      if (opp.application_url) map.set(opp.application_url, opp.id);
      if (opp.url) map.set(opp.url, opp.id);
      if (opp.source_url) map.set(opp.source_url, opp.id);
    }
    return map;
  }, [citedOpportunities]);

  const resolveLink = (href: string | undefined): { internal: boolean; path: string } => {
    if (!href) return { internal: false, path: "" };
    if (href.startsWith("/browse/")) return { internal: true, path: href };

    // LLM may prepend a domain to /browse/ paths (e.g. https://example.com/browse/uuid)
    const browseMatch = href.match(/\/browse\/([0-9a-f-]{36})/);
    if (browseMatch) return { internal: true, path: `/browse/${browseMatch[1]}` };

    const matchedId = urlToOppId.get(href);
    if (matchedId) return { internal: true, path: `/browse/${matchedId}` };

    for (const [url, id] of urlToOppId.entries()) {
      if (href.includes(url) || url.includes(href)) {
        return { internal: true, path: `/browse/${id}` };
      }
    }

    return { internal: false, path: href };
  };

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
                a: ({ href, children }) => {
                  const resolved = resolveLink(href);
                  if (resolved.internal && onNavigate) {
                    return (
                      <a
                        href={resolved.path}
                        onClick={(e) => { e.preventDefault(); onNavigate(resolved.path); }}
                        className="text-brand-600 underline hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200 cursor-pointer"
                      >
                        {children}
                      </a>
                    );
                  }
                  return (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-600 underline hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200">
                      {children}
                    </a>
                  );
                },
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
