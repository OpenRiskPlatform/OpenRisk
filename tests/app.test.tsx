import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "@/App";
import { createClient } from "./fixtures";

describe("App project lifecycle", () => {
  it("uses OpenRisk branding by default", () => {
    render(<App client={createClient()} />);

    expect(screen.getByRole("img", { name: "OpenRisk" })).toBeVisible();
  });

  it("closes a project when initial workspace loading fails", async () => {
    const user = userEvent.setup();
    const client = createClient({
      loadSettings: vi.fn(async () => {
        throw new Error("Settings are unavailable");
      }),
    });
    localStorage.setItem(
      "openrisk:recent-projects",
      JSON.stringify(["/tmp/demo.orproj"]),
    );

    render(<App client={client} />);
    await user.click(screen.getByText("demo"));

    await waitFor(() => {
      expect(client.openProject).toHaveBeenCalledTimes(1);
      expect(client.closeProject).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Settings are unavailable",
    );
  });
});
