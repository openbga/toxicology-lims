import type { OrderDetail } from "@/generated/OrderDetail";
import type { SubjectView } from "@/generated/SubjectView";
import { useCommandQuery } from "@/lib/commands";
import { useFormatDay } from "@/lib/format";
import { subjectSummary } from "@/lib/IdentityBanner";

/** "Patient, Test": the patient read the identity strip also shows (the same audited read). */
export function usePatientName(subjectId: string | undefined): string | null {
  const subject = useCommandQuery<SubjectView>(
    "get_subject",
    { input: { subjectId } },
    { enabled: subjectId !== undefined },
  );
  if (!subject.data) return null;
  const { familyName, givenNames } = subjectSummary(subject.data);
  return givenNames ? `${familyName}, ${givenNames}` : familyName;
}

/** What names an order to a person, and the same under a label that already says "Order". */
interface OrderLabel {
  full: string;
  detail: string;
}

/**
 * What a person can recognise an order by, never its internal ID: the clinic's order number
 * when supplied (`Order 123`), otherwise "Order · patient name · received date" (#4890).
 */
export function useOrderLabel(order: OrderDetail | undefined): OrderLabel {
  const name = usePatientName(order?.subjectId);
  const formatDay = useFormatDay();
  if (order === undefined) return { full: "Order", detail: "Order" };
  if (order.placerOrderId !== null) {
    return { full: `Order ${order.placerOrderId}`, detail: order.placerOrderId };
  }
  const detail = [name, formatDay(order.receivedAt)].filter(Boolean).join(" · ");
  return { full: `Order · ${detail}`, detail };
}
