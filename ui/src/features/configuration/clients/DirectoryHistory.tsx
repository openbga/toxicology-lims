import type { DirectoryHistoryEntry } from "@/generated/DirectoryHistoryEntry";
import type { DirectoryRecord } from "@/generated/DirectoryRecord";
import { CorrectionHistory } from "@/lib/CorrectionHistory";

function facts(row: DirectoryHistoryEntry) {
  const value = row.snapshot;
  const label =
    value.kind === "practitioner"
      ? `${value.npi} · ${value.family_name}, ${value.given_names ?? ""} · ${value.phone ?? "No phone"}`
      : `${value.code} · ${value.name}`;
  return `${label} · ${value.active ? "Active" : "Retired"}`;
}

/** The correction history of one client, location or practitioner. */
export function DirectoryHistory({ record }: { record: DirectoryRecord }) {
  return (
    <CorrectionHistory<DirectoryHistoryEntry>
      command="directory_history"
      input={{ record }}
      label="Directory correction history"
      facts={facts}
    />
  );
}
