import type { ManagedFeedback } from "../store/feedbackStore";

/**
 * Activity session IDs are local fixture IDs, not canonical cross-role session IDs.
 * Keep this relationship explicit until a shared session dataset is approved.
 */
export function selectClientActivityFeedback(
  items: readonly ManagedFeedback[],
  clientId: string,
  clientActivitySessionId: number,
): ManagedFeedback | undefined {
  return items.find(
    (item) =>
      item.clientId === clientId &&
      item.clientActivitySessionId === clientActivitySessionId,
  );
}
