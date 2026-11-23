import { useEffect, useSyncExternalStore } from "react";
import type { InvokeArgs } from "@tauri-apps/api/core";
import type { CommandName } from "@/generated/CommandName";
import { useCommandQuery } from "./commands";

/** How many record queries on screen now show the previous record while the next loads. */
let switching = 0;
const listeners = new Set<() => void>();

function change(by: 1 | -1) {
  switching += by;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

/**
 * Reads one record for a page with Previous and Next (#4791). Moving to another record keeps
 * the last one on screen, so the header and its buttons do not jump, until the next is
 * loaded. Meanwhile the record is stale: `QueryContent` dims and blocks its content and
 * `PageHeader` its actions (see `useRecordSwitching`), so nothing can act on it under the
 * next record's address. Previous and Next stay available.
 */
export function useRecordQuery<T>(
  command: CommandName,
  args: InvokeArgs,
  options: { refetchInterval?: number; enabled?: boolean } = {},
) {
  const query = useCommandQuery<T>(command, args, { ...options, keepPrevious: true });
  const stale = query.isPlaceholderData;
  useEffect(() => {
    if (!stale) return;
    change(1);
    return () => change(-1);
  }, [stale]);
  return query;
}

/** Whether a record on this screen still shows the previous record while the next loads. */
export function useRecordSwitching(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => switching > 0,
    () => false,
  );
}
