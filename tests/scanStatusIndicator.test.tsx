import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScanStatusIndicator } from "@/investigations/ScanStatusIndicator";

describe("ScanStatusIndicator", () => {
  it("shows completed status without a success icon", () => {
    const { container } = render(
      <ScanStatusIndicator status="Completed" />,
    );

    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders nothing for an icon-only completed status", () => {
    const { container } = render(
      <ScanStatusIndicator status="Completed" showLabel={false} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("keeps a visible marker for drafts", () => {
    const { container } = render(
      <ScanStatusIndicator status="Draft" showLabel={false} />,
    );

    expect(screen.getByLabelText("Draft")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
