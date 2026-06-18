import { CheckCircle2, CircleDotDashed, CircleSlash, Loader2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { components } from "@/lib/api-types";

type Status =
  | components["schemas"]["ExecutionStatus"]
  | components["schemas"]["ItemStatus"]
  | "healthy"
  | "degraded"
  | "critical"
  | "warning"
  | "idle";

export function StatusBadge({ status }: { status: Status }) {
  if (status === "running") {
    return (
      <Badge variant="blue">
        <Loader2 className="h-3 w-3 animate-spin" /> Running
      </Badge>
    );
  }

  if (status === "succeeded" || status === "healthy") {
    return (
      <Badge variant="green">
        <CheckCircle2 className="h-3 w-3" /> {status === "healthy" ? "Healthy" : "Succeeded"}
      </Badge>
    );
  }

  if (status === "failed" || status === "critical") {
    return (
      <Badge variant="red">
        <XCircle className="h-3 w-3" /> {status === "critical" ? "Critical" : "Failed"}
      </Badge>
    );
  }

  if (status === "cancelled") {
    return (
      <Badge variant="red">
        <CircleSlash className="h-3 w-3" /> Cancelled
      </Badge>
    );
  }

  if (status === "degraded" || status === "warning") {
    return (
      <Badge variant="orange">
        <CircleDotDashed className="h-3 w-3" /> {status === "warning" ? "Warning" : "Degraded"}
      </Badge>
    );
  }

  if (status === "skipped") {
    return (
      <Badge variant="slate">
        <CircleSlash className="h-3 w-3" /> Skipped
      </Badge>
    );
  }

  return <Badge variant="slate">{status}</Badge>;
}
