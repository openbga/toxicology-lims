import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PartnerMessageRow } from "@/generated/PartnerMessageRow";
import { engineError, mockCommands } from "@/lib/test/ipc";
import { mockGridLayout } from "@/lib/test/layout";
import { renderRoutes } from "@/lib/test/router";
import { detailText, problemText, transportOf } from "../labels";
import {
  ADMIN,
  CONNECTION,
  CONNECTION_ID,
  DETAIL,
  HL7_PORTAL,
  MAPPINGS,
  PORTAL,
} from "../testData";
import { ConnectionPage } from "./ConnectionPage";
import { ConnectionsPage } from "./ConnectionsPage";
import { toSettings, toValues, typedSecret } from "./connectionForm";

const ROUTES = [
  { path: "/interfaces/connections", element: <ConnectionsPage /> },
  { path: "/interfaces/connections/:connectionId/:tab?", element: <ConnectionPage /> },
];

const SIGNED_IN = { problem: null, fileName: null, presentedFingerprint: null };
const INGEST = "https://ingest.example.com/api/labs/demo-lab/ingest";

function renderPage(handlers: Record<string, (args: unknown) => unknown>, path: string) {
  mockCommands({
    current_session: () => ADMIN,
    list_partner_connections: () => [CONNECTION, HL7_PORTAL],
    list_unrouted_partner_messages: () => [],
    get_partner_connection: () => ({ ...DETAIL, connection: HL7_PORTAL }),
    list_partner_mappings: () => MAPPINGS,
    ...handlers,
  });
  return renderRoutes(ROUTES, path);
}

/** Opens Add connection with HL7 Results and the portal chosen. */
async function addPortal(user: ReturnType<typeof renderPage>["user"]) {
  await user.click(await screen.findByRole("button", { name: "Add connection" }));
  const dialog = await screen.findByRole("dialog", { name: "Add connection" });
  await user.type(within(dialog).getByRole("textbox", { name: "Name" }), "Patient portal");
  await user.type(within(dialog).getByRole("textbox", { name: "Partner (client)" }), "LIMSiq");
  await user.click(within(dialog).getByRole("button", { name: /Message/ }));
  await user.click(await screen.findByRole("option", { name: /HL7 Results/ }));
  await user.click(within(dialog).getByRole("radio", { name: /LIMSiq Patient Portal/ }));
  return dialog;
}

describe("LIMSiq Patient Portal connection (#4672)", () => {
  beforeEach(mockGridLayout);

  it("offers the portal for HL7 results only", async () => {
    const { user } = renderPage({}, "/interfaces/connections");
    await user.click(await screen.findByRole("button", { name: "Add connection" }));
    const dialog = await screen.findByRole("dialog", { name: "Add connection" });
    await user.click(within(dialog).getByRole("button", { name: /Message/ }));
    await user.click(await screen.findByRole("option", { name: "Report PDF" }));
    const portal = within(dialog).getByRole("radio", { name: /LIMSiq Patient Portal/ });
    expect(portal.hasAttribute("disabled")).toBe(true);
  });

  it("saves a new connection with the ingest address, code, API user and token", async () => {
    const created = vi.fn(() => ({ ...DETAIL, connection: HL7_PORTAL }));
    const { user } = renderPage({ create_partner_connection: created }, "/interfaces/connections");
    const dialog = await addPortal(user);
    expect(within(dialog).getByText("3. LIMSiq Patient Portal")).toBeTruthy();
    expect(within(dialog).queryByRole("textbox", { name: "File name" })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Test connection" })).toBeNull();
    await user.type(
      within(dialog).getByRole("textbox", { name: "Ingest address" }),
      PORTAL.baseUrl,
    );
    await user.type(within(dialog).getByRole("textbox", { name: "Laboratory code" }), "demo-lab");
    await user.type(within(dialog).getByRole("textbox", { name: "API user" }), "lab-7-abcd1234");
    await user.type(within(dialog).getByLabelText(/API token/), "synthetic-token");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(created).toHaveBeenCalled());
    const { input } = (created.mock.calls[0] as unknown as [{ input: Record<string, unknown> }])[0];
    expect(input.password).toBe("synthetic-token");
    expect(input.folderChoice).toBeUndefined();
    expect(input.settings).toMatchObject({
      protocol: "portal_https",
      fileNamePattern: "",
      portal: PORTAL,
      sftp: null,
      mllp: null,
    });
  });

  it("asks for the token on a new connection before saving", async () => {
    const created = vi.fn();
    const { user } = renderPage({ create_partner_connection: created }, "/interfaces/connections");
    const dialog = await addPortal(user);
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("Enter the API token LIMSiq gave you.")).toBeTruthy();
    expect(created).not.toHaveBeenCalled();
  });

  it("keeps the saved token when the field is left empty, and shows engine errors on their fields", async () => {
    const updated = vi.fn(() =>
      Promise.reject(
        engineError("validation", "Check the highlighted fields.", {
          fieldErrors: [
            {
              field: "settings.portal.baseUrl",
              code: "invalid_address",
              message:
                "Enter an https:// address with no path, such as https://ingest.example.com.",
            },
            {
              field: "settings.portal.labCode",
              code: "invalid",
              message: "Enter the laboratory code LIMSiq gave you.",
            },
          ],
        }),
      ),
    );
    const { user } = renderPage(
      { update_partner_connection: updated },
      `/interfaces/connections/${CONNECTION_ID}`,
    );
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Change Patient portal" });
    expect(within(dialog).getByText(/Leave empty to keep the saved token/)).toBeTruthy();
    await user.type(within(dialog).getByRole("textbox", { name: /Reason/ }), "New channel");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updated).toHaveBeenCalled());
    const { input } = (updated.mock.calls[0] as unknown as [{ input: Record<string, unknown> }])[0];
    expect(input).not.toHaveProperty("password");
    expect(
      await within(dialog).findByText(
        "Enter an https:// address with no path, such as https://ingest.example.com.",
      ),
    ).toBeTruthy();
    const code = within(dialog).getByRole("textbox", { name: "Laboratory code" });
    expect(code.getAttribute("aria-invalid")).toBe("true");
  });

  it("shows the portal's settings, never its token, and offers no test message", async () => {
    const tested = vi.fn(() => SIGNED_IN);
    const { user } = renderPage(
      { test_partner_folder: tested },
      `/interfaces/connections/${CONNECTION_ID}`,
    );
    expect(
      await screen.findByText(
        "Sends an HL7 ORU result message with the partner's codes to the LIMSiq Patient Portal over HTTPS when results are released.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("LIMSiq Patient Portal – HTTPS")).toBeTruthy();
    expect(screen.getByText(INGEST)).toBeTruthy();
    expect(screen.getByText("lab-7-abcd1234")).toBeTruthy();
    expect(screen.getByText("Kept sealed")).toBeTruthy();
    expect(screen.queryByText("File name")).toBeNull();
    expect(screen.queryByRole("button", { name: "Send test message" })).toBeNull();
    expect(screen.getByText(/No test message to the portal/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Test connection" }));
    await waitFor(() =>
      expect(tested).toHaveBeenCalledWith({ input: { connectionId: CONNECTION_ID } }),
    );
    expect(
      await screen.findByText("✓ The portal accepted the API user and token; nothing was filed."),
    ).toBeTruthy();
  });

  it("says why Test connection failed", async () => {
    const { user } = renderPage(
      { test_partner_folder: () => ({ ...SIGNED_IN, problem: "portal_unauthorized" }) },
      `/interfaces/connections/${CONNECTION_ID}`,
    );
    await user.click(await screen.findByRole("button", { name: "Test connection" }));
    expect(
      await screen.findByText(/✗ Not done: The portal refused the API user or token/),
    ).toBeTruthy();
  });

  it("lists the ingest address as the connection's destination", async () => {
    renderPage({}, "/interfaces/connections");
    const row = await screen.findByRole("row", { name: /Patient portal/ });
    expect(within(row).getByText(INGEST)).toBeTruthy();
    expect(within(row).getByText("LIMSiq Patient Portal")).toBeTruthy();
  });

  it("maps saved settings to the form and back, without the token", () => {
    const values = toValues(HL7_PORTAL);
    expect(values.portal).toEqual({ ...PORTAL, token: "" });
    expect(typedSecret(values)).toBeUndefined();
    expect(typedSecret({ ...values, portal: { ...values.portal, token: "t" } })).toBe("t");
    expect(toSettings({ ...values, fileNamePattern: "left-over.hl7" })).toMatchObject({
      portal: PORTAL,
      fileNamePattern: "",
    });
    expect(toSettings(toValues(CONNECTION)).portal).toBeNull();
  });

  it("words the portal's codes, waits and answers in Logs", () => {
    expect(problemText("portal_unreachable")).toMatch(/did not answer/);
    expect(problemText("token_unreadable")).toMatch(/enter it again/);
    const row = {
      connection: { protocol: "portal_https" },
      transport: "written",
      writtenPath: INGEST,
      ackCode: "AR",
      ackText: "Unknown practitioner",
      reason: null,
      superseded: false,
      unrouted: false,
      received: null,
    } as unknown as PartnerMessageRow;
    expect(transportOf(row).label).toBe("Sent");
    expect(detailText(row, String)).toBe(`Sent to ${INGEST} · Portal: Unknown practitioner`);
    const held = {
      ...row,
      writtenPath: null,
      ackCode: null,
      attempts: 0,
      givenUp: false,
      errorCode: null,
      waiting: "no_portal_email",
    } as PartnerMessageRow;
    expect(detailText(held, String)).toMatch(/no email for the patient portal/);
    expect(detailText({ ...held, waiting: "no_practitioner_phone" }, String)).toMatch(
      /Laboratory setup › Practitioners/,
    );
  });
});
