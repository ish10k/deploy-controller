import { CircleFadingArrowUp, Dock, GitCommitHorizontal, Package, Play, Puzzle, Rocket, Server, UserRoundKey, Webhook, type LucideIcon } from "lucide-react";

export const ENTITY_ICONS = {
  deployment: Rocket,
  deployset: Package,
  release: GitCommitHorizontal,
  componentSet: Dock,
  component: Puzzle,
  environment: Server,
  runner: Play,
  releaseSource: CircleFadingArrowUp,
  webhook: Webhook,
  user: UserRoundKey,
} as const satisfies Record<string, LucideIcon>;

export type EntityIconKind = keyof typeof ENTITY_ICONS;
