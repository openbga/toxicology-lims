import { Link } from "react-router";
import { Section } from "@/components/Section";
import type { OrderAccessionContext } from "@/generated/OrderAccessionContext";
import type { OrderDetail } from "@/generated/OrderDetail";
import { useOrderLabel } from "./orderLabel";
import styles from "./receiving.module.css";

interface Props {
  order: OrderDetail;
  context: OrderAccessionContext;
}

/** Eligibility and its explanation come from the engine, including historical test names. */
export function AccessionTestSelection({ order, context }: Props) {
  const label = useOrderLabel(order);
  const blocked = context.items.filter((item) => !item.eligible);
  const names = new Map(
    order.items.map((item) => [item.itemId, `${item.orderableCode} ${item.orderableName}`]),
  );
  return (
    <Section title="Ordered tests" variant="plain">
      <p className={styles.hint}>
        <Link to={`/orders/${order.orderId}`}>{label.full}</Link>
      </p>
      {blocked.length > 0 && (
        <ul className={styles.list} aria-label="Tests unavailable for this accession">
          {blocked.map((item) => (
            <li key={item.orderItemId}>
              <strong>{names.get(item.orderItemId) ?? item.orderItemId}</strong>:{" "}
              {item.reason ?? "Unavailable for receiving."}
              {item.accessionId && (
                <>
                  {" "}
                  <Link to={`/accessions/${item.accessionId}`}>
                    Accession {item.accessionNumber ?? item.accessionId}
                  </Link>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {context.accessions.length > 0 && (
        <ul className={styles.list} aria-label="Existing accessions">
          {context.accessions.map((accession) => (
            <li key={accession.accessionId}>
              <Link to={`/accessions/${accession.accessionId}`}>
                Accession {accession.accessionNumber}
              </Link>
              {` · ${accession.specimenCount} ${accession.specimenCount === 1 ? "specimen" : "specimens"} · ${accession.pendingReceiptCount} need receipt review`}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
