import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Search, Trash2 } from "lucide-react";

import { ApiErrorPanel, EmptyPanel, LoadingPanel, PageHeader } from "@/components/common/api-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EntityLink } from "@/components/ui/entity-link";
import { Input } from "@/components/ui/input";
import { RequiredMark } from "@/components/ui/required-mark";
import { Select } from "@/components/ui/select";
import { SideDrawer } from "@/components/ui/side-drawer";
import { TagList } from "@/components/ui/tag-list";
import { TagsCard, createTagDraft, tagsToRecord, validateTagDrafts, type TagDraft } from "@/components/ui/tags-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listComponents, listComponentSets, putComponentSet, queryKeys, type ApiComponentSet } from "@/lib/api-client";
import { formatRelativeTime, tagSummary } from "@/lib/format";

export function ComponentSetsPage({
  embedded = false,
  createSignal = 0,
  search: externalSearch,
  refreshSignal = 0,
  onCreateComponent,
}: {
  embedded?: boolean;
  createSignal?: number;
  search?: string;
  refreshSignal?: number;
  onCreateComponent?: () => void;
} = {}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [componentFilter, setComponentFilter] = useState("all");
  const query = useQuery({ queryKey: queryKeys.componentSets, queryFn: listComponentSets });
  const componentsQuery = useQuery({ queryKey: queryKeys.components, queryFn: listComponents });
  const mutation = useMutation({
    mutationFn: (componentSet: ApiComponentSet) => putComponentSet(componentSet.componentSetId, componentSet),
    onSuccess: async (componentSet) => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.componentSets });
      await navigate({ to: "/component-sets/$componentSetId", params: { componentSetId: componentSet.componentSetId } });
    },
  });

  useEffect(() => {
    if (createSignal > 0) {
      setOpen(true);
    }
  }, [createSignal]);
  useEffect(() => {
    if (refreshSignal > 0) {
      void query.refetch();
      void componentsQuery.refetch();
    }
  }, [refreshSignal]);
  const componentSets = query.data ?? [];
  const componentOptions = useMemo(() => {
    const registered = (componentsQuery.data ?? []).map((component) => component.componentId);
    const referenced = componentSets.flatMap((componentSet) => componentSet.components.map((component) => component.componentId));
    return Array.from(new Set([...registered, ...referenced])).sort();
  }, [componentSets, componentsQuery.data]);
  const filteredComponentSets = useMemo(() => {
    const normalizedSearch = (externalSearch ?? search).trim().toLowerCase();

    return componentSets.filter((componentSet) => {
      if (componentFilter !== "all" && !componentSet.components.some((component) => component.componentId === componentFilter)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        componentSet.componentSetId,
        componentSet.description ?? "",
        componentSet.createdBy,
        componentSet.components.map((component) => component.componentId).join(" "),
        tagSummary(componentSet.tags),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [componentFilter, componentSets, externalSearch, search]);

  if (query.isLoading) return <LoadingPanel label="Loading component sets..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data?.length) return <EmptyPanel label="No component sets found." />;

  return (
    <>
      {!embedded ? (
        <PageHeader
          title="Component Sets"
          subtitle="Required component groups used by DeploySets."
          action={
            <Button className="px-4" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Component Set
            </Button>
          }
        />
      ) : null}

      {!embedded ? <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3">
          <div className="flex h-10 w-[310px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-sm">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>
          <Select variant="light" value={componentFilter} onChange={(event) => setComponentFilter(event.target.value)} className="w-[220px]">
            <option value="all">Component: All</option>
            {componentOptions.map((componentId) => (
              <option key={componentId} value={componentId}>
                {componentId}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="outline" onClick={() => query.refetch()}>
          Refresh
        </Button>
      </div> : null}

      {embedded ? (
        filteredComponentSets.length ? (
          <Table>
            <ComponentSetsTableContent rows={filteredComponentSets} />
          </Table>
        ) : (
          <EmptyPanel label="No component sets match the current filters." />
        )
      ) : (
        <Card className="mt-4">
          <CardContent className="p-3">
            {filteredComponentSets.length ? (
              <Table>
                <ComponentSetsTableContent rows={filteredComponentSets} />
              </Table>
            ) : (
              <EmptyPanel label="No component sets match the current filters." />
            )}
          </CardContent>
        </Card>
      )}
      <ComponentSetDrawer
        componentOptions={componentOptions}
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={(value) => mutation.mutate(value)}
        pending={mutation.isPending}
        onCreateComponent={onCreateComponent}
      />
    </>
  );
}

function ComponentSetsTableContent({ rows }: { rows: ApiComponentSet[] }) {
  return (
    <>
              <TableHeader>
                <TableRow>
                  <TableHead>Component Set</TableHead>
                  <TableHead>Components</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Tags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((componentSet) => (
                  <TableRow key={componentSet.componentSetId} className="hover:bg-slate-50">
                    <TableCell>
                      <EntityLink
                        kind="componentSet"
                        to="/component-sets/$componentSetId"
                        params={{ componentSetId: componentSet.componentSetId }}
                      >
                        {componentSet.componentSetId}
                      </EntityLink>
                    </TableCell>
                    <TableCell>{componentSet.components.length}</TableCell>
                    <TableCell>{formatRelativeTime(componentSet.createdAt, { mode: "short" })}</TableCell>
                    <TableCell>
                      <TagList tags={componentSet.tags} limit={3} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
    </>
  );
}

function ComponentSetDrawer({
  componentOptions,
  open,
  onClose,
  onSubmit,
  pending,
  onCreateComponent,
}: {
  componentOptions: string[];
  open: boolean;
  onClose: () => void;
  onSubmit: (componentSet: ApiComponentSet) => void;
  pending: boolean;
  onCreateComponent?: () => void;
}) {
  const [componentSetId, setComponentSetId] = useState("");
  const [description, setDescription] = useState("");
  const [componentRows, setComponentRows] = useState<ComponentMemberDraft[]>([componentMemberDraft()]);
  const [tags, setTags] = useState<TagDraft[]>([createTagDraft()]);
  const trimmedComponentSetId = componentSetId.trim();
  const components = componentRows.map((component) => component.componentId.trim()).filter(Boolean);
  const duplicateComponent = components.find((componentId, index) => components.indexOf(componentId) !== index);
  const componentsError = duplicateComponent ? `${duplicateComponent} is already in this component set.` : undefined;
  const tagsError = validateTagDrafts(tags);

  const updateTag = (id: string, patch: Partial<Omit<TagDraft, "id">>) => {
    setTags((current) => current.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag)));
  };

  const updateComponentRow = (id: string, componentId: string) => {
    setComponentRows((current) => {
      const rowIndex = current.findIndex((component) => component.id === id);

      if (!componentId) {
        return current.map((component) => (component.id === id ? { ...component, componentId: "" } : component));
      }

      const updated = current.map((component) => (component.id === id ? { ...component, componentId } : component));
      return updated.some((component) => !component.componentId) ? updated : [...updated, componentMemberDraft()];
    });
  };

  const submit = () => {
    if (!trimmedComponentSetId || !components.length || componentsError || tagsError) {
      return;
    }

    onSubmit({
      componentSetId: trimmedComponentSetId,
      description: description.trim() || null,
      components: components.map((componentId) => ({ componentId })),
      createdAt: new Date().toISOString(),
      createdBy: "amit.kumar",
      tags: tagsToRecord(tags),
    });
  };

  return (
    <SideDrawer
      open={open}
      title="Create component set"
      description="Group the components that must move together in a deploy set."
      onClose={onClose}
      footer={
        <>
          <p className="text-xs text-slate-500">Every listed component is required for this set.</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={pending || !trimmedComponentSetId || !components.length || Boolean(componentsError) || Boolean(tagsError)} onClick={submit}>
              {pending ? "Creating..." : "Create component set"}
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Set identity</h3>
          <p className="mt-1 text-sm text-slate-500">Name the bundle by purpose, product surface, or deploy boundary.</p>
          <div className="mt-4 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Component set ID
              <RequiredMark />
              <Input className="mt-1" value={componentSetId} onChange={(event) => setComponentSetId(event.target.value)} placeholder="checkout-stack" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Description
              <textarea
                className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Components that power the checkout experience."
              />
            </label>
          </div>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">
            Components
            <RequiredMark />
          </h3>
          <p className="mt-1 text-sm text-slate-500">Pick components one row at a time. Every selected component is a required member.</p>
          <div className="mt-4 space-y-3">
            {componentRows.map((row, index) => (
              <div key={row.id} className="grid grid-cols-[1fr_40px] items-center gap-2">
                <div className="min-w-0">
                  <Select
                    aria-label={`Component ${index + 1}`}
                    variant="light"
                    value={row.componentId}
                    onChange={(event) => updateComponentRow(row.id, event.target.value)}
                  >
                    {!row.componentId ? <option value="">Select component</option> : null}
                    {componentOptions.map((componentId) => (
                      <option
                        key={componentId}
                        value={componentId}
                        disabled={componentRows.some((component) => component.id !== row.id && component.componentId === componentId)}
                      >
                        {componentId}
                      </option>
                    ))}
                  </Select>
                  {onCreateComponent && index === componentRows.length - 1 ? (
                    <button type="button" className="mt-1 text-left text-xs font-bold text-blue-600" onClick={onCreateComponent}>
                      Create new component
                    </button>
                  ) : null}
                </div>
                <div className="flex justify-end">
                  {index < componentRows.length - 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove component ${index + 1}`}
                      onClick={() => setComponentRows((current) => current.filter((component) => component.id !== row.id))}
                    >
                      <Trash2 className="h-4 w-4 text-slate-500" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {componentsError ? <div className="mt-2 text-xs font-medium text-red-600">{componentsError}</div> : null}
        </section>
        <TagsCard
          tags={tags}
          error={tagsError}
          onAdd={() => setTags((current) => [...current, createTagDraft()])}
          onChange={updateTag}
          onRemove={(id) => setTags((current) => current.filter((tag) => tag.id !== id))}
        />
      </div>
    </SideDrawer>
  );
}

type ComponentMemberDraft = {
  id: string;
  componentId: string;
};

function componentMemberDraft(): ComponentMemberDraft {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    componentId: "",
  };
}
