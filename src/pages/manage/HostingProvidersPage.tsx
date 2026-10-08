import { useMemo, useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { Ban, MoreHorizontal, Pencil, Plus } from 'lucide-react';
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

import {
  hostingProvidersQueryKey,
  useHostingProviders,
} from '@/hooks/useHostingProviders';

import { emptyToNull } from '@/utils/form';

import type { HostingProviderRecord } from '@/types/cmdb';

type ProviderForm = {
  code: string;
  display_name: string;
  description: string;
};

const emptyForm = (): ProviderForm => ({
  code: '',
  display_name: '',
  description: '',
});

export function HostingProvidersPage() {
  const queryClient = useQueryClient();
  const [includeInactive, setIncludeInactive] = useState(false);
  const providersQuery = useHostingProviders(includeInactive);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProviderForm>(emptyForm);
  const [deactivateTarget, setDeactivateTarget] =
    useState<HostingProviderRecord | null>(null);

  const rows = useMemo(() => providersQuery.data ?? [], [providersQuery.data]);

  function openCreate(): void {
    setEditingId(null);
    setForm(emptyForm());
    setSheetOpen(true);
  }

  function openEdit(row: HostingProviderRecord): void {
    setEditingId(row.id);
    setForm({
      code: row.code,
      display_name: row.display_name,
      description: row.description ?? '',
    });
    setSheetOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.display_name.trim()) {
        throw new Error('Display name is required.');
      }
      if (editingId) {
        await cmdb.updateHostingProvider(editingId, {
          display_name: form.display_name.trim(),
          description: emptyToNull(form.description),
        });
        return;
      }
      if (!form.code.trim()) {
        throw new Error('Code is required.');
      }
      await cmdb.createHostingProvider({
        code: form.code.trim().toUpperCase(),
        display_name: form.display_name.trim(),
        description: emptyToNull(form.description),
      });
    },
    onSuccess: async () => {
      toast.success(
        editingId ? 'Hosting provider updated.' : 'Hosting provider created.',
      );
      setSheetOpen(false);
      await queryClient.invalidateQueries({
        queryKey: hostingProvidersQueryKey(includeInactive),
      });
      await queryClient.invalidateQueries({
        queryKey: ['hosting-providers'],
      });
    },
    onError: async (err) => toast.error(await parseApiError(err)),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => cmdb.deleteHostingProvider(id),
    onSuccess: async () => {
      toast.success('Hosting provider deactivated.');
      setDeactivateTarget(null);
      await queryClient.invalidateQueries({
        queryKey: ['hosting-providers'],
      });
    },
    onError: async (err) => toast.error(await parseApiError(err)),
  });

  const columns = useMemo<ColumnDef<HostingProviderRecord>[]>(
    () => [
      { accessorKey: 'id', header: 'ID' },
      { accessorKey: 'code', header: 'Code' },
      { accessorKey: 'display_name', header: 'Display name' },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => row.original.description ?? '—',
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
    [],
  );

  return (
    <div>
      <PageHeader
        title="Hosting providers"
        onRefresh={() => void providersQuery.refetch()}
        refreshing={providersQuery.isFetching}
      >
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
        loading={providersQuery.isLoading}
        emptyMessage="No hosting providers."
      />

      <EntitySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={editingId ? 'Edit hosting provider' : 'New hosting provider'}
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
            <Label htmlFor="hp_code">Code</Label>
            <Input
              id="hp_code"
              value={form.code}
              disabled={editingId != null}
              placeholder="AWS"
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  code: e.target.value.toUpperCase(),
                }))
              }
            />
            <p className="text-xs text-slate-500">
              Immutable after create. Use SCREAMING_SNAKE (e.g. ONPREM).
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hp_display_name">Display name</Label>
            <Input
              id="hp_display_name"
              value={form.display_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, display_name: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hp_description">Description</Label>
            <Input
              id="hp_description"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
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
        title="Deactivate hosting provider"
        message={
          deactivateTarget
            ? `Soft-deactivate “${deactivateTarget.code}”? Environments that still use this code must be reassigned first.`
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
