import type { ApiReleaseCreateItem } from "@/lib/api-types";

export function parseKeyValueList(value: string) {
  return Object.fromEntries(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [key, ...rest] = entry.split("=");
        return [key?.trim() ?? "", rest.join("=").trim()] as const;
      })
      .filter(([key, entryValue]) => key && entryValue),
  );
}

export function parseReleaseItems(value: string): ApiReleaseCreateItem[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [componentId, ...rest] = entry.split("=");
      return {
        componentId: componentId?.trim() ?? "",
        version: rest.join("=").trim(),
      };
    })
    .filter((item) => item.componentId && item.version);
}



