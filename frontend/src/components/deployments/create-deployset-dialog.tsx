import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";

const schema = z.object({
  deploySetId: z.string().min(3),
  componentSetId: z.string().min(3),
  createdBy: z.string().min(2),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CreateDeploySetDialog({ open, onClose }: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      deploySetId: "webstack-prod-v6",
      componentSetId: "prod-config-2024-06-01",
      createdBy: "amit.kumar",
    },
  });

  return (
    <Modal open={open} title="Create DeploySet" onClose={onClose}>
      <form
        className="space-y-4 p-4"
        onSubmit={handleSubmit(() => {
          onClose();
        })}
      >
        <Field label="DeploySet ID" error={errors.deploySetId?.message}>
          <Input {...register("deploySetId")} />
        </Field>
        <Field label="ConfigSet" error={errors.componentSetId?.message}>
          <Input {...register("componentSetId")} />
        </Field>
        <Field label="Created by" error={errors.createdBy?.message}>
          <Input {...register("createdBy")} />
        </Field>
        <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            <Plus className="h-4 w-4" />
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-slate-800">
      {label}
      {children}
      {error ? <span className="text-xs font-medium text-red-600">{error}</span> : null}
    </label>
  );
}
