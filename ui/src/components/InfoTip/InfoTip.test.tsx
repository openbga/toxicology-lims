import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { InfoTip } from "./InfoTip";

describe("InfoTip", () => {
  it("shows its text on hover and on keyboard focus, and not before", async () => {
    const user = userEvent.setup();
    render(<InfoTip label="Email" text="Why this matters." />);
    const icon = screen.getByRole("button", { name: "About Email" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    // A pointer was used before, as in the application: tooltips open on hover only then.
    await user.click(document.body);
    await user.hover(icon);
    expect((await screen.findByRole("tooltip")).textContent).toBe("Why this matters.");
    await user.unhover(icon);
    await user.keyboard("{Escape}");
    await user.tab();
    expect(document.activeElement).toBe(icon);
    expect((await screen.findByRole("tooltip")).textContent).toBe("Why this matters.");
  });
});
