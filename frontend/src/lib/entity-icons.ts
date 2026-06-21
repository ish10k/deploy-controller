import { CircleFadingArrowUp, Dock, GitCommitHorizontal, Package, Play, Puzzle, Rocket, Server, Tags, UserRound, Webhook, type LucideIcon } from "lucide-react";

export const ENTITY_ICONS = {
  deployment: Rocket,
  release: Package,
  version: GitCommitHorizontal,
  releaseAlt: Dock,
  component: Puzzle,
  environment: Server,
  runner: Play,
  publisher: CircleFadingArrowUp,
  webhook: Webhook,
  tag: Tags,
  user: UserRound,
} as const satisfies Record<string, LucideIcon>;

export type EntityIconKind = keyof typeof ENTITY_ICONS;


