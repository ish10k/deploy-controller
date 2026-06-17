import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApiErrorPanel } from "@/components/common/api-state";

describe("ApiErrorPanel", () => {
  it("prompts the user to configure a working API", () => {
    render(<ApiErrorPanel error={new Error("Unable to reach the DeploySet API.")} />);

    expect(screen.getByText("API connection needed")).toBeInTheDocument();
    expect(screen.getByText(/VITE_API_TARGET/)).toBeInTheDocument();
    expect(screen.getByText(/uvicorn src.interfaces.fastapi.app:app/)).toBeInTheDocument();
  });
});
