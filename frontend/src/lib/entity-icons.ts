import { CircleFadingArrowUp, Dock, GitCommitHorizontal, Package, Play, Puzzle, Rocket, Server, UserRound, Webhook, type LucideIcon } from "lucide-react";

export const ENTITY_ICONS = {
  deployment: Rocket,
  deployset: Package,
  release: GitCommitHorizontal,
  componentSet: Dock,
  component: Puzzle,
  environment: Server,
  runner: Play,
  publisher: CircleFadingArrowUp,
  webhook: Webhook,
  user: UserRound,
} as const satisfies Record<string, LucideIcon>;

export type EntityIconKind = keyof typeof ENTITY_ICONS;
