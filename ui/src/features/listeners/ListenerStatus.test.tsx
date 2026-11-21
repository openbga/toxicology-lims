import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ListenerStatusView } from "@/generated/ListenerStatusView";
import { expectNoA11yViolations } from "@/lib/test/a11y";
import { engineError, mockCommands } from "@/lib/test/ipc";
import { renderWithProviders } from "@/lib/test/render";
import { ListenerStatus, ListenerSummary } from "./ListenerStatus";

const ANALYZER: ListenerStatusView = {
  instrumentId: "00000000-0000-7000-8000-0000000000a1",
  instrumentName: "Synthetic Analyzer 1",
  state: "receiving",
  lastActivityAt: "2026-10-12T14:03:05Z",
  detail: null,
};

const OPEN_KEY = "vibe-tox.sign-in-analyzers-open-v1";

describe("ListenerStatus (REQ-OPS-013, #4885)", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sums the analyzers up in one line and opens one row per analyzer on request", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-12T20:00:00Z"), shouldAdvanceTime: true });
    mockCommands({
      list_listener_status: () => [
        ANALYZER,
        {
          ...ANALYZER,
          instrumentId: "00000000-0000-7000-8000-0000000000a2",
          instrumentName: "Synthetic Analyzer 2",
          state: "error",
          lastActivityAt: null,
          detail: "open_failed",
        },
      ],
    });
    const { user, container } = renderWithProviders(<ListenerStatus />);
    const summary = await screen.findByRole("button", {
      name: /^2 analyzers: 1 error, 1 receiving.*Results are received while nobody is signed in\.$/,
    });
    expect(summary.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("table")).toBeNull();
    await user.click(summary);
    const table = screen.getByRole("table");
    expect(within(table).getByRole("rowheader", { name: "Synthetic Analyzer 1" })).toBeTruthy();
    expect(within(table).getByText("Receiving")).toBeTruthy();
    expect(within(table).getByText("today 14:03").getAttribute("title")).toBe(
      "2026-10-12 14:03 UTC",
    );
    expect(within(table).getByText("Could not open the connection")).toBeTruthy();
    expect(within(table).getByText("None yet")).toBeTruthy();
    expect(localStorage.getItem(OPEN_KEY)).toBe("true");
    await expectNoA11yViolations(container);
    await user.click(summary);
    expect(screen.queryByRole("table")).toBeNull();
    expect(localStorage.getItem(OPEN_KEY)).toBe("false");
  });

  it("opens as it was last left on this computer", async () => {
    localStorage.setItem(OPEN_KEY, "true");
    mockCommands({ list_listener_status: () => [ANALYZER] });
    renderWithProviders(<ListenerStatus />);
    expect(await screen.findByRole("table")).toBeTruthy();
    expect(screen.getByText("2026-10-12 14:03")).toBeTruthy();
  });

  it("after an update, says how many analyzers listen again and why others did not", async () => {
    mockCommands({
      list_listener_status: () => [ANALYZER],
      get_listener_restart: () => ({
        listening: 4,
        failed: [{ ...ANALYZER, instrumentName: "AU-SER", state: "error", detail: "open_failed" }],
      }),
    });
    const { container } = renderWithProviders(<ListenerStatus />);
    expect(await screen.findByText(/4 analyzers listening again/)).toBeTruthy();
    expect(screen.getByText("AU-SER: Could not open the connection")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("says when a folder cannot be read, has files waiting or too large (result files §6)", async () => {
    localStorage.setItem(OPEN_KEY, "true");
    mockCommands({
      list_listener_status: () => [
        { ...ANALYZER, state: "error", detail: "folder_unavailable", filesWaiting: 0 },
        {
          ...ANALYZER,
          instrumentId: "00000000-0000-7000-8000-0000000000a2",
          instrumentName: "Synthetic LC-MS/MS 1",
          state: "listening",
          detail: "files_waiting",
          filesWaiting: 1,
        },
        {
          ...ANALYZER,
          instrumentId: "00000000-0000-7000-8000-0000000000a3",
          state: "listening",
          detail: "file_too_large",
          filesTooLarge: 2,
        },
      ],
    });
    renderWithProviders(<ListenerStatus />);
    expect(await screen.findByText("The watched folder cannot be read")).toBeTruthy();
    expect(screen.getByText("1 file waiting to be read for more than 5 minutes")).toBeTruthy();
    expect(
      screen.getByText(
        "2 files in the folder are larger than the 20 MiB the LIS reads and were not read",
      ),
    ).toBeTruthy();
  });

  it("says when no instruments are configured, without a list to open", async () => {
    mockCommands({ list_listener_status: () => [] });
    renderWithProviders(<ListenerStatus />);
    expect(await screen.findByText("No instruments configured")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows a neutral unavailable state when the status cannot be read", async () => {
    localStorage.setItem(OPEN_KEY, "true");
    mockCommands({
      list_listener_status: () => Promise.reject(engineError("internal", "Not available.")),
    });
    renderWithProviders(<ListenerStatus />);
    expect(await screen.findByText("Analyzers: status unavailable")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("asks for the status again every 10 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const list = vi
      .fn<() => ListenerStatusView[]>()
      .mockReturnValueOnce([{ ...ANALYZER, state: "listening" }])
      .mockReturnValue([ANALYZER]);
    mockCommands({ list_listener_status: list });
    renderWithProviders(<ListenerStatus />);
    expect(await screen.findByText("1 analyzer: 1 listening")).toBeTruthy();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await screen.findByText("1 analyzer: 1 receiving")).toBeTruthy();
    expect(list).toHaveBeenCalledTimes(2);
  });
});

describe("ListenerSummary (REQ-OPS-013)", () => {
  it("counts the listeners by state, errors first, and lists each one on request", async () => {
    mockCommands({
      list_listener_status: () => [
        { ...ANALYZER, state: "listening", lastActivityAt: null },
        { ...ANALYZER, instrumentId: "00000000-0000-7000-8000-0000000000a2", state: "connected" },
        {
          ...ANALYZER,
          instrumentId: "00000000-0000-7000-8000-0000000000a3",
          instrumentName: "Synthetic Analyzer 3",
          state: "error",
          detail: "transport_failed",
        },
      ],
    });
    const { user, container } = renderWithProviders(<ListenerSummary />);
    const summary = await screen.findByRole("button", {
      name: "3 analyzers: 1 error, 1 connected, 1 listening",
    });
    await expectNoA11yViolations(container);
    await user.click(summary);
    const dialog = await screen.findByRole("dialog", { name: "Analyzer listeners" });
    expect(within(dialog).getByText("Synthetic Analyzer 3")).toBeTruthy();
    expect(within(dialog).getByText("Connection failed")).toBeTruthy();
    expect(within(dialog).getAllByText("2026-10-12 14:03 UTC")).toHaveLength(2);
  });

  it("colors each state: Connected green, Listening blue, Disabled grey, Error red (#4792)", async () => {
    localStorage.setItem(OPEN_KEY, "true");
    mockCommands({
      list_listener_status: () => [
        { ...ANALYZER, state: "listening" },
        { ...ANALYZER, instrumentId: "00000000-0000-7000-8000-0000000000a2", state: "connected" },
        { ...ANALYZER, instrumentId: "00000000-0000-7000-8000-0000000000a3", state: "disabled" },
        { ...ANALYZER, instrumentId: "00000000-0000-7000-8000-0000000000a4", state: "error" },
        { ...ANALYZER, instrumentId: "00000000-0000-7000-8000-0000000000a5", state: "manual_only" },
      ],
    });
    renderWithProviders(<ListenerStatus />);
    const tone = async (label: string) =>
      (await screen.findByText(label)).closest("[data-tone]")?.getAttribute("data-tone");
    expect(await tone("Listening")).toBe("info");
    expect(await tone("Connected")).toBe("success");
    expect(await tone("Disabled")).toBe("neutral");
    expect(await tone("Error")).toBe("danger");
    expect(await tone("Manual loading only")).toBe("neutral");
  });

  it("gives the summary the tone of the state it counts first (#4792)", async () => {
    mockCommands({
      list_listener_status: () => [
        { ...ANALYZER, state: "listening" },
        { ...ANALYZER, instrumentId: "00000000-0000-7000-8000-0000000000a2", state: "connected" },
      ],
    });
    renderWithProviders(<ListenerSummary />);
    const summary = await screen.findByRole("button", {
      name: "2 analyzers: 1 connected, 1 listening",
    });
    expect(summary.querySelector("[data-tone]")?.getAttribute("data-tone")).toBe("success");
  });

  it("names one analyzer in the singular", async () => {
    mockCommands({ list_listener_status: () => [ANALYZER] });
    renderWithProviders(<ListenerSummary />);
    expect(await screen.findByRole("button", { name: "1 analyzer: 1 receiving" })).toBeTruthy();
  });

  it("says when no instruments are configured", async () => {
    mockCommands({ list_listener_status: () => [] });
    renderWithProviders(<ListenerSummary />);
    expect(await screen.findByRole("button", { name: "No instruments configured" })).toBeTruthy();
  });

  // A failed read never shows the last known states as current.
  it("says the status is unavailable when it cannot be read", async () => {
    mockCommands({
      list_listener_status: () => Promise.reject(engineError("internal", "Not available.")),
    });
    renderWithProviders(<ListenerSummary />);
    expect(
      await screen.findByRole("button", { name: "Analyzers: status unavailable" }),
    ).toBeTruthy();
  });
});
