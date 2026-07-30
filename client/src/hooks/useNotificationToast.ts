import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/**
 * Icon map for notification types — returns a single emoji that renders
 * inside the sonner toast without any extra dependencies.
 */
const TYPE_ICON: Record<string, string> = {
  new_submission:    "📋",
  inbound_email:     "📧",
  referrer_reply:    "💬",
  assessor_assigned: "👤",
  org_referral:      "🏢",
  chat_mention:      "@",
  task_update:       "✅",
};

/**
 * Polls notifications.list every POLL_MS milliseconds.
 * On the first successful fetch it records the highest notification ID
 * as the "seen baseline" — nothing is toasted on mount.
 * On every subsequent fetch, any notification whose ID is higher than
 * the baseline triggers a toast and updates the baseline.
 *
 * Call this hook once inside a layout component that is mounted for the
 * duration of a user session (e.g. AdminLayout, OrgPortal).
 * Pass `enabled = false` to disable (e.g. for assessors).
 */
export function useNotificationToast(enabled = true) {
  const POLL_MS = 15_000;

  // Highest notification ID we have already shown a toast for.
  // Initialised to -1 so the first fetch sets the baseline without toasting.
  const highestSeenId = useRef<number>(-1);
  // True once the first fetch has completed and the baseline is set.
  const baselineSet = useRef(false);

  const { data } = trpc.notifications.list.useQuery(
    { limit: 50 },
    {
      enabled,
      refetchInterval: POLL_MS,
      refetchIntervalInBackground: false,
      // Don't show a loading spinner — this is a background poll
      staleTime: POLL_MS - 1_000,
    }
  );

  useEffect(() => {
    if (!data || data.length === 0) {
      // No notifications yet — set baseline to 0 so future ones are toasted
      if (!baselineSet.current) {
        highestSeenId.current = 0;
        baselineSet.current = true;
      }
      return;
    }

    // Sort descending so index 0 is the newest
    const sorted = [...data].sort((a, b) => b.id - a.id);
    const latestId = sorted[0].id;

    if (!baselineSet.current) {
      // First fetch — record baseline, show nothing
      highestSeenId.current = latestId;
      baselineSet.current = true;
      return;
    }

    // Find notifications newer than what we've already seen
    const newOnes = sorted.filter((n) => n.id > highestSeenId.current);
    if (newOnes.length === 0) return;

    // Update baseline
    highestSeenId.current = latestId;

    // Fire a toast for each new notification (newest last so they stack naturally)
    for (const n of [...newOnes].reverse()) {
      const icon = TYPE_ICON[n.type] ?? "🔔";
      const body = n.body ? n.body.slice(0, 100) + (n.body.length > 100 ? "…" : "") : undefined;

      toast(n.title, {
        description: body,
        icon,
        duration: 6_000,
        action: n.link
          ? {
              label: "View",
              onClick: () => {
                window.location.href = n.link as string;
              },
            }
          : undefined,
      });
    }
  }, [data]);
}
