import { useState, type ReactNode } from "react";
import { Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useAppContext } from "@/lib/app-context";
import {
  type ApiComponent,
  type ApiReleaseCreateRequest,
  type ApiEnvironment,
  type ApiComponentVersionCreateRequest,
} from "@/lib/api-client";
import { parseReleaseItems, parseKeyValueList } from "@/lib/form-utils";

export type DialogProps<T> = {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: T) => void;
  pending: boolean;
};

export function ComponentDialog({ open, onClose, onSubmit, pending }: DialogProps<ApiComponent>) {
  const { workspaceId } = useAppContext();
  const [componentId, setComponentId] = useState("");
  const [type, setType] = useState("ecs");
  return (
    <SimpleDialog
      open={open}
      title="Create or update component"
      onClose={onClose}
      onSave={() => onSubmit({ workspaceId, componentId, type, active: true, tags: {} })}
      pending={pending}
    >
      <Field label="Component ID" value={componentId} onChange={setComponentId} />
      <Field label="Type" value={type} onChange={setType} />
    </SimpleDialog>
  );
}

export function VersionDialog({ open, onClose, onSubmit, pending }: DialogProps<ApiComponentVersionCreateRequest>) {
  const [componentId, setComponentId] = useState("");
  const [version, setVersion] = useState("");
  const [artifactKey, setArtifactKey] = useState("s3://version-artifacts/component/version.tar.gz");
  const [notes, setNotes] = useState("");
  return (
    <SimpleDialog
      open={open}
      title="Create version"
      onClose={onClose}
      onSave={() =>
        onSubmit({
          componentId,
          version,
          description: `${componentId} ${version}`,
          notes: notes || null,
          artifact: { key: artifactKey, digest: "" },
          source: null,
          tags: {},
        })
      }
      pending={pending}
    >
      <Field label="Component ID" value={componentId} onChange={setComponentId} />
      <Field label="Version" value={version} onChange={setVersion} />
      <Field label="Artifact key" value={artifactKey} onChange={setArtifactKey} />
      <Field label="Notes" value={notes} onChange={setNotes} />
    </SimpleDialog>
  );
}

export function ReleaseDialog({ open, onClose, onSubmit, pending }: DialogProps<ApiReleaseCreateRequest>) {
  const [releaseId, setReleaseId] = useState("");
  const [baseEnvironmentId, setBaseEnvironmentId] = useState("");
  const [baseReleaseId, setBaseReleaseId] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("track=prod");
  const [items, setItems] = useState("api=1.0.0,worker=1.0.0");
  return (
    <SimpleDialog
      open={open}
      title="Create Release"
      onClose={onClose}
      onSave={() =>
        onSubmit({
          releaseId,
          baseEnvironmentId: baseEnvironmentId || null,
          baseReleaseId: baseReleaseId || null,
          notes: notes || null,
          items: parseReleaseItems(items),
          tags: parseKeyValueList(tags),
        })
      }
      pending={pending}
    >
      <Field label="Release ID" value={releaseId} onChange={setReleaseId} />
      <Field label="Release ID" value={releaseId} onChange={setReleaseId} />
      <Field label="Base environment ID" value={baseEnvironmentId} onChange={setBaseEnvironmentId} />
      <Field label="Base Release ID" value={baseReleaseId} onChange={setBaseReleaseId} />
      <Field label="Items" value={items} onChange={setItems} />
      <Field label="Notes" value={notes} onChange={setNotes} />
      <Field label="Tags" value={tags} onChange={setTags} />
    </SimpleDialog>
  );
}

export function EnvironmentDialog({ open, onClose, onSubmit, pending }: DialogProps<ApiEnvironment>) {
  const { workspaceId } = useAppContext();
  const [environmentId, setEnvironmentId] = useState("");
  return (
    <SimpleDialog
      open={open}
      title="Create or update environment"
      onClose={onClose}
      onSave={() => onSubmit({ workspaceId, environmentId, active: true, tags: {} })}
      pending={pending}
    >
      <Field label="Environment ID" value={environmentId} onChange={setEnvironmentId} />
    </SimpleDialog>
  );
}

export function SimpleDialog({
  open,
  title,
  onClose,
  onSave,
  pending,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onSave: () => void;
  pending: boolean;
  children: ReactNode;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="space-y-3 p-4">
        {children}
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending} onClick={onSave}>
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-slate-800">
      {label}
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
