import { useState } from "react";
import { Link, type NavigateOptions, useParams } from "react-router";
import { Alert } from "@/components/Alert";
import { Button } from "@/components/Button";
import { Facts } from "@/components/Facts";
import { Page, PageHeader } from "@/components/Page";
import { QueryContent } from "@/components/QueryContent";
import { RefreshControl } from "@/components/RefreshControl";
import { Section } from "@/components/Section";
import { Tabs } from "@/components/Tabs";
import type { ImportAttemptDetail } from "@/generated/ImportAttemptDetail";
import { useFormatTime } from "@/lib/format";
import { useRecordQuery } from "@/lib/recordQuery";
import { useRecordSequence } from "@/lib/recordSequence";
import { useRouteTabs } from "@/lib/routeTabs";
import { GET_IMPORT_ATTEMPT } from "../contract";
import { IMPORTS_LIST, importAttemptPath } from "../paths";
import { failureText } from "../resultLabels";
import { failureFixFacts } from "./fixLinks";
import { ImportFile } from "./ImportFile";
import { ImportOutcomeBadge } from "./ImportOutcomeBadge";
import { ImportRows } from "./ImportRows";
import { QuarantineItems } from "./QuarantineItems";
import { RetryImportDialog } from "./RetryImportDialog";
import { importRowsPath } from "./rowOutcomes";
import { SetAsideRows } from "./SetAsideRows";

/**
 * One import attempt (REQ-ANA-003): its counts, each opening the rows it counts, every row
 * with what happened to it, the rows held in quarantine with why, and a retry of the whole
 * received message. A duplicate of an earlier message links to that message's attempt
 * instead. For a result file it also shows the file, the template version used and, on a
 * third tab, the rows set aside (result files brief §7). Opening it is recorded in the audit
 * trail, since rows carry sample labels and values. Opened from Result imports, it keeps the
 * list in its breadcrumb with Previous and Next in the list's order.
 */
export function ImportAttemptPage() {
  const { importAttemptId = "" } = useParams();
  const formatTime = useFormatTime();
  const attempt = useRecordQuery<ImportAttemptDetail>(GET_IMPORT_ATTEMPT, {
    input: { importAttemptId },
  });
  const { list, sequence, keep } = useRecordSequence(
    importAttemptId,
    IMPORTS_LIST,
    importAttemptPath,
  );
  const { selectedId: tab, tabs } = useRouteTabs(importAttemptPath(importAttemptId), TABS);
  const detail = attempt.data;
  const title = detail ? `Import attempt ${detail.attemptNo}` : "Import attempt";
  return (
    <Page>
      <PageHeader
        title={title}
        status={detail && <ImportOutcomeBadge outcome={detail.outcome} />}
        description={detail && `Processed ${formatTime(detail.processedAt)}.`}
        breadcrumbs={[list, { label: title, href: importAttemptPath(importAttemptId) }]}
        sequence={sequence}
        actions={
          <>
            <RefreshControl query={attempt} />
            {detail && detail.outcome !== "duplicate" && <RetryImport attempt={detail} />}
          </>
        }
      />
      <QueryContent query={attempt} what="import">
        {(loaded) =>
          loaded.outcome === "duplicate" ? (
            <>
              <DuplicateOutcome attempt={loaded} />
              <ImportFile attempt={loaded} />
            </>
          ) : (
            <>
              <Section title="Outcome">
                <Facts layout="compact" items={outcomeFacts(loaded, keep)} />
              </Section>
              <ImportFile attempt={loaded} />
              <Tabs
                label={loaded.file === null ? "Rows of the message" : "Rows of the file"}
                tabs={tabs
                  .filter((each) => loaded.file !== null || each.id !== "set-aside")
                  .map((each) => ({ ...each, label: tabLabel(each.id, loaded) }))}
                selectedId={tab === "set-aside" && loaded.file === null ? "rows" : tab}
                routerOptions={keep}
              >
                <TabContent tab={tab} attempt={loaded} />
              </Tabs>
            </>
          )
        }
      </QueryContent>
    </Page>
  );
}

/**
 * A message or file identical to an earlier one from the instrument: nothing in it was read or
 * imported, so it has no rows and no retry. Its samples and results are on the earlier receipt's
 * latest attempt, linked once that receipt has been imported.
 */
function DuplicateOutcome({ attempt }: { attempt: ImportAttemptDetail }) {
  const what = attempt.file === null ? "message" : "file";
  const earlier = attempt.duplicateOfAttemptId;
  return (
    <Section title="Outcome">
      <Alert tone="info" title={`The same ${what} was received before from this instrument`}>
        Nothing in it was read or imported again. Its samples and results are on the earlier import
        attempt; to read the {what} again, use Retry import there.
      </Alert>
      <Facts
        layout="compact"
        items={[
          {
            label: "Earlier import attempt",
            value: earlier ? (
              <Link to={importAttemptPath(earlier)}>Open the earlier import attempt</Link>
            ) : (
              `The earlier ${what} has not been imported yet. Refresh to check again.`
            ),
          },
        ]}
      />
    </Section>
  );
}

/**
 * The attempt's rows: every row with what happened to it, those needing a decision, and for
 * a file those listed only (F9, F17).
 */
const TABS = [
  { id: "rows", label: "Rows" },
  { id: "quarantine", label: "Quarantined" },
  { id: "set-aside", label: "Set aside" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function tabLabel(id: TabId, attempt: ImportAttemptDetail): string {
  switch (id) {
    case "set-aside":
      return `Set aside (${attempt.setAside.length})`;
    case "quarantine":
      return `Quarantined (${attempt.rowsQuarantined})`;
    default:
      return `Rows (${attempt.rows.length})`;
  }
}

/** The selected tab; a message has no Set aside tab, so its address shows the rows. */
function TabContent({ tab, attempt }: { tab: TabId; attempt: ImportAttemptDetail }) {
  if (tab === "quarantine") return <QuarantineItems attempt={attempt} />;
  if (tab === "set-aside" && attempt.file !== null) return <SetAsideRows rows={attempt.setAside} />;
  return <ImportRows attempt={attempt} />;
}

/**
 * A count that opens the rows it counts on the Rows or Set aside tab, keeping the list the
 * page was opened from; a zero count, or one of rows not listed, is plain text.
 */
function countFact(label: string, count: number, to: string | null, keep: NavigateOptions) {
  if (count === 0 || to === null) return { label, value: String(count) };
  return {
    label,
    value: (
      <Link to={to} state={keep.state} aria-label={`Show ${label.toLowerCase()}: ${count}`}>
        {count}
      </Link>
    ),
  };
}

/** The attempt's counts; a file attempt adds the rows it counted or kept without a result. */
function outcomeFacts(attempt: ImportAttemptDetail, keep: NavigateOptions) {
  const id = attempt.importAttemptId;
  const listed = attempt.rows.length > 0;
  const rows = (outcome?: Parameters<typeof importRowsPath>[1]) =>
    listed ? importRowsPath(id, outcome) : null;
  const facts = [
    {
      label: attempt.file === null ? "Message failure" : "File failure",
      value: failureText(attempt.failureCode),
    },
    ...failureFixFacts(attempt),
    countFact("Rows", attempt.rowsTotal, rows(), keep),
    countFact("New results", attempt.rowsNew, rows("new"), keep),
    countFact("Duplicates", attempt.rowsDuplicate, rows("duplicate"), keep),
    countFact("Reprocessed", attempt.rowsReprocessed, rows("reprocessed"), keep),
    countFact("QC rows", attempt.rowsQc, rows("qc"), keep),
    countFact("Quarantined", attempt.rowsQuarantined, rows("quarantined"), keep),
  ];
  if (attempt.file === null) return facts;
  const setAside = `${importAttemptPath(id)}/set-aside`;
  return [
    ...facts,
    countFact("Not results", attempt.rowsNotResult, null, keep),
    countFact("Set aside", attempt.rowsSetAside, setAside, keep),
    countFact("Measured, not ordered (kept)", attempt.rowsRetained, rows("retained"), keep),
  ];
}

/** Retries the whole received message; the attempt carries no `allowedActions` yet. */
function RetryImport({ attempt }: { attempt: ImportAttemptDetail }) {
  const [isRetrying, setRetrying] = useState(false);
  return (
    <>
      <Button onPress={() => setRetrying(true)}>Retry import</Button>
      {isRetrying && (
        <RetryImportDialog receiptId={attempt.receiptId} onClose={() => setRetrying(false)} />
      )}
    </>
  );
}
