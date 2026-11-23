import { useParams } from "react-router";
import { Alert } from "@/components/Alert";
import { Page, PageHeader } from "@/components/Page";
import { QueryContent } from "@/components/QueryContent";
import { RefreshControl } from "@/components/RefreshControl";
import { Section } from "@/components/Section";
import { Tabs } from "@/components/Tabs";
import { Timestamp } from "@/components/Timestamp";
import { useCommandQuery } from "@/lib/commands";
import { IdentityBanner } from "@/lib/IdentityBanner";
import { useRecordQuery } from "@/lib/recordQuery";
import { useRecordSequence } from "@/lib/recordSequence";
import { useRouteTabs } from "@/lib/routeTabs";
import styles from "@/styles/layout.module.css";
import {
  ADD_DELIVERY_OBLIGATION,
  GET_REPORT,
  GET_REPORT_REVISION,
  RECORD_IMPACT_ASSESSMENT,
  type ReportDetail,
  type RevisionDetail,
} from "../contract";
import { DeliverySection } from "../delivery/DeliverySection";
import { InterfaceDeliveries } from "../delivery/InterfaceDeliveries";
import { reportPath } from "../paths";
import { ExportsSection } from "./ExportsSection";
import { ImpactSection } from "./ImpactSection";
import { IncidentsSection } from "./IncidentsSection";
import { PreviewTab } from "./PreviewTab";
import { currentOf, ReportActions, ReportChips, shownRevision } from "./ReportHeader";
import { ReportSummary } from "./ReportSummary";
import { ResultsTab, resultCount } from "./ResultsTab";
import { RevisionsSection } from "./RevisionsSection";

/** Where the breadcrumb leads when the report was not opened from a list. */
const HOME = { label: "Reports", href: "/reports" };

/**
 * One report's history (REQ-RPT-002, REQ-RPT-003, REQ-RPT-013): a summary, any withdrawal,
 * and tabs for the printed results, delivery obligations and attempts, every revision,
 * exports, impact after release and preservation incidents, under status chips and the
 * patient banner. Actions are offered only when the
 * report's `allowedActions`, computed by the engine for the signed-in person, names them; the
 * engine still decides. Opening this screen is recorded in the audit trail.
 */
export function ReportPage() {
  const { reportId = "" } = useParams();
  const report = useRecordQuery<ReportDetail>(GET_REPORT, { input: { reportId } });
  const { list, sequence } = useRecordSequence(reportId, HOME, reportPath);
  const data = report.data;
  // One header in every state, so Previous and Next keep focus while the next report loads.
  return (
    <Page>
      <PageHeader
        title={data ? `Report ${data.reportNumber}` : "Report"}
        chips={data && <ReportChips report={data} />}
        description="Opening this screen is recorded in the audit trail."
        breadcrumbs={[list, { label: data?.reportNumber ?? "Report", href: reportPath(reportId) }]}
        sequence={sequence}
        actions={data && <ReportActions report={data} />}
      />
      {data && (
        <IdentityBanner
          subject={data.subject}
          specimen={{
            accessionNumber: data.accessionNumber,
            accessionId: data.accessionId,
            orderId: data.orderId,
          }}
        />
      )}
      <RefreshControl query={report} />
      <QueryContent query={report} what="report">
        {(loaded) => <ReportHistory report={loaded} />}
      </QueryContent>
    </Page>
  );
}

/**
 * The report's parts as tabs (#4834), Results first. Incidents is a tab only while the report
 * has a preservation incident, or a work-queue item leads to one. Each tab is a path segment,
 * so Back, reload and links keep it.
 */
function ReportHistory({ report }: { report: ReportDetail }) {
  const { keep } = useRecordSequence(report.reportId, HOME, reportPath);
  const shown = shownRevision(report);
  // The audited revision read (REQ-RPT-001): the results as the revision printed them.
  const revision = useCommandQuery<RevisionDetail>(
    GET_REPORT_REVISION,
    { input: { revisionId: shown?.revisionId ?? "" } },
    { enabled: shown !== undefined },
  );
  const { tab: requested } = useParams();
  const withIncidents = report.incidents.length > 0 || requested === "incidents";
  const { selectedId: tab, tabs } = useRouteTabs(reportPath(report.reportId), [
    { id: "results", label: "Results", count: resultCount(revision.data) },
    { id: "preview", label: "Preview" },
    { id: "delivery", label: "Delivery", count: report.obligations.length },
    { id: "revisions", label: "Revisions", count: report.revisions.length },
    { id: "exports", label: "PDF exports", count: report.exports.length },
    { id: "impact", label: "Impact", count: report.impact?.open.length ?? 0 },
    ...(withIncidents
      ? [{ id: "incidents" as const, label: "Incidents", count: report.incidents.length }]
      : []),
  ]);
  return (
    <div className={styles.stack}>
      <ReportSummary report={report} />
      {report.withdrawal && (
        <Alert tone="info" title="This report is withdrawn">
          Withdrawn <Timestamp value={report.withdrawal.withdrawnAt} /> by{" "}
          {report.withdrawal.withdrawnBy.displayName} at revision {report.withdrawal.revisionNo}.
          Reason: {report.withdrawal.reason}
        </Alert>
      )}
      <Tabs
        label={`Report ${report.reportNumber}`}
        tabs={tabs}
        selectedId={tab}
        routerOptions={keep}
      >
        {tab === "results" && <ResultsTab revision={revision} isReleased={shown !== undefined} />}
        {tab === "preview" && <PreviewTab report={report} shown={shown} revision={revision} />}
        {tab === "delivery" && (
          <div className={styles.stack}>
            <DeliverySection obligations={report.obligations} addTo={addDestinationTo(report)} />
            <InterfaceDeliveries reportId={report.reportId} reportNumber={report.reportNumber} />
          </div>
        )}
        {tab === "revisions" && (
          <RevisionsSection
            revisions={report.revisions}
            reportTitle={`Report ${report.reportNumber}`}
          />
        )}
        {tab === "exports" && (
          <ExportsSection exports={report.exports} revisions={report.revisions} />
        )}
        {tab === "impact" && <ImpactTab report={report} />}
        {tab === "incidents" && (
          <IncidentsSection incidents={report.incidents} revisions={report.revisions} />
        )}
      </Tabs>
    </div>
  );
}

/** Add destination adds to the current revision, when the engine allows it for this report. */
function addDestinationTo(report: ReportDetail) {
  const current = currentOf(report);
  return current && report.allowedActions.includes(ADD_DELIVERY_OBLIGATION)
    ? { revisionId: current.revisionId, clientId: report.clientId }
    : null;
}

/** Impact after release exists only for a current revision whose content can be read. */
function ImpactTab({ report }: { report: ReportDetail }) {
  if (!report.impact) {
    return (
      <Section title="Impact after release">
        <p className={styles.hint}>
          Not applicable: only a current revision whose stored content can be read has impact after
          release.
        </p>
      </Section>
    );
  }
  return (
    <ImpactSection
      impact={report.impact}
      canAssess={report.allowedActions.includes(RECORD_IMPACT_ASSESSMENT)}
    />
  );
}
