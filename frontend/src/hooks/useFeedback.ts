import { useCallback, useRef, useState } from "react";
import {
  batchGetFeedback,
  submitFeedback as apiFeedback,
  type FeedbackValue,
  type FeedbackSource,
} from "../lib/api";

export function useFeedback() {
  const [feedbackMap, setFeedbackMap] = useState<Record<string, FeedbackValue>>({});
  const submittedInSession = useRef(new Set<string>());

  const loadFeedback = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    try {
      const map = await batchGetFeedback(ids);
      setFeedbackMap((prev) => {
        const next = { ...prev };
        for (const [id, value] of Object.entries(map)) {
          next[id] = value as FeedbackValue;
          submittedInSession.current.add(id);
        }
        return next;
      });
    } catch {
      // silently ignore — feedback is non-critical
    }
  }, []);

  const submit = useCallback(
    async (opportunityId: string, value: FeedbackValue, source: FeedbackSource) => {
      if (submittedInSession.current.has(opportunityId)) return;
      submittedInSession.current.add(opportunityId);
      setFeedbackMap((prev) => ({ ...prev, [opportunityId]: value }));
      try {
        await apiFeedback(opportunityId, value, source);
      } catch {
        // rollback on failure
        submittedInSession.current.delete(opportunityId);
        setFeedbackMap((prev) => {
          const next = { ...prev };
          delete next[opportunityId];
          return next;
        });
      }
    },
    [],
  );

  const getFeedback = useCallback(
    (id: string): FeedbackValue | null => feedbackMap[id] ?? null,
    [feedbackMap],
  );

  const hasSubmitted = useCallback(
    (id: string): boolean => submittedInSession.current.has(id),
    [],
  );

  return { feedbackMap, loadFeedback, submit, getFeedback, hasSubmitted };
}
