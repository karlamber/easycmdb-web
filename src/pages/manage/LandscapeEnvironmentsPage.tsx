import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { Ban, ExternalLink, MoreHorizontal, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';

import * as cmdb from '@/api/cmdb';
import { parseApiError } from '@/api/http';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable } from '@/components/DataTable';
import { EntitySheet } from '@/components/EntitySheet';
import { PageHeader } from '@/components/PageHeader';
import { ActiveBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { useHostingProviders } from '@/hooks/useHostingProviders';
import {
  landscapeEnvironmentsQueryKey,
  useLandscapeEnvironments,
} from '@/hooks/useLandscapeEnvironments';
import { useLandscapes } from '@/hooks/useLandscapes';

import { emptyToNull } from '@/utils/form';

import type { LandscapeEnvironment } from '@/types/cmdb';

type EnvForm = {
  landscape_id: string | null;
  environment_name: string;
  hosting_provider: string;
  provider_account_name: string;
  provider_account_number: string;
  direct_link: string;
};

const emptyForm = (landscapeId: string | null = null): EnvForm => ({
  landscape_id: landscapeId,
  environment_name: '',
  hosting_provider: '',
  provider_account_name: '',
  provider_account_number: '',
  direct_link: '',
});

export function LandscapeEnvironmentsPage() {
  const queryClient = useQueryClient();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [filterLandscapeId, setFilterLandscapeId] = useState<string | null>(
    null,
  );

  const landscapesQuery = useLandscapes(true);
  const providersQuery = useHostingProviders(false);
  const envsQuery = useLandscapeEnvironments(
    includeInactive,
    filterLandscapeId ?? undefined,
  );

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EnvForm>(emptyForm());
  const [deactivateTarget, setDeactivateTarget] =
    useState<LandscapeEnvironment | null>(null);

  const landscapes = useMemo(
    () => landscapesQuery.data ?? [],
    [landscapesQuery.data],
  );
  const hostingProviders = useMemo(
    () => providersQuery.data ?? [],
    [providersQuery.data],
  );
  const rows = useMemo(() => envsQuery.data ?? [], [envsQuery.data]);

  const landscapeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of landscapes) map.set(l.id, l.name);
    return map;
  }, [landscapes]);

  const landscapeLabel = useMemo(
    () =>
      (row: LandscapeEnvironment): string =>
        landscapeNameById.get(row.landscape_id) ?? `#${row.landscape_id}`,
    [landscapeNameById],
  );

  function openCreate(): void {
    setEditingId(null);
    const defaultProvider = hostingProviders[0]?.code ?? '';
    setForm({
      ...emptyForm(filterLandscapeId),
      hosting_provider: defaultProvider,
    });
    setSheetOpen(true);
  }

  function openEdit(row: LandscapeEnvironment): void {
    setEditingId(row.id);
    setForm({
      landscape_id: row.landscape_id,
      environment_name: row.environment_name,
      hosting_provider: row.hosting_provider,
      provider_account_name: row.provider_account_name ?? '',
      provider_account_number: row.provider_account_number ?? '',
      direct_link: row.direct_link ?? '',
    });
    setSheetOpen(true);
  }

  function toPayload(): Record<string, unknown> {
    return {
      landscape_id: form.landscape_id,
      environment_name: form.environment_name.trim(),
      hosting_provider: form.hosting_provider,
      provider_account_name: emptyToNull(form.provider_account_name),
      provider_account_number: emptyToNull(form.provider_account_number),
      direct_link: emptyToNull(form.direct_link),
    };
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.landscape_id) throw new Error('Landscape is required.');
      if (!form.environment_name.trim()) {
        throw new Error('Environment name is required.');
      }
      if (editingId) {
        await cmdb.updateLandscapeEnvironment(editingId, toPayload());
      } else {
        await cmdb.createLandscapeEnvironment(
          toPayload() as Parameters<typeof cmdb.createLandscapeEnvironment>[0],
        );
      }
    },
    onSuccess: async () => {
      toast.success(
        editingId ? 'Environment updated.' : 'Environment created.',
      );
      setSheetOpen(false);
      await queryClient.invalidateQueries({
        queryKey: landscapeEnvironmentsQueryKey(
          includeInactive,
          filterLandscapeId ?? undefined,
        ),
      });
    },
    onError: async (err) => toast.error(await parseApiError(err)),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => cmdb.deleteLandscapeEnvironment(id),
    onSuccess: async () => {
      toast.success('Environment deactivated.');
      setDeactivateTarget(null);
      await queryClient.invalidateQueries({
        queryKey: landscapeEnvironmentsQueryKey(
          includeInactive,
          filterLandscapeId ?? undefined,
        ),
      });
    },
    onError: async (err) => toast.error(await parseApiError(err)),
  });

  const columns = useMemo<ColumnDef<LandscapeEnvironment>[]>(
    () => [
      { accessorKey: 'id', header: 'ID' },
      {
        id: 'landscape',
        header: 'Landscape',
        accessorFn: landscapeLabel,
        cell: ({ row }) => landscapeLabel(row.original),
      },
      { accessorKey: 'environment_name', header: 'Environment' },
      { accessorKey: 'hosting_provider', header: 'Provider' },
      {
        accessorKey: 'provider_account_name',
        header: 'Account name',
        cell: ({ row }) => {
          const name = row.original.provider_account_name;
          if (!name) return <span className="text-slate-400">—</span>;
          return (
            <Link
              to={`/provider-accounts/${encodeURIComponent(name)}`}
              className="text-teal-700 hover:underline"
            >
              {name}
            </Link>
          );
        },
      },
      {
        accessorKey: 'provider_account_number',
        header: 'Account #',
        cell: ({ row }) => row.original.provider_account_number ?? '—',
      },
      {
        accessorKey: 'direct_link',
        header: 'Direct link',
        cell: ({ row }) => {
          const url = row.original.direct_link;
          if (!url) return <span className="text-slate-400">—</span>;
          return (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-teal-700 hover:underline"
            >
              Open
              <ExternalLink className="size-3.5" />
            </a>
          );
        },
      },
      {
        accessorKey: 'is_active',
        header: 'Active',
        cell: ({ row }) => <ActiveBadge active={row.original.is_active} />,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(row.original)}>
                <Pencil className="mr-2 size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!row.original.is_active}
                className="text-red-600 focus:text-red-600"
                onClick={() => setDeactivateTarget(row.original)}
              >
                <Ban className="mr-2 size-4" />
                Deactivate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [landscapeLabel],
  );

  return (
    <div>
      <PageHeader
        title="Landscape environments"
        onRefresh={() => void envsQuery.refetch()}
        refreshing={envsQuery.isFetching}
      >
        <div className="min-w-[220px] space-y-1">
          <Label htmlFor="filter-landscape" className="text-xs text-slate-500">
            Filter landscape
          </Label>
          <select
            id="filter-landscape"
            value={filterLandscapeId ?? ''}
            onChange={(e) =>
              setFilterLandscapeId(
                e.target.value === '' ? null : e.target.value,
              )
            }
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All landscapes</option>
            {landscapes.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} (#{l.id})
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <Checkbox
            checked={includeInactive}
            onCheckedChange={(v) => setIncludeInactive(v === true)}
          />
          Show inactive
        </label>
        <Button
          type="button"
          onClick={openCreate}
          className="bg-teal-700 hover:bg-teal-800"
        >
          <Plus className="mr-1.5 size-4" />
          New
        </Button>
      </PageHeader>

      <DataTable
        columns={columns}
        data={rows}
        loading={envsQuery.isLoading}
        getRowId={(row) => row.id}
      />

      <EntitySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={
          editingId ? 'Edit landscape environment' : 'New landscape environment'
        }
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSheetOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-teal-700 hover:bg-teal-800"
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 px-1">
          <div className="space-y-1.5">
            <Label htmlFor="landscape_id">Landscape</Label>
            <select
              id="landscape_id"
              value={form.landscape_id ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  landscape_id: e.target.value || null,
                }))
              }
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
            >
              <option value="">Select landscape</option>
              {landscapes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} (#{l.id})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="environment_name">Environment name</Label>
            <Input
              id="environment_name"
              value={form.environment_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, environment_name: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hosting_provider">Hosting provider</Label>
            <select
              id="hosting_provider"
              value={form.hosting_provider}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  hosting_provider: e.target.value,
                }))
              }
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
            >
              <option value="" disabled>
                Select provider
              </option>
              {hostingProviders.map((p) => (
                <option key={p.id} value={p.code}>
                  {p.display_name} ({p.code})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="provider_account_name">Provider account name</Label>
            <Input
              id="provider_account_name"
              value={form.provider_account_name}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  provider_account_name: e.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="provider_account_number">
              Provider account number
            </Label>
            <Input
              id="provider_account_number"
              value={form.provider_account_number}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  provider_account_number: e.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="direct_link">Direct link</Label>
            <Input
              id="direct_link"
              value={form.direct_link}
              onChange={(e) =>
                setForm((f) => ({ ...f, direct_link: e.target.value }))
              }
            />
          </div>
        </div>
      </EntitySheet>

      <ConfirmDialog
        open={deactivateTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null);
        }}
        title="Deactivate environment"
        message={
          deactivateTarget
            ? `Soft-deactivate “${deactivateTarget.environment_name}”?`
            : ''
        }
        confirmLabel="Deactivate"
        onConfirm={async () => {
          if (deactivateTarget) {
            await deactivateMutation.mutateAsync(deactivateTarget.id);
          }
        }}
      />
    </div>
  );
}
