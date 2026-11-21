import { useContext } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import type { ListenerStatusView } from "@/generated/ListenerStatusView";
import { formatRecentTime, LabTimeZoneContext, useFormatTime } from "@/lib/format";
import { LISTENER_STATES, listenerDetailText } from "@/lib/listenerDetail";
import styles from "./listeners.module.css";

/**
 * One row per analyzer on the sign-in and lock screens, in aligned columns: its name, its
 * state with the reason, and its last activity as `today 15:53` (ticket #4885).
 */
export function ListenerTable({ id, listeners }: { id: string; listeners: ListenerStatusView[] }) {
  return (
    <table id={id} className={styles.table}>
      <thead>
        <tr>
          <th scope="col">Analyzer</th>
          <th scope="col">State</th>
          <th scope="col">Last activity</th>
        </tr>
      </thead>
      <tbody>
        {listeners.map((listener) => (
          <ListenerTableRow key={listener.instrumentId} listener={listener} />
        ))}
      </tbody>
    </table>
  );
}

function ListenerTableRow({ listener }: { listener: ListenerStatusView }) {
  const state = LISTENER_STATES[listener.state];
  const detail = listenerDetailText(listener);
  return (
    <tr>
      <th scope="row">{listener.instrumentName}</th>
      <td>
        <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
        {detail && <span className={styles.reason}>{detail}</span>}
      </td>
      <td>
        {listener.lastActivityAt ? <RecentTime value={listener.lastActivityAt} /> : "None yet"}
      </td>
    </tr>
  );
}

/** A recent time without the zone; the full time, with the zone, shows on hover. */
function RecentTime({ value }: { value: string }) {
  const timeZone = useContext(LabTimeZoneContext);
  const formatTime = useFormatTime();
  return (
    <time dateTime={value} title={formatTime(value)}>
      {formatRecentTime(value, timeZone, new Date())}
    </time>
  );
}
