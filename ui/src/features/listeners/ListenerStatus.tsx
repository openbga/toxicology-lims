import { ChevronDown, ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/Button";
import { StatusBadge } from "@/components/StatusBadge";
import type { Tone } from "@/components/tones";
import type { ListenerState } from "@/generated/ListenerState";
import { LISTENER_STATES } from "@/lib/listenerDetail";
import { type ListenersQuery, RestartSummary, useListeners } from "./ListenerList";
import { ListenersDialog } from "./ListenersDialog";
import { ListenerTable } from "./ListenerTable";
import styles from "./listeners.module.css";

/** The order states are counted in the summaries: the ones needing attention first. */
const SUMMARY_ORDER: readonly ListenerState[] = [
  "error",
  "receiving",
  "connected",
  "listening",
  "manual_only",
  "disabled",
];

/** Whether the card shows one row per analyzer, remembered on this computer (ticket #4885). */
const OPEN_KEY = "vibe-tox.sign-in-analyzers-open-v1";

function readOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) === "true";
  } catch {
    // An unavailable store means the card starts closed.
    return false;
  }
}

function saveOpen(open: boolean) {
  try {
    localStorage.setItem(OPEN_KEY, String(open));
  } catch {
    // Continue with the in-memory choice when this webview cannot persist it.
  }
}

/**
 * The analyzers on the sign-in and lock screens, as a card under the form (REQ-OPS-013,
 * ticket #4885): one line counting them by state, which opens one row per analyzer with its
 * state and last activity. The engine keeps listening whoever is signed in.
 */
export function ListenerStatus() {
  const listeners = useListeners();
  const [isOpen, setOpen] = useState(readOpen);
  const listId = useId();
  const { tone, text } = summarize(listeners);
  const all = listeners.isSuccess ? listeners.data : [];
  const summary = <StatusBadge tone={tone}>{text}</StatusBadge>;
  const toggle = () => {
    setOpen(!isOpen);
    saveOpen(!isOpen);
  };
  const Chevron = isOpen ? ChevronDown : ChevronRight;
  return (
    <section aria-label="Analyzers" className={styles.card}>
      <RestartSummary />
      {all.length === 0 ? (
        <span className={styles.summary}>{summary}</span>
      ) : (
        <Button
          variant="quiet"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listId : undefined}
          onPress={toggle}
        >
          <span className={styles.summary}>
            <Chevron aria-hidden="true" />
            {summary}
            <span className={styles.note}>Results are received while nobody is signed in.</span>
          </span>
        </Button>
      )}
      {isOpen && all.length > 0 && <ListenerTable id={listId} listeners={all} />}
    </section>
  );
}

/**
 * One badge in the top bar counting the listeners by state, for example "2 analyzers:
 * 1 connected, 1 listening" (REQ-OPS-013). Pressing it shows every listener's state and last
 * activity, after an update with the restart summary; people who manage analyzers enable and
 * disable them there (ticket #4746).
 */
export function ListenerSummary() {
  const listeners = useListeners();
  const [isOpen, setOpen] = useState(false);
  const { tone, text } = summarize(listeners);
  return (
    <>
      <Button variant="quiet" onPress={() => setOpen(true)}>
        <StatusBadge tone={tone}>{text}</StatusBadge>
      </Button>
      {isOpen && <ListenersDialog listeners={listeners} onClose={() => setOpen(false)} />}
    </>
  );
}

function summarize(listeners: ListenersQuery): { tone: Tone; text: string } {
  if (listeners.isPending) return { tone: "neutral", text: "Analyzers: checking" };
  if (listeners.isError) return { tone: "neutral", text: "Analyzers: status unavailable" };
  const all = listeners.data;
  if (all.length === 0) return { tone: "neutral", text: "No instruments configured" };
  const counts = SUMMARY_ORDER.flatMap((state) => {
    const count = all.filter((listener) => listener.state === state).length;
    return count === 0 ? [] : [`${count} ${LISTENER_STATES[state].label.toLowerCase()}`];
  });
  return {
    tone: summaryTone(new Set(all.map((listener) => listener.state))),
    text: `${all.length} ${all.length === 1 ? "analyzer" : "analyzers"}: ${counts.join(", ")}`,
  };
}

/** The tone of the state counted first: an error, then a working, then a waiting listener. */
function summaryTone(states: Set<ListenerState>): Tone {
  const first = SUMMARY_ORDER.find((state) => states.has(state));
  return first === undefined ? "neutral" : LISTENER_STATES[first].tone;
}
