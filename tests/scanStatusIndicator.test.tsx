import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScanStatusIndicator } from "@/investigations/ScanStatusIndicator";

describe("ScanStatusIndicator", () => {
  it("hides completed status", () => {
    const { container } = render(
      <ScanStatusIndicator status="Completed" />,
    );

    expect(container).toBeEmptyDOMElement();
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

  it("shows failed when a completed scan contains failed results", () => {
    render(<ScanStatusIndicator status="Completed" hasFailures />);

    expect(screen.getByText("Failed")).toBeInTheDocument();
  });
});
