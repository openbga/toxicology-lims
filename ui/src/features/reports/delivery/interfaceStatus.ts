import type { Tone } from "@/components/tones";
import type { PartnerMessageRow } from "@/generated/PartnerMessageRow";
import type { PartnerProtocol } from "@/generated/PartnerProtocol";
import type { UnroutedResolution } from "@/generated/UnroutedResolution";

interface Labelled {
  label: string;
  tone: Tone;
}

/** What a channel can prove of a message that left: a folder holds the file, nothing more. */
const LEFT_AS: Record<PartnerProtocol, string> = {
  folder: "Written",
  sftp: "Uploaded",
  mllp_connect: "Sent",
  mllp_listen: "Sent",
  portal_https: "Sent",
};

/** The decision a person recorded on a message that matched no connection. */
const RESOLUTIONS: Record<UnroutedResolution, string> = {
  sent_once: "Sent once to a connection",
  routed_again: "Routed again by the rules",
  delivered_another_way: "Delivery recorded another way",
  dismissed: "Dismissed",
};

const ACKS = {
  AA: { label: "Accepted (AA)", tone: "success" },
  AE: { label: "Rejected (AE)", tone: "danger" },
  AR: { label: "Rejected (AR)", tone: "danger" },
} as const satisfies Record<NonNullable<PartnerMessageRow["ackCode"]>, Labelled>;

/**
 * One interface message's status on a report's Delivery tab, as Interfaces records it (#4725,
 * REQ-RPT-011): the partner's acknowledgement over MLLP, else what the channel proves (written,
 * uploaded, sent), a failure, a wait, or the decision on an unrouted message. A written file or
 * an acknowledgement is never shown as proof that the partner processed the report.
 */
export function interfaceStatus(row: PartnerMessageRow): Labelled {
  if (row.unrouted) {
    return row.resolution === null
      ? { label: "Waiting in Unrouted messages", tone: "warning" }
      : { label: RESOLUTIONS[row.resolution], tone: "neutral" };
  }
  if (row.ackCode !== null) return ACKS[row.ackCode];
  if (row.awaitingAck) return { label: "Awaiting application ACK", tone: "warning" };
  switch (row.transport) {
    case "written":
      return { label: LEFT_AS[row.connection?.protocol ?? "folder"], tone: "neutral" };
    case "failed":
      return { label: "Failed", tone: "danger" };
    default:
      return row.superseded
        ? { label: "Replaced by a newer revision", tone: "neutral" }
        : { label: "Waiting", tone: "hold" };
  }
}

/** The report's revision or withdrawal notice the message carries. */
export const interfaceRecord = (row: PartnerMessageRow) =>
  row.source === "report_withdrawal" ? "Withdrawal notice" : `Revision ${row.sourceNumber}`;

/**
 * The message in Interfaces › Logs over all time: an outgoing one found by its control ID and
 * open in the side panel, an unrouted one found by the report number.
 */
export function logsPath(row: PartnerMessageRow, reportNumber: string): string {
  const params = new URLSearchParams({ period: "all" });
  if (row.deliveryId === null) params.set("q", reportNumber);
  else {
    params.set("q", row.deliveryId);
    params.set("open", row.deliveryId);
  }
  return `/interfaces/logs?${params.toString()}`;
}
