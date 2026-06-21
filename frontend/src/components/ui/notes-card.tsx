import { Card, CardContent } from "@/components/ui/card";

export function NotesCard({
  value,
  onChange,
  title = "Notes",
  description = "Add optional context for reviewers, operators, and future audit trails.",
  placeholder = "Optional rollout notes, approvals, or operator context.",
}: {
  value: string;
  onChange: (value: string) => void;
  title?: string;
  description?: string;
  placeholder?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4">
          <div className="text-sm font-bold text-slate-950">{title}</div>
          <div className="mt-1 text-xs font-medium text-slate-500">{description}</div>
        </div>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          placeholder={placeholder}
        />
      </CardContent>
    </Card>
  );
}

