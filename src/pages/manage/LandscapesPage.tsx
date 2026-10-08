import { useMemo, useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Ban,
  CircleHelp,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

import * as cmdb from '@/api/cmdb';
import { parseApiError } from '@/api/http';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable } from '@/components/DataTable';
import { EntitySheet } from '@/components/EntitySheet';
import { PageHeader } from '@/components/PageHeader';
import { ActiveBadge, DataClassBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { landscapesQueryKey, useLandscapes } from '@/hooks/useLandscapes';

import { dataClassGuidance, dataClassShortGuidance } from '@/utils/data-class';
import { emptyToNull } from '@/utils/form';

import type { DataClass, Landscape } from '@/types/cmdb';

const DATA_CLASS_OPTIONS: { label: string; value: DataClass | '' }[] = [
  { label: '—', value: '' },
  { label: 'PUBLIC', value: 'PUBLIC' },
  { label: 'INTERNAL', value: 'INTERNAL' },
  { label: 'CONFIDENTIAL', value: 'CONFIDENTIAL' },
  { label: 'RESTRICTED', value: 'RESTRICTED' },
];

type LandscapeForm = {
  name: string;
  description: string;
  organization: string;
  devops_contact: string;
  data_class: DataClass | null;
  runbook_url: string;
  iac_repository: string;
};

const emptyForm = (): LandscapeForm => ({
  name: '',
  description: '',
  organization: '',
  devops_contact: '',
  data_class: null,
  runbook_url: '',
  iac_repository: '',
});

export function LandscapesPage() {
  const queryClient = useQueryClient();
  const [includeInactive, setIncludeInactive] = useState(false);
  const landscapesQuery = useLandscapes(includeInactive);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<LandscapeForm>(emptyForm);
  const [deactivateTarget, setDeactivateTarget] = useState<Landscape | null>(
    null,
  );

  const rows = landscapesQuery.data ?? [];

  function openCreate(): void {
    setEditingId(null);
    setForm(emptyForm());
    setSheetOpen(true);
  }

  function openEdit(row: Landscape): void {
    setEditingId(row.id);
    setForm({
      name: row.name,
      description: row.description ?? '',
      organization: row.organization ?? '',
      devops_contact: row.devops_contact ?? '',
      data_class: row.data_class,
      runbook_url: row.runbook_url ?? '',
      iac_repository: row.iac_repository ?? '',
    });
    setSheetOpen(true);
  }

  function toPayload(): Record<string, unknown> {
    return {
      name: form.name.trim(),
      description: emptyToNull(form.description),
      organization: emptyToNull(form.organization),
      devops_contact: emptyToNull(form.devops_contact),
      data_class: form.data_class,
      runbook_url: emptyToNull(form.runbook_url),
      iac_repository: emptyToNull(form.iac_repository),
    };
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Name is required.');
      if (editingId) {
        await cmdb.updateLandscape(editingId, toPayload());
      } else {
        await cmdb.createLandscape(
          toPayload() as Parameters<typeof cmdb.createLandscape>[0],
        );
      }
    },
    onSuccess: async () => {
      toast.success(editingId ? 'Landscape updated.' : 'Landscape created.');
      setSheetOpen(false);
      await queryClient.invalidateQueries({
        queryKey: landscapesQueryKey(includeInactive),
      });
    },
    onError: async (err) => toast.error(await parseApiError(err)),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => cmdb.deleteLandscape(id),
    onSuccess: async () => {
      toast.success('Landscape deactivated.');
      setDeactivateTarget(null);
      await queryClient.invalidateQueries({
        queryKey: landscapesQueryKey(includeInactive),
      });
    },
    onError: async (err) => toast.error(await parseApiError(err)),
  });

  const columns = useMemo<ColumnDef<Landscape>[]>(
    () => [
      { accessorKey: 'id', header: 'ID' },
      { accessorKey: 'name', header: 'Name' },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => {
          const desc = row.original.description;
          if (!desc) return <span className="text-slate-400">—</span>;
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="line-clamp-2 max-w-xs">{desc}</span>
                </TooltipTrigger>
                <TooltipContent className="max-w-md">{desc}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        accessorKey: 'organization',
        header: 'Organization',
        cell: ({ row }) => row.original.organization ?? '—',
      },
      {
        accessorKey: 'data_class',
        header: 'Data class',
        cell: ({ row }) => <DataClassBadge value={row.original.data_class} />,
      },
      {
        accessorKey: 'iac_repository',
        header: 'IaC repository',
        cell: ({ row }) => {
          const url = row.original.iac_repository;
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
    [],
  );

  return (
    <div>
      <PageHeader
        title="Landscapes"
        onRefresh={() => void landscapesQuery.refetch()}
        refreshing={landscapesQuery.isFetching}
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
        loading={landscapesQuery.isLoading}
        getRowId={(row) => row.id}
      />

      <EntitySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={editingId ? 'Edit landscape' : 'New landscape'}
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
            <Label htmlFor="name">Landscape name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="organization">Organization</Label>
            <Input
              id="organization"
              value={form.organization}
              onChange={(e) =>
                setForm((f) => ({ ...f, organization: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="devops_contact">DevOps contact</Label>
            <Input
              id="devops_contact"
              value={form.devops_contact}
              onChange={(e) =>
                setForm((f) => ({ ...f, devops_contact: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="data_class">Data class</Label>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                  >
                    <CircleHelp className="size-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Choosing a data class</DialogTitle>
                    <DialogDescription>
                      {dataClassShortGuidance}
                    </DialogDescription>
                  </DialogHeader>
                  <table className="w-full text-sm">
                    <tbody>
                      {dataClassGuidance.map((g) => (
                        <tr key={g.dc} className="border-b align-top">
                          <td className="py-2 pr-4 whitespace-nowrap">
                            <DataClassBadge value={g.dc} />
                          </td>
                          <td className="py-2">{g.when}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DialogContent>
              </Dialog>
            </div>
            <select
              id="data_class"
              value={form.data_class ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  data_class: (e.target.value || null) as DataClass | null,
                }))
              }
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
            >
              {DATA_CLASS_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="runbook_url">Runbook URL</Label>
            <Input
              id="runbook_url"
              value={form.runbook_url}
              onChange={(e) =>
                setForm((f) => ({ ...f, runbook_url: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iac_repository">IaC repository</Label>
            <Input
              id="iac_repository"
              value={form.iac_repository}
              onChange={(e) =>
                setForm((f) => ({ ...f, iac_repository: e.target.value }))
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
        title="Deactivate landscape"
        message={
          deactivateTarget ? `Soft-deactivate “${deactivateTarget.name}”?` : ''
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
