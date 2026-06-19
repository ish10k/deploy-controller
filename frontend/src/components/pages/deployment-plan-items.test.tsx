import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { PlanItems } from "./deployment-plan-items";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

describe("PlanItems", () => {
  it("shows a matcher warning when the plan has no valid matcher", () => {
    render(
      <PlanItems
        items={[
          {
            componentId: "api",
            version: "1.2.3",
            requestedAction: "deploy",
            requestedReason: "missing_latest_execution_item",
          } as never,
        ]}
        currentVersions={new Map()}
        releaseCreatedAtByKey={new Map()}
      />,
    );

    expect(screen.getByText("No valid matcher")).toBeInTheDocument();
  });
});
