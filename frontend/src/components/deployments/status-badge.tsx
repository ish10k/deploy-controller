import { Ban, Check, CircleDotDashed, CircleSlash, Hourglass, Loader2, Rocket, XCircle } from "lucide-react";

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

type Action = components["schemas"]["RequestedAction"] | components["schemas"]["ReportedAction"];

type BadgeIconProps = {
  status: Status;
};

type ActionBadgeProps = {
  action: Action;
  failed?: boolean;
  kind: "requested" | "reported";
};

export function StatusBadge({ status }: BadgeIconProps) {
  if (status === "running") {
    return (
      <Badge variant="blue">
        <Loader2 className="h-3 w-3 animate-spin" /> Running
      </Badge>
    );
  }

  if (status === "pending") {
    return (
      <Badge variant="orange">
        <Hourglass className="h-3 w-3" /> Pending
      </Badge>
    );
  }

  if (status === "claimed") {
    return (
      <Badge variant="blue">
        <Rocket className="h-3 w-3" /> Claimed
      </Badge>
    );
  }

  if (status === "succeeded" || status === "healthy") {
    return (
      <Badge variant="green">
        <Check className="h-3 w-3" /> {status === "healthy" ? "Healthy" : "Succeeded"}
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
        <Ban className="h-3 w-3" /> Cancelled
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

export function ActionBadge({ action, failed = false, kind }: ActionBadgeProps) {
  const rendered = renderActionBadge(action, kind, failed);
  return <Badge variant={rendered.variant}>{rendered.content}</Badge>;
}

export function RequestedActionBadge({ action }: { action: components["schemas"]["RequestedAction"] }) {
  return <ActionBadge action={action} kind="requested" />;
}

export function ReportedActionBadge({ action, failed = false }: { action: components["schemas"]["ReportedAction"]; failed?: boolean }) {
  return <ActionBadge action={action} kind="reported" failed={failed} />;
}

function renderActionBadge(action: Action, kind: "requested" | "reported", failed: boolean) {
  if (action === "skip") {
    return {
      variant: failed ? ("red" as const) : ("slate" as const),
      content: (
        <>
          <CircleSlash className="h-3 w-3" /> {kind === "requested" ? "No change" : "Skipped"}
        </>
      ),
    };
  }

  if (action === "noop") {
    return {
      variant: failed ? ("red" as const) : ("slate" as const),
      content: (
        <>
          <CircleSlash className="h-3 w-3" /> No-op
        </>
      ),
    };
  }

  return {
    variant: failed ? ("red" as const) : ("blue" as const),
    content: (
      <>
        <Rocket className="h-3 w-3" /> {kind === "requested" ? "Deploy" : failed ? "Update failed" : "Deployed"}
      </>
    ),
  };
}
