type TagListProps = {
  tags?: Record<string, string> | null;
  limit?: number;
  emptyLabel?: string;
};

export function TagList({ tags, limit, emptyLabel = "-" }: TagListProps) {
  const entries = Object.entries(tags ?? {});

  if (!entries.length) {
    return <span className="text-slate-400">{emptyLabel}</span>;
  }

  const visible = limit ? entries.slice(0, limit) : entries;
  const hidden = limit ? entries.length - visible.length : 0;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map(([key, value]) => (
        <Tag key={key} label={value ? `${key}:${value}` : key} />
      ))}
      {hidden > 0 ? <Tag label={`+${hidden}`} /> : null}
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600">{label}</span>;
}

