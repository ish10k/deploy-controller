import { Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type IssuedCredential = {
  id: string;
  token: string;
};

export function IssuedTokenToast({ credential }: { credential: IssuedCredential }) {
  const [copied, setCopied] = useState(false);
  const copyToken = async () => {
    await navigator.clipboard.writeText(credential.token);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="mt-3 grid gap-2">
      <p className="text-sm">Copy this PAT now. For safety, the raw token is only shown once.</p>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-80">{credential.id}</div>
      <div className="flex gap-2">
        <Input readOnly value={credential.token} className="h-9 bg-white font-mono text-xs" />
        <Button type="button" variant="outline" className="h-9 shrink-0 bg-white" onClick={copyToken}>
          <Copy className="h-4 w-4" />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
