import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ApiErrorPanel } from "@/components/common/api-state";
import { ApiRequestError } from "@/lib/api-client";

afterEach(() => cleanup());

describe("ApiErrorPanel", () => {
  it("prompts the user to configure a working API", () => {
    render(<ApiErrorPanel error={new Error("Unable to reach the Release API.")} />);

    expect(screen.getByText("API connection needed")).toBeInTheDocument();
    expect(screen.getByText(/VITE_API_TARGET/)).toBeInTheDocument();
    expect(screen.getByText(/uvicorn src.interfaces.fastapi.app:app/)).toBeInTheDocument();
  });

  it("shows not found errors without backend startup instructions", () => {
    const rendered = render(<ApiErrorPanel error={new ApiRequestError("DeploymentRunner not found: xwq", 404)} />);

    expect(screen.getByText("Record not found")).toBeInTheDocument();
    expect(screen.getByText("DeploymentRunner not found: xwq")).toBeInTheDocument();
    expect(within(rendered.container).queryByText(/VITE_API_TARGET/)).not.toBeInTheDocument();
  });
});



