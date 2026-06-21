import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function JsonDetail({ title, value }: { title: string; value: unknown }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="max-h-[520px] overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
          {JSON.stringify(value, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}

