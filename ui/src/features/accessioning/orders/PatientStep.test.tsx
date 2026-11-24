import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderPatientChoices } from "@/generated/OrderPatientChoices";
import { expectNoA11yViolations } from "@/lib/test/a11y";
import { openRow } from "@/lib/test/grid";
import { mockCommands } from "@/lib/test/ipc";
import { mockGridLayout } from "@/lib/test/layout";
import { renderRoutes } from "@/lib/test/router";
import { OTHER_SUMMARY, SUBJECT_ID, SUMMARY, sessionWith } from "../testData";
import { PatientStep } from "./PatientStep";

const CHOICES: OrderPatientChoices = {
  recent: [
    {
      subject: OTHER_SUMMARY,
      lastOrder: { receivedAt: "2026-11-12T15:00:00Z", clientName: "Synthetic Clinic" },
    },
  ],
  matches: [
    {
      subject: SUMMARY,
      lastOrder: { receivedAt: "2026-11-12T15:00:00Z", clientName: "Synthetic Clinic" },
    },
    { subject: { ...OTHER_SUMMARY, familyName: "Patienta" }, lastOrder: null },
  ],
};

function renderStep(find = vi.fn((): OrderPatientChoices => CHOICES)) {
  const choose = vi.fn();
  mockCommands({
    current_session: () => sessionWith(["enter_orders"]),
    find_order_patients: find,
    search_subjects: () => [SUMMARY],
  });
  const rendered = renderRoutes(
    [{ path: "/orders/new", element: <PatientStep onChoose={choose} /> }],
    "/orders/new",
  );
  return { ...rendered, choose, find };
}

describe("PatientStep (REQ-ORD-001, REQ-IDN-001)", () => {
  beforeEach(mockGridLayout);

  it("finds patients from one focused box and chooses a whole row", async () => {
    const { user, container, choose, find } = renderStep();
    const box = await screen.findByRole("searchbox", {
      name: "Find patient by name, birth date or identifier",
    });
    expect(document.activeElement).toBe(box);
    // Nothing typed: recent patients only, no search.
    expect(find).toHaveBeenLastCalledWith({ input: { query: null, limit: 25 } });
    await user.keyboard("1970-01-01{Enter}");
    expect(await screen.findByText("2 patients match “1970-01-01”")).toBeTruthy();
    expect(find).toHaveBeenLastCalledWith({ input: { query: "1970-01-01", limit: 25 } });
    const grid = screen.getByRole("grid", { name: "Matching patients" });
    expect(within(grid).getByText("2026-11-12 · Synthetic Clinic")).toBeTruthy();
    expect(within(grid).getByText("No orders")).toBeTruthy();
    await expectNoA11yViolations(container);
    await openRow(user, "MRN-00001 (SYN-CLINIC MR)");
    expect(choose).toHaveBeenCalledWith(SUBJECT_ID);
  });

  it("offers recent patients one click away", async () => {
    const { user, choose } = renderStep();
    const recent = await screen.findByRole("group", { name: "Recent patients" });
    await user.click(within(recent).getByRole("button", { name: "Patient, Test · 1970-01-01" }));
    expect(choose).toHaveBeenCalledWith(OTHER_SUMMARY.subjectId);
  });

  it("says when nobody matches and offers registration right below", async () => {
    const { user } = renderStep(vi.fn(() => ({ recent: [], matches: [] })));
    await screen.findByRole("searchbox");
    await user.keyboard("Nobody{Enter}");
    expect(await screen.findByText("No patients match “Nobody”")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Recent patients" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Register patient" }));
    expect(
      await screen.findByText("Navigated to /patients/register?intent=new-order"),
    ).toBeTruthy();
  });

  it("keeps the exact searches folded until opened", async () => {
    const { user } = renderStep();
    await screen.findByRole("searchbox");
    expect(screen.queryByRole("grid", { name: "Patients" })).toBeNull();
    await user.click(screen.getByText("Exact search"));
    expect(await screen.findByRole("form", { name: "Find by identifier" })).toBeTruthy();
    expect(screen.getByRole("form", { name: "Find by name" })).toBeTruthy();
    expect(screen.queryByRole("grid", { name: "Patients" })).toBeNull();
    expect(screen.queryByRole("button", { name: "More filters" })).toBeNull();
  });

  it("lists patients from Exact search only after a search, and chooses one", async () => {
    const { user, choose } = renderStep();
    await screen.findByRole("searchbox");
    await user.click(screen.getByText("Exact search"));
    const byName = await screen.findByRole("form", { name: "Find by name" });
    await user.type(within(byName).getByRole("textbox", { name: /Family name/ }), "Patient");
    await user.click(within(byName).getByRole("button", { name: "Find by name" }));
    expect(await screen.findByText("1 matching patient")).toBeTruthy();
    await openRow(user, "MRN-00001 (SYN-CLINIC MR)");
    expect(choose).toHaveBeenCalledWith(SUBJECT_ID);
  });
});
