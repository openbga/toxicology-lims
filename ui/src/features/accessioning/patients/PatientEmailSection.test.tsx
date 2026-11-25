import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockCommands } from "@/lib/test/ipc";
import { mockGridLayout } from "@/lib/test/layout";
import { renderRoutes } from "@/lib/test/router";
import { SUBJECT_ID, SUBJECT_VIEW, sessionWith } from "../testData";
import { PatientDetailPage } from "./PatientDetailPage";

const WITH_EMAIL = {
  ...SUBJECT_VIEW,
  email: { address: "test.patient@example.com", recordedAt: "1970-01-01T00:00:00Z" },
};

function renderPage(commands: Record<string, (args: unknown) => unknown>) {
  mockCommands(commands);
  return renderRoutes(
    [{ path: "/patients/:subjectId", element: <PatientDetailPage /> }],
    `/patients/${SUBJECT_ID}`,
  );
}

async function portalSection() {
  const heading = await screen.findByRole("heading", { name: "Patient portal" });
  return heading.closest("section") ?? document.body;
}

describe("Patient portal email", () => {
  beforeEach(mockGridLayout);

  it("says nothing is sent without an email, and records one with the consent text", async () => {
    const setEmail = vi.fn(() => ({ revision: SUBJECT_VIEW.revision + 1, hasEmail: true }));
    const { user } = renderPage({
      get_subject: () => SUBJECT_VIEW,
      current_session: () => sessionWith(["enter_orders"]),
      set_subject_email: setEmail,
    });
    const section = await portalSection();
    expect(within(section).getByText("None. Nothing is sent to the patient portal.")).toBeTruthy();
    await user.click(within(section).getByRole("button", { name: "Add email" }));
    const dialog = await screen.findByRole("dialog", { name: "Add patient email" });
    await user.hover(within(dialog).getByRole("button", { name: "About Email" }));
    // The tooltip opens outside the modal dialog, which hides the rest of the page from roles.
    expect(await screen.findByText(/means the patient agrees to see their results/)).toBeTruthy();
    await user.type(
      within(dialog).getByRole("textbox", { name: "Email" }),
      "test.patient@example.com",
    );
    await user.click(within(dialog).getByRole("button", { name: "Save email" }));
    expect(await screen.findByText("Email saved")).toBeTruthy();
    expect(setEmail).toHaveBeenCalledWith({
      input: {
        subjectId: SUBJECT_ID,
        expectedRevision: SUBJECT_VIEW.revision,
        email: "test.patient@example.com",
      },
    });
  });

  it("removes the email when the field is cleared", async () => {
    const setEmail = vi.fn(() => ({ revision: SUBJECT_VIEW.revision + 1, hasEmail: false }));
    const { user } = renderPage({
      get_subject: () => WITH_EMAIL,
      current_session: () => sessionWith(["enter_orders"]),
      set_subject_email: setEmail,
    });
    const section = await portalSection();
    expect(within(section).getByText("test.patient@example.com")).toBeTruthy();
    await user.click(within(section).getByRole("button", { name: "Change email" }));
    const dialog = await screen.findByRole("dialog", { name: "Change patient email" });
    await user.clear(within(dialog).getByRole("textbox", { name: "Email" }));
    await user.click(within(dialog).getByRole("button", { name: "Save email" }));
    expect(await screen.findByText("Email removed")).toBeTruthy();
    expect(setEmail).toHaveBeenCalledWith({
      input: { subjectId: SUBJECT_ID, expectedRevision: SUBJECT_VIEW.revision, email: null },
    });
  });

  it("refuses a malformed email before sending it", async () => {
    const setEmail = vi.fn();
    const { user } = renderPage({
      get_subject: () => SUBJECT_VIEW,
      current_session: () => sessionWith(["enter_orders"]),
      set_subject_email: setEmail,
    });
    const section = await portalSection();
    await user.click(within(section).getByRole("button", { name: "Add email" }));
    const dialog = await screen.findByRole("dialog", { name: "Add patient email" });
    await user.type(within(dialog).getByRole("textbox", { name: "Email" }), "not-an-email");
    await user.click(within(dialog).getByRole("button", { name: "Save email" }));
    expect(
      await within(dialog).findByText(
        "Wrong email format. Enter an email such as name@example.com.",
      ),
    ).toBeTruthy();
    expect(setEmail).not.toHaveBeenCalled();
  });

  it("shows the email without changing it to staff without order entry", async () => {
    renderPage({
      get_subject: () => WITH_EMAIL,
      current_session: () => sessionWith(["manage_quality"]),
    });
    const section = await portalSection();
    expect(within(section).getByText("test.patient@example.com")).toBeTruthy();
    expect(within(section).queryByRole("button", { name: "Change email" })).toBeNull();
  });
});
