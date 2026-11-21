import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "@/lib/test/a11y";
import { mockCommands } from "@/lib/test/ipc";
import { renderWithProviders } from "@/lib/test/render";
import { AuthLayout } from "./AuthLayout";
import { SignInScreen } from "./SignInScreen";

describe("Sign-in frame (#4885)", () => {
  it("names the laboratory under the product, offers both methods and shows the version", async () => {
    mockCommands({
      setup_status: () => ({
        needsAdministrator: false,
        demoSetupPending: false,
        laboratoryName: "Synthetic Toxicology Laboratory",
      }),
      app_info: () => ({ appVersion: "0.9.0", webviewVersion: null, platform: "linux-x86_64" }),
    });
    const { container } = renderWithProviders(
      <AuthLayout aside={<p>Analyzers</p>} showLaboratory>
        <SignInScreen />
      </AuthLayout>,
    );
    expect(await screen.findByText("Synthetic Toxicology Laboratory")).toBeTruthy();
    expect(await screen.findByText("Version 0.9.0")).toBeTruthy();
    const signIn = screen.getByRole("button", { name: "Sign in" });
    const key = screen.getByRole("button", { name: "Use a security key" });
    expect(signIn.getAttribute("data-variant")).toBe("primary");
    expect(key.getAttribute("data-variant")).toBe("secondary");
    expect(screen.getByText("or")).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it("leaves the laboratory and version out when they cannot be read", async () => {
    mockCommands({ setup_status: () => ({ needsAdministrator: false, laboratoryName: null }) });
    renderWithProviders(
      <AuthLayout showLaboratory>
        <SignInScreen />
      </AuthLayout>,
    );
    expect(await screen.findByRole("button", { name: "Use a security key" })).toBeTruthy();
    expect(screen.queryByText(/^Version/)).toBeNull();
  });
});
