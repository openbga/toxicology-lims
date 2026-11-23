import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useRecordQuery, useRecordSwitching } from "./recordQuery";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (_command: string, args: { input: { id: string } }) => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    return { id: args.input.id };
  }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useRecordQuery", () => {
  it("keeps the previous record, marked as switching, until the next one loads", async () => {
    const { result, rerender } = renderHook(
      ({ id }) => ({
        query: useRecordQuery<{ id: string }>("get_run", { input: { id } }),
        switching: useRecordSwitching(),
      }),
      { wrapper, initialProps: { id: "a" } },
    );
    await waitFor(() => expect(result.current.query.data).toEqual({ id: "a" }));
    expect(result.current.switching).toBe(false);

    rerender({ id: "b" });
    // The first record stays on screen, and nothing can act on it.
    expect(result.current.query.data).toEqual({ id: "a" });
    await waitFor(() => expect(result.current.switching).toBe(true));

    await act(async () => {
      await waitFor(() => expect(result.current.query.data).toEqual({ id: "b" }));
    });
    expect(result.current.switching).toBe(false);
  });
});
