import { Link, useParams } from "react-router";
import { Page, PageHeader } from "@/components/Page";
import { QueryContent } from "@/components/QueryContent";
import { RefreshControl } from "@/components/RefreshControl";
import type { AccessionDetail } from "@/generated/AccessionDetail";
import type { AccessionSpecimenView } from "@/generated/AccessionSpecimenView";
import type { ClientView } from "@/generated/ClientView";
import type { OrderDetail } from "@/generated/OrderDetail";
import { activeCards, useClearActiveCardOutside } from "@/lib/activeCards";
import { useCommandQuery, useHasCapability } from "@/lib/commands";
import { IdentityBanner } from "@/lib/IdentityBanner";
import { useRecordSequence } from "@/lib/recordSequence";
import { IntakeSteps } from "../IntakeSteps";
import { GET_ORDER, LIST_CLIENTS } from "../orders/contract";
import { AccessionProgress, allDecided } from "./AccessionProgress";
import { AccessionSide } from "./AccessionSide";
import { GET_ACCESSION } from "./contract";
import { specimenTitle } from "./labels";
import { useOrderLabel } from "./orderLabel";
import styles from "./receiving.module.css";
import { SpecimenPanel } from "./SpecimenPanel";

/**
 * Accessions have no list of their own: people who enter orders come from Orders, others find
 * one by scanning a container.
 */
const ORDERS = { label: "Orders", href: "/orders" };
const CONTAINER_LOOKUP = { label: "Container lookup", href: "/containers" };

const accessionPath = (accessionId: string) => `/accessions/${accessionId}`;

/**
 * Finish receiving: one accession's collection, specimens, containers and labels
 * (REQ-SPC-001 to REQ-SPC-003). Viewing it is an audited access, so label outcomes are
 * refreshed on request (Refresh), not polled. The header stays in place while another accession loads,
 * so focus stays on Previous or Next.
 */
export function AccessionPage() {
  const { accessionId = "" } = useParams();
  const canOpenOrder = useHasCapability("enter_orders");
  const accession = useCommandQuery<AccessionDetail>(GET_ACCESSION, { input: { accessionId } });
  const home = canOpenOrder ? ORDERS : CONTAINER_LOOKUP;
  const { list, sequence } = useRecordSequence(accessionId, home, accessionPath);
  const data = accession.data;
  return (
    <Page>
      <PageHeader
        title={data ? `Finish receiving · ${data.accessionNumber}` : "Finish receiving"}
        breadcrumbs={[
          list,
          ...(data && canOpenOrder ? [{ label: "Order", href: `/orders/${data.orderId}` }] : []),
          { label: "Finish receiving", href: accessionPath(accessionId) },
        ]}
        sequence={sequence}
      />
      {/* Refresh at the end of the steps' row: the page reads the accession on request. */}
      <div className={styles.stepsRow}>
        <IntakeSteps current="finish" complete={data !== undefined && allDecided(data.specimens)} />
        <RefreshControl query={accession} />
      </div>
      <QueryContent query={accession} what="accession">
        {(loaded) => <AccessionRecord accession={loaded} />}
      </QueryContent>
    </Page>
  );
}

function AccessionRecord({ accession }: { accession: AccessionDetail }) {
  const { accessionNumber, specimens } = accession;
  const single = specimens.length === 1;
  useClearActiveCardOutside();
  const progress = <AccessionProgress specimens={specimens} />;
  return (
    <>
      <AccessionBanner accession={accession} />
      <div className={styles.receivingLayout} {...activeCards}>
        <div className={styles.specimens}>
          {!single && progress}
          {waitingFirst(specimens).map(({ specimen, index }) => (
            <SpecimenPanel
              key={specimen.specimenId}
              specimen={specimen}
              title={specimenTitle(specimen, index)}
              accessionNumber={accessionNumber}
              progress={single ? progress : undefined}
            />
          ))}
        </div>
        <AccessionSide accession={accession} />
      </div>
    </>
  );
}

/** Specimens still waiting for a decision first; each keeps its number from the accession. */
function waitingFirst(specimens: readonly AccessionSpecimenView[]) {
  const numbered = specimens.map((specimen, index) => ({ specimen, index }));
  const waiting = (each: (typeof numbered)[number]) => each.specimen.acceptance === "received";
  return [...numbered.filter(waiting), ...numbered.filter((each) => !waiting(each))];
}

/**
 * The patient strip with the order, its client and the accession's tests. The order and the
 * client's name need `enter_orders`; without it the strip names the accession only.
 */
function AccessionBanner({ accession }: { accession: AccessionDetail }) {
  const canOpenOrder = useHasCapability("enter_orders");
  const order = useCommandQuery<OrderDetail>(
    GET_ORDER,
    { input: { orderId: accession.orderId } },
    { enabled: canOpenOrder },
  );
  const clients = useCommandQuery<ClientView[]>(LIST_CLIENTS, undefined, {
    enabled: canOpenOrder,
  });
  const orderLabel = useOrderLabel(order.data);
  const client = clients.data?.find((each) => each.id === order.data?.clientId);
  const tests = order.data?.items
    .filter((item) => accession.orderItemIds.includes(item.itemId))
    .map((item) => `${item.orderableCode} ${item.orderableName}`)
    .join(", ");
  if (!canOpenOrder) {
    return (
      <IdentityBanner
        subjectId={accession.subjectId}
        specimen={{ accessionNumber: accession.accessionNumber }}
      />
    );
  }
  const details = [
    {
      label: "Order",
      value: <Link to={`/orders/${accession.orderId}`}>{orderLabel.detail}</Link>,
    },
    ...(client ? [{ label: "Client", value: client.name }] : []),
    ...(tests ? [{ label: "Tests", value: tests }] : []),
  ];
  return <IdentityBanner subjectId={accession.subjectId} details={details} />;
}
