import React from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import type { FeedbackValue } from "../lib/api";

interface Props {
  opportunityId: string;
  source: "feed" | "chat";
  currentValue: FeedbackValue | null;
  disabled: boolean;
  onFeedback: (value: FeedbackValue) => void;
  compact?: boolean;
}

export default function FeedbackButtons({
  currentValue,
  disabled,
  onFeedback,
  compact,
}: Props) {
  const iconSize = compact ? 14 : 16;

  const handleClick = (e: React.MouseEvent, value: FeedbackValue) => {
    e.stopPropagation();
    e.preventDefault();
    if (!disabled) onFeedback(value);
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={(e) => handleClick(e, "thumbs_up")}
        disabled={disabled}
        className={`inline-flex items-center justify-center rounded-lg transition-colors ${
          compact ? "p-1" : "p-1.5"
        } ${
          currentValue === "thumbs_up"
            ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30"
            : disabled
              ? "text-stone-300 dark:text-stone-600 cursor-default"
              : "text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 dark:text-stone-500 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/30"
        }`}
        title="Relevant"
      >
        <ThumbsUp size={iconSize} />
      </button>
      <button
        type="button"
        onClick={(e) => handleClick(e, "thumbs_down")}
        disabled={disabled}
        className={`inline-flex items-center justify-center rounded-lg transition-colors ${
          compact ? "p-1" : "p-1.5"
        } ${
          currentValue === "thumbs_down"
            ? "text-rose-500 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/30"
            : disabled
              ? "text-stone-300 dark:text-stone-600 cursor-default"
              : "text-stone-400 hover:text-rose-500 hover:bg-rose-50 dark:text-stone-500 dark:hover:text-rose-400 dark:hover:bg-rose-900/30"
        }`}
        title="Not relevant"
      >
        <ThumbsDown size={iconSize} />
      </button>
    </div>
  );
}
