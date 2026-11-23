import { useParams } from "react-router";
import { Page, PageHeader } from "@/components/Page";
import type { OrderDetail } from "@/generated/OrderDetail";
import { useCommandQuery } from "@/lib/commands";
import { IntakeSteps } from "../IntakeSteps";
import { GET_ORDER } from "../orders/contract";
import { usePatientName } from "./orderLabel";
import { ReceiveSpecimens } from "./ReceiveSpecimens";

/** Receive material for an existing order, then verify receipt (REQ-SPC-001/002, WF-02). */
export function NewAccessionPage() {
  const { orderId = "" } = useParams();
  const order = useCommandQuery<OrderDetail>(GET_ORDER, { input: { orderId } });
  const name = usePatientName(order.data?.subjectId);
  return (
    <Page>
      <PageHeader
        title={name ? `Receive specimens · ${name}` : "Receive specimens"}
        breadcrumbs={[
          { label: "Orders", href: "/orders" },
          { label: name ? `Order · ${name}` : "Order", href: `/orders/${orderId}` },
          { label: "Receive specimens", href: `/orders/${orderId}/accession` },
        ]}
        description="Register the material that arrived. Labels and the receipt decision come next."
      />
      <IntakeSteps current="receive" />
      <ReceiveSpecimens orderId={orderId} />
    </Page>
  );
}
