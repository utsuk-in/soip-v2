import React, { useEffect, useState } from "react";
import { submitSatisfaction } from "../lib/api";

interface Props {
  messageId: string;
  sessionId: string;
  queryText: string;
  alreadySubmitted?: "yes" | "no" | null;
}

export default function SatisfactionPrompt({
  messageId,
  sessionId,
  queryText,
  alreadySubmitted,
}: Props) {
  const [submitted, setSubmitted] = useState<"yes" | "no" | null>(
    alreadySubmitted ?? null,
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (alreadySubmitted) setSubmitted(alreadySubmitted);
  }, [alreadySubmitted]);

  const handleClick = async (response: "yes" | "no") => {
    if (submitted || submitting) return;
    setSubmitting(true);
    try {
      await submitSatisfaction(messageId, sessionId, queryText, response);
      setSubmitted(response);
    } catch {
      // silently fail — non-critical
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500 pl-11 animate-fade-in">
        <span>Thanks for your feedback!</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500 pl-11 animate-fade-in">
      <span>Did this help?</span>
      <button
        type="button"
        onClick={() => handleClick("yes")}
        disabled={submitting}
        className="px-2.5 py-1 rounded-full border border-stone-200 dark:border-stone-700 hover:bg-green-50 hover:text-green-600 hover:border-green-200 dark:hover:bg-green-900/30 dark:hover:text-green-400 dark:hover:border-green-800 transition-all disabled:opacity-40"
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => handleClick("no")}
        disabled={submitting}
        className="px-2.5 py-1 rounded-full border border-stone-200 dark:border-stone-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/30 dark:hover:text-red-400 dark:hover:border-red-800 transition-all disabled:opacity-40"
      >
        No
      </button>
    </div>
  );
}
