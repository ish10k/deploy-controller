import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, Plus, RefreshCw, Search, Send, Tag, Webhook } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { ApiErrorPanel, EmptyPanel, LoadingPanel, PageHeader } from "@/components/common/api-state";
import { JsonDetail } from "@/components/common/json-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EntityLink } from "@/components/ui/entity-link";
import { Input } from "@/components/ui/input";
import { RequiredMark } from "@/components/ui/required-mark";
import { ScrollFade } from "@/components/ui/scroll-fade";
import { SideDrawer } from "@/components/ui/side-drawer";
import { TagList } from "@/components/ui/tag-list";
import { TagsCard, createTagDraft, tagsToRecord, validateTagDrafts, type TagDraft } from "@/components/ui/tags-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import {
  createWebhook,
  getWebhook,
  getWebhookDelivery,
  listWebhookDeliveries,
  listWebhooks,
  putWebhook,
  queryKeys,
  retryWebhookDelivery,
  type ApiWebhook,
  type ApiWebhookDelivery,
  type ApiWebhookFilter,
  type ApiWebhookSubscription,
} from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { canManageWebhooks, canRetryWebhookDeliveries, canViewWebhookDeliveries, canViewWebhooks } from "@/lib/user-permissions";

const EVENT_GROUPS = [
  { label: "Components", events: ["component.created", "component.updated", "component_set.created", "component_set.updated"] },
  { label: "Releases", events: ["release.created", "release.published", "release_source.created", "release_source.updated", "release_source.token_rotated"] },
  { label: "Deployments", events: ["deployset.created", "deployment.created", "deployment.claimed", "deployment.status_changed", "deployment_item.status_changed"] },
  { label: "Runtime", events: ["environment.created", "environment.updated", "environment_state.updated", "deployment_runner.created", "deployment_runner.updated", "deployment_runner.heartbeat", "deployment_runner.token_rotated"] },
  { label: "Governance", events: ["principal.created", "principal.updated", "principal.roles_changed", "principal.login", "role.created", "role.updated", "webhook.created", "webhook.updated", "eventlog.created"] },
] as const;

export function WebhooksPage() {
  const auth = useAuth();
  const canView = canViewWebhooks(auth.user);
  const canManage = canManageWebhooks(auth.user);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: queryKeys.webhooks, queryFn: listWebhooks, enabled: canView });
  const deliveriesQuery = useQuery({ queryKey: queryKeys.webhookDeliveries(), queryFn: () => listWebhookDeliveries(), enabled: canViewWebhookDeliveries(auth.user) });
  const mutation = useMutation({
    mutationFn: createWebhook,
    onSuccess: async () => {
      setOpen(false);
      toast({ title: "Webhook created", variant: "success" });
      await queryClient.invalidateQueries({ queryKey: queryKeys.webhooks });
    },
  });

  if (!canView) return <EmptyPanel label="You do not have permission to view webhooks." />;
  if (query.isLoading) return <LoadingPanel label="Loading webhooks..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;

  const webhooks = query.data ?? [];
  const deliveries = deliveriesQuery.data ?? [];
  const normalized = search.trim().toLowerCase();
  const filtered = webhooks.filter((webhook) =>
    [webhook.webhookId, webhook.displayName, webhook.url, ...webhook.subscriptions.flatMap((subscription) => subscription.eventTypes), ...Object.entries(webhook.tags).flat()]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );

  return (
    <>
      <PageHeader
        title="Webhooks"
        subtitle="Subscriber destinations for core entity and audit events."
        action={
          canManage ? (
            <Button className="h-10 px-4" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              Webhook
            </Button>
          ) : null
        }
      />
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex h-10 w-[340px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 shadow-sm">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search webhooks..." className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
        </div>
        <Button variant="outline" onClick={() => query.refetch()}>
          Refresh
        </Button>
      </div>
      <Card className="mt-4">
        <CardContent className="p-3">
          {filtered.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Webhook</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Subscriptions</TableHead>
                  <TableHead>Delivery Health</TableHead>
                  <TableHead>Tags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((webhook) => {
                  const related = deliveries.filter((delivery) => delivery.webhookId === webhook.webhookId);
                  return (
                    <TableRow key={webhook.webhookId} className="hover:bg-slate-50">
                      <TableCell>
                        <EntityLink kind="webhook" to="/webhooks/$webhookId" params={{ webhookId: webhook.webhookId }}>
                          {webhook.displayName || webhook.webhookId}
                        </EntityLink>
                      </TableCell>
                      <TableCell className="max-w-[360px] truncate font-mono text-xs">{webhook.url}</TableCell>
                      <TableCell>
                        <Badge variant={webhook.active ? "green" : "slate"}>{webhook.active ? "Active" : "Inactive"}</Badge>
                      </TableCell>
                      <TableCell>{webhook.subscriptions.length}</TableCell>
                      <TableCell>{deliveryHealth(related)}</TableCell>
                      <TableCell>
                        <TagList tags={webhook.tags} limit={3} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <EmptyPanel label={webhooks.length ? "No webhooks match the current search." : "No webhooks found."} />
          )}
        </CardContent>
      </Card>
      <WebhookDrawer open={open} pending={mutation.isPending} onClose={() => setOpen(false)} onSubmit={(webhook) => mutation.mutate(webhook)} />
    </>
  );
}

export function WebhookDetailsPage({ webhookId }: { webhookId: string }) {
  const auth = useAuth();
  const canView = canViewWebhooks(auth.user);
  const query = useQuery({
    queryKey: queryKeys.webhook(webhookId),
    queryFn: async () => {
      const [webhook, deliveries] = await Promise.all([getWebhook(webhookId), listWebhookDeliveries({ webhookId })]);
      return { webhook, deliveries };
    },
    enabled: canView,
    retry: 1,
  });

  if (!canView) return <EmptyPanel label="You do not have permission to view this webhook." />;
  if (query.isLoading) return <LoadingPanel label="Loading webhook..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data?.webhook) return <EmptyPanel label={`Webhook ${webhookId} was not found.`} />;

  return <WebhookDetailsView webhook={query.data.webhook} deliveries={query.data.deliveries} />;
}

function WebhookDetailsView({ webhook, deliveries }: { webhook: ApiWebhook; deliveries: ApiWebhookDelivery[] }) {
  const auth = useAuth();
  const canManage = canManageWebhooks(auth.user);
  const queryClient = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: (next: ApiWebhook) => putWebhook(next.webhookId, next),
    onSuccess: async () => {
      toast({ title: "Webhook saved", variant: "success" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.webhook(webhook.webhookId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.webhooks }),
      ]);
    },
  });

  return (
    <div className="flex h-[calc(100vh-108px)] min-h-0 flex-col overflow-hidden">
      <PageHeader
        title={webhook.displayName || webhook.webhookId}
        subtitle="Destination, subscription rules, retry policy, and delivery history."
        action={
          <Link to="/webhooks">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Back to webhooks
            </Button>
          </Link>
        }
      />
      <div className="grid shrink-0 grid-cols-4 gap-4">
        <FactCard icon={Webhook} label="Status" value={webhook.active ? "Active" : "Inactive"} sublabel="Subscriber state" />
        <FactCard icon={Send} label="Subscriptions" value={String(webhook.subscriptions.length)} sublabel="Rules for one URL" />
        <FactCard icon={RefreshCw} label="Retry Policy" value={`${webhook.retryPolicy.maxAttempts} attempts`} sublabel={`${webhook.retryPolicy.backoffSeconds}s backoff`} />
        <FactCard icon={CalendarClock} label="Deliveries" value={String(deliveries.length)} sublabel={deliveryHealth(deliveries)} />
      </div>
      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_440px] gap-4">
        <Card className="flex min-h-0 flex-col overflow-hidden">
          <CardHeader>
            <CardTitle>Recent deliveries</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            {deliveries.length ? (
              <ScrollFade className="h-full" contentClassName="px-4 pb-4">
                <DeliveryTable deliveries={deliveries} />
              </ScrollFade>
            ) : (
              <div className="p-4">
                <EmptyPanel label="No deliveries have been recorded for this webhook." />
              </div>
            )}
          </CardContent>
        </Card>
        <WebhookEditor webhook={webhook} canManage={canManage} pending={mutation.isPending} onSubmit={(next) => mutation.mutate(next)} />
      </div>
    </div>
  );
}

export function WebhookDeliveryDetailsPage({ deliveryId }: { deliveryId: string }) {
  const auth = useAuth();
  const canView = canViewWebhookDeliveries(auth.user);
  const canRetry = canRetryWebhookDeliveries(auth.user);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: queryKeys.webhookDelivery(deliveryId), queryFn: () => getWebhookDelivery(deliveryId), enabled: canView, retry: 1 });
  const retryMutation = useMutation({
    mutationFn: retryWebhookDelivery,
    onSuccess: async (delivery) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.webhookDelivery(delivery.webhookDeliveryId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.webhookDeliveries() }),
      ]);
    },
  });

  if (!canView) return <EmptyPanel label="You do not have permission to view webhook deliveries." />;
  if (query.isLoading) return <LoadingPanel label="Loading webhook delivery..." />;
  if (query.error) return <ApiErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return <EmptyPanel label={`Webhook delivery ${deliveryId} was not found.`} />;

  const delivery = query.data;
  return (
    <>
      <PageHeader
        title={delivery.webhookDeliveryId}
        subtitle="Webhook envelope, attempt state, and response metadata."
        action={
          <div className="flex gap-2">
            {canRetry ? (
              <Button variant="outline" disabled={retryMutation.isPending} onClick={() => retryMutation.mutate(delivery.webhookDeliveryId)}>
                <RefreshCw className="h-4 w-4" />
                {retryMutation.isPending ? "Retrying..." : "Retry"}
              </Button>
            ) : null}
            <Link to="/webhooks/$webhookId" params={{ webhookId: delivery.webhookId }}>
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" />
                Webhook
              </Button>
            </Link>
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Delivery metadata</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <MetaRow label="Status" value={<DeliveryStatusBadge status={delivery.status} />} />
            <MetaRow label="Event type" value={delivery.eventType} />
            <MetaRow label="Attempts" value={delivery.attempts} />
            <MetaRow label="Response" value={delivery.lastResponseStatus ?? "None"} />
            <MetaRow label="Next attempt" value={formatDateTime(delivery.nextAttemptAt)} />
            <MetaRow label="Error" value={delivery.lastError ?? "None"} />
          </CardContent>
        </Card>
        <JsonDetail title="Webhook envelope" value={delivery.envelope} />
      </div>
    </>
  );
}

function WebhookDrawer({ open, pending, onClose, onSubmit }: { open: boolean; pending: boolean; onClose: () => void; onSubmit: (webhook: ApiWebhook) => void }) {
  const [webhookId, setWebhookId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [url, setUrl] = useState("");
  const [secretRef, setSecretRef] = useState("");
  const [active, setActive] = useState(true);
  const [subscriptions, setSubscriptions] = useState<ApiWebhookSubscription[]>([blankSubscription()]);
  const [tags, setTags] = useState<TagDraft[]>([createTagDraft()]);
  const tagsError = validateTagDrafts(tags);
  const trimmedWebhookId = webhookId.trim();
  const trimmedDisplayName = displayName.trim();
  const trimmedUrl = url.trim();
  const updateTag = (id: string, patch: Partial<Omit<TagDraft, "id">>) => setTags((current) => current.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag)));

  const submit = () => {
    if (!trimmedWebhookId || !trimmedDisplayName || !trimmedUrl || tagsError) return;
    onSubmit({
      webhookId: trimmedWebhookId,
      displayName: trimmedDisplayName,
      url: trimmedUrl,
      active,
      secretRef: secretRef.trim() || null,
      retryPolicy: { maxAttempts: 3, backoffSeconds: 60 },
      subscriptions,
      tags: tagsToRecord(tags),
      createdAt: new Date().toISOString(),
      createdBy: "ui",
      updatedAt: null,
    });
  };

  return (
    <SideDrawer open={open} title="Create webhook" description="Register one subscriber URL with one or more subscription rules." maxWidth="max-w-[900px]" onClose={onClose} footer={<DrawerFooter pending={pending} disabled={!trimmedWebhookId || !trimmedDisplayName || !trimmedUrl || Boolean(tagsError)} submitLabel="Create webhook" onClose={onClose} onSubmit={submit} />}>
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Webhook ID
              <RequiredMark />
              <Input className="mt-1" value={webhookId} onChange={(event) => setWebhookId(event.target.value)} placeholder="platform-events" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Display name
              <RequiredMark />
              <Input className="mt-1" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Platform events" />
            </label>
            <label className="block text-sm font-medium text-slate-700 md:col-span-2">
              URL
              <RequiredMark />
              <Input className="mt-1" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/webhooks/settle" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Secret ref
              <Input className="mt-1" value={secretRef} onChange={(event) => setSecretRef(event.target.value)} placeholder="future-secret-ref" />
            </label>
            <label className="flex items-start gap-3 text-sm text-slate-600">
              <input className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600" type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
              <span><span className="block font-medium text-slate-800">Active webhook</span><span>Active webhooks receive matching events.</span></span>
            </label>
          </div>
        </section>
        <SubscriptionsEditor subscriptions={subscriptions} disabled={false} onChange={setSubscriptions} />
        <TagsCard tags={tags} error={tagsError} onAdd={() => setTags((current) => [...current, createTagDraft()])} onChange={updateTag} onRemove={(id) => setTags((current) => current.filter((tag) => tag.id !== id))} />
      </div>
    </SideDrawer>
  );
}

function WebhookEditor({ webhook, canManage, pending, onSubmit }: { webhook: ApiWebhook; canManage: boolean; pending: boolean; onSubmit: (webhook: ApiWebhook) => void }) {
  const [displayName, setDisplayName] = useState(webhook.displayName);
  const [url, setUrl] = useState(webhook.url);
  const [secretRef, setSecretRef] = useState(webhook.secretRef ?? "");
  const [active, setActive] = useState(webhook.active);
  const [maxAttempts, setMaxAttempts] = useState(webhook.retryPolicy.maxAttempts);
  const [backoffSeconds, setBackoffSeconds] = useState(webhook.retryPolicy.backoffSeconds);
  const [subscriptions, setSubscriptions] = useState<ApiWebhookSubscription[]>(webhook.subscriptions.length ? webhook.subscriptions : [blankSubscription()]);
  const [tags, setTags] = useState<TagDraft[]>(recordToDrafts(webhook.tags));
  const tagsError = validateTagDrafts(tags);

  useEffect(() => {
    setDisplayName(webhook.displayName);
    setUrl(webhook.url);
    setSecretRef(webhook.secretRef ?? "");
    setActive(webhook.active);
    setMaxAttempts(webhook.retryPolicy.maxAttempts);
    setBackoffSeconds(webhook.retryPolicy.backoffSeconds);
    setSubscriptions(webhook.subscriptions.length ? webhook.subscriptions : [blankSubscription()]);
    setTags(recordToDrafts(webhook.tags));
  }, [webhook]);

  const parsedTags = tagsToRecord(tags);
  const changed = JSON.stringify({ displayName, url, secretRef, active, maxAttempts, backoffSeconds, subscriptions, tags: parsedTags }) !== JSON.stringify({
    displayName: webhook.displayName,
    url: webhook.url,
    secretRef: webhook.secretRef ?? "",
    active: webhook.active,
    maxAttempts: webhook.retryPolicy.maxAttempts,
    backoffSeconds: webhook.retryPolicy.backoffSeconds,
    subscriptions: webhook.subscriptions.length ? webhook.subscriptions : [blankSubscription()],
    tags: webhook.tags,
  });
  const updateTag = (id: string, patch: Partial<Omit<TagDraft, "id">>) => setTags((current) => current.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag)));
  const submit = () => onSubmit({ ...webhook, displayName: displayName.trim(), url: url.trim(), secretRef: secretRef.trim() || null, active, retryPolicy: { maxAttempts, backoffSeconds }, subscriptions, tags: parsedTags });

  return (
    <Card className="flex min-h-0 flex-col overflow-hidden">
      <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
        <label className="block text-sm font-medium text-slate-700">Display name<Input disabled={!canManage} className="mt-1" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
        <label className="block text-sm font-medium text-slate-700">URL<Input disabled={!canManage} className="mt-1" value={url} onChange={(event) => setUrl(event.target.value)} /></label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">Max attempts<Input disabled={!canManage} className="mt-1" type="number" min={1} max={20} value={maxAttempts} onChange={(event) => setMaxAttempts(Number(event.target.value))} /></label>
          <label className="block text-sm font-medium text-slate-700">Backoff seconds<Input disabled={!canManage} className="mt-1" type="number" min={0} value={backoffSeconds} onChange={(event) => setBackoffSeconds(Number(event.target.value))} /></label>
        </div>
        <label className="block text-sm font-medium text-slate-700">Secret ref<Input disabled={!canManage} className="mt-1" value={secretRef} onChange={(event) => setSecretRef(event.target.value)} /></label>
        <label className="flex items-start gap-3 text-sm text-slate-600"><input disabled={!canManage} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600" type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /><span><span className="block font-medium text-slate-800">Active webhook</span><span>Inactive webhooks do not receive events.</span></span></label>
        <SubscriptionsEditor subscriptions={subscriptions} disabled={!canManage} onChange={setSubscriptions} />
        <TagsCard disabled={!canManage} tags={tags} error={tagsError} onAdd={() => setTags((current) => [...current, createTagDraft()])} onChange={updateTag} onRemove={(id) => setTags((current) => current.filter((tag) => tag.id !== id))} />
        <div className="mt-auto flex justify-end border-t border-slate-200 pt-4">
          <Button disabled={!canManage || !changed || pending || !displayName.trim() || !url.trim() || Boolean(tagsError)} onClick={submit}>{pending ? "Saving..." : "Save webhook"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SubscriptionsEditor({ subscriptions, disabled, onChange }: { subscriptions: ApiWebhookSubscription[]; disabled: boolean; onChange: (subscriptions: ApiWebhookSubscription[]) => void }) {
  const update = (index: number, value: ApiWebhookSubscription) => onChange(subscriptions.map((subscription, current) => (current === index ? value : subscription)));
  const remove = (index: number) => onChange(subscriptions.filter((_, current) => current !== index));
  return (
    <Card>
      <CardHeader><CardTitle>Subscriptions</CardTitle></CardHeader>
      <CardContent className="grid gap-4">
        {subscriptions.map((subscription, index) => (
          <SubscriptionEditor key={subscription.subscriptionId} subscription={subscription} disabled={disabled} onChange={(next) => update(index, next)} onRemove={subscriptions.length > 1 ? () => remove(index) : undefined} />
        ))}
        <Button type="button" variant="outline" disabled={disabled} onClick={() => onChange([...subscriptions, blankSubscription()])}><Plus className="h-4 w-4" />Subscription</Button>
      </CardContent>
    </Card>
  );
}

function SubscriptionEditor({ subscription, disabled, onChange, onRemove }: { subscription: ApiWebhookSubscription; disabled: boolean; onChange: (subscription: ApiWebhookSubscription) => void; onRemove?: () => void }) {
  const updateFilters = (patch: Partial<ApiWebhookFilter>) => onChange({ ...subscription, filters: { ...subscription.filters, ...patch } });
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm font-bold text-slate-950">{subscription.subscriptionId}</div>
        {onRemove ? <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={onRemove}>Remove</Button> : null}
      </div>
      <div className="grid gap-3">
        <div className="grid gap-2">
          {EVENT_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="mb-1 text-xs font-bold uppercase text-slate-500">{group.label}</div>
              <div className="flex flex-wrap gap-1.5">
                {group.events.map((eventType) => (
                  <label key={eventType} className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                    <input disabled={disabled} type="checkbox" checked={subscription.eventTypes.includes(eventType)} onChange={() => onChange({ ...subscription, eventTypes: toggle(subscription.eventTypes, eventType) })} />
                    {eventType}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <FilterInput label="Resource types" value={subscription.filters.resourceTypes} disabled={disabled} onChange={(value) => updateFilters({ resourceTypes: value })} />
        <FilterInput label="Resource ids" value={subscription.filters.resourceIds} disabled={disabled} onChange={(value) => updateFilters({ resourceIds: value })} />
        <FilterInput label="Categories" value={subscription.filters.categories} disabled={disabled} onChange={(value) => updateFilters({ categories: value })} />
      </div>
    </section>
  );
}

function DeliveryTable({ deliveries }: { deliveries: ApiWebhookDelivery[] }) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Delivery</TableHead><TableHead>Event</TableHead><TableHead>Status</TableHead><TableHead>Attempts</TableHead><TableHead>Updated</TableHead></TableRow></TableHeader>
      <TableBody>
        {deliveries.map((delivery) => (
          <TableRow key={delivery.webhookDeliveryId}>
            <TableCell><Link to="/webhook-deliveries/$deliveryId" params={{ deliveryId: delivery.webhookDeliveryId }} className="font-semibold text-blue-700 hover:text-blue-900">{delivery.webhookDeliveryId}</Link></TableCell>
            <TableCell>{delivery.eventType}</TableCell>
            <TableCell><DeliveryStatusBadge status={delivery.status} /></TableCell>
            <TableCell>{delivery.attempts}</TableCell>
            <TableCell>{formatDateTime(delivery.updatedAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DeliveryStatusBadge({ status }: { status: string }) {
  const variant = status === "succeeded" ? "green" : status === "failed" ? "red" : "orange";
  return <Badge variant={variant}>{status}</Badge>;
}

function FilterInput({ label, value, disabled, onChange }: { label: string; value: string[]; disabled: boolean; onChange: (value: string[]) => void }) {
  return <label className="block text-sm font-medium text-slate-700">{label}<Input disabled={disabled} className="mt-1" value={value.join(", ")} onChange={(event) => onChange(splitList(event.target.value))} /></label>;
}

function FactCard({ icon: Icon, label, value, sublabel }: { icon: typeof Webhook; label: string; value: ReactNode; sublabel: ReactNode }) {
  return <Card className="h-[116px]"><CardContent className="flex h-full items-center gap-4 p-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Icon className="h-6 w-6" /></div><div className="min-w-0"><div className="text-sm font-bold text-slate-950">{label}</div><div className="mt-1 truncate text-lg font-bold text-blue-700">{value}</div><div className="mt-1 truncate text-sm text-slate-600">{sublabel}</div></div></CardContent></Card>;
}

function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return <div className="grid grid-cols-[120px_1fr] items-center gap-3"><span className="font-semibold text-slate-700">{label}</span><span className="min-w-0 truncate text-slate-800">{value}</span></div>;
}

function DrawerFooter({ pending, disabled, submitLabel, onClose, onSubmit }: { pending: boolean; disabled: boolean; submitLabel: string; onClose: () => void; onSubmit: () => void }) {
  return <><p className="text-xs text-slate-500">Webhook requests are unsigned in v1. Secret refs are stored for future signing support.</p><div className="flex gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={pending || disabled} onClick={onSubmit}>{pending ? "Saving..." : submitLabel}</Button></div></>;
}

function blankSubscription(): ApiWebhookSubscription {
  return { subscriptionId: `sub-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`, eventTypes: ["eventlog.created"], filters: { resourceTypes: [], resourceIds: [], categories: [], origins: [], severities: [] } };
}

function recordToDrafts(record: Record<string, string>) {
  const drafts = Object.entries(record).map(([key, value]) => createTagDraft(key, value));
  return drafts.length ? [...drafts, createTagDraft()] : [createTagDraft()];
}

function splitList(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value].sort();
}

function deliveryHealth(deliveries: ApiWebhookDelivery[]) {
  if (!deliveries.length) return "No deliveries";
  const failed = deliveries.filter((delivery) => delivery.status === "failed").length;
  if (failed) return `${failed} failed / ${deliveries.length} total`;
  return `${deliveries.length} delivered`;
}
