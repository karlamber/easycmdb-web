import { useMemo, useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Ban,
  CircleHelp,
  FilterX,
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
import { SearchField } from '@/components/SearchField';
import {
  ActiveBadge,
  ComplianceBadge,
  DataClassBadge,
} from '@/components/StatusBadge';
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

import { applicationsQueryKey, useApplications } from '@/hooks/useApplications';

import {
  COMPLIANCE_TAGS,
  complianceGuidance,
  complianceLabel,
  complianceShortGuidance,
  sortCompliance,
} from '@/utils/compliance';
import { dataClassGuidance, dataClassShortGuidance } from '@/utils/data-class';
import { coerceSearchInputModelValue, emptyToNull } from '@/utils/form';

import type { Application, ComplianceTag, DataClass } from '@/types/cmdb';

const DATA_CLASS_OPTIONS: { label: string; value: DataClass | '' }[] = [
  { label: '—', value: '' },
  { label: 'PUBLIC', value: 'PUBLIC' },
  { label: 'INTERNAL', value: 'INTERNAL' },
  { label: 'CONFIDENTIAL', value: 'CONFIDENTIAL' },
  { label: 'RESTRICTED', value: 'RESTRICTED' },
];

type AppForm = {
  app_alias: string;
  business_name: string;
  description: string;
  data_class: DataClass | null;
  compliance: ComplianceTag[];
  business_contact: string;
  development_contact: string;
  support_contact: string;
  source_repository: string;
  prod_url: string;
  runbook_url: string;
};

const emptyForm = (): AppForm => ({
  app_alias: '',
  business_name: '',
  description: '',
  data_class: null,
  compliance: [],
  business_contact: '',
  development_contact: '',
  support_contact: '',
  source_repository: '',
  prod_url: '',
  runbook_url: '',
});

function GuidanceTable({
  title,
  intro,
  rows,
}: {
  title: string;
  intro: string;
  rows: { badge: React.ReactNode; when: string }[];
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-7">
          <CircleHelp className="size-4" />
          <span className="sr-only">{title}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{intro}</DialogDescription>
        </DialogHeader>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4 whitespace-nowrap">Tag</th>
              <th className="py-2">Apply when…</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={String(row.when.slice(0, 24))}
                className="border-b align-top"
              >
                <td className="py-2 pr-4 whitespace-nowrap">{row.badge}</td>
                <td className="py-2">{row.when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
}

export function ApplicationsPage() {
  const queryClient = useQueryClient();
  const [includeInactive, setIncludeInactive] = useState(false);
  const appsQuery = useApplications(includeInactive);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCompliance, setFilterCompliance] = useState<ComplianceTag[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AppForm>(emptyForm);
  const [deactivateTarget, setDeactivateTarget] = useState<Application | null>(
    null,
  );

  const rows = useMemo(() => appsQuery.data ?? [], [appsQuery.data]);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (filterCompliance.length > 0) {
      const wanted = new Set(filterCompliance);
      result = result.filter((row) =>
        row.compliance.some((t) => wanted.has(t)),
      );
    }
    const q = coerceSearchInputModelValue(searchTerm).trim().toLowerCase();
    if (!q) return result;
    return result.filter((row) => {
      const complianceText = row.compliance.map(complianceLabel).join(' ');
      const parts: (string | null | undefined)[] = [
        row.id,
        row.app_alias,
        row.business_name,
        row.description,
        row.data_class,
        complianceText,
        row.business_contact,
        row.development_contact,
        row.support_contact,
        row.source_repository,
        row.prod_url,
        row.runbook_url,
      ];
      return parts.some(
        (p) => p != null && String(p).toLowerCase().includes(q),
      );
    });
  }, [rows, filterCompliance, searchTerm]);

  const hasActiveFilters =
    coerceSearchInputModelValue(searchTerm).trim() !== '' ||
    filterCompliance.length > 0;

  function openCreate(): void {
    setEditingId(null);
    setForm(emptyForm());
    setSheetOpen(true);
  }

  function openEdit(row: Application): void {
    setEditingId(row.id);
    setForm({
      app_alias: row.app_alias,
      business_name: row.business_name ?? '',
      description: row.description ?? '',
      data_class: row.data_class,
      compliance: sortCompliance(row.compliance),
      business_contact: row.business_contact ?? '',
      development_contact: row.development_contact ?? '',
      support_contact: row.support_contact ?? '',
      source_repository: row.source_repository ?? '',
      prod_url: row.prod_url ?? '',
      runbook_url: row.runbook_url ?? '',
    });
    setSheetOpen(true);
  }

  function toPayload(): Record<string, unknown> {
    return {
      app_alias: form.app_alias.trim(),
      business_name: emptyToNull(form.business_name),
      description: emptyToNull(form.description),
      data_class: form.data_class,
      compliance: sortCompliance(form.compliance),
      business_contact: emptyToNull(form.business_contact),
      development_contact: emptyToNull(form.development_contact),
      support_contact: emptyToNull(form.support_contact),
      source_repository: emptyToNull(form.source_repository),
      prod_url: emptyToNull(form.prod_url),
      runbook_url: emptyToNull(form.runbook_url),
    };
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.app_alias.trim()) {
        throw new Error('Alias is required.');
      }
      if (editingId) {
        await cmdb.updateApplication(editingId, toPayload());
      } else {
        await cmdb.createApplication(
          toPayload() as Parameters<typeof cmdb.createApplication>[0],
        );
      }
    },
    onSuccess: async () => {
      toast.success(
        editingId ? 'Application updated.' : 'Application created.',
      );
      setSheetOpen(false);
      await queryClient.invalidateQueries({
        queryKey: applicationsQueryKey(includeInactive),
      });
    },
    onError: async (err) => {
      toast.error(await parseApiError(err));
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => cmdb.deleteApplication(id),
    onSuccess: async () => {
      toast.success('Application deactivated.');
      setDeactivateTarget(null);
      await queryClient.invalidateQueries({
        queryKey: applicationsQueryKey(includeInactive),
      });
    },
    onError: async (err) => {
      toast.error(await parseApiError(err));
    },
  });

  function toggleCompliance(tag: ComplianceTag, checked: boolean): void {
    setFilterCompliance((prev) => {
      if (checked) return sortCompliance([...prev, tag]);
      return prev.filter((t) => t !== tag);
    });
  }

  function toggleFormCompliance(tag: ComplianceTag, checked: boolean): void {
    setForm((prev) => {
      const next = checked
        ? sortCompliance([...prev.compliance, tag])
        : prev.compliance.filter((t) => t !== tag);
      return { ...prev, compliance: next };
    });
  }

  const columns = useMemo<ColumnDef<Application>[]>(
    () => [
      { accessorKey: 'id', header: 'ID' },
      { accessorKey: 'app_alias', header: 'Alias' },
      {
        accessorKey: 'business_name',
        header: 'Business name',
        cell: ({ row }) => row.original.business_name ?? '—',
      },
      {
        accessorKey: 'data_class',
        header: 'Data class',
        cell: ({ row }) => <DataClassBadge value={row.original.data_class} />,
      },
      {
        id: 'compliance',
        header: 'Compliance',
        accessorFn: (row) =>
          sortCompliance(row.compliance).map(complianceLabel).join(', '),
        cell: ({ row }) =>
          row.original.compliance.length === 0 ? (
            <span className="text-slate-400">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {sortCompliance(row.original.compliance).map((tag) => (
                <ComplianceBadge key={tag} tag={tag} />
              ))}
            </div>
          ),
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
        title="Applications"
        countLabel={`${filteredRows.length} of ${rows.length}`}
        onRefresh={() => void appsQuery.refetch()}
        refreshing={appsQuery.isFetching}
      >
        <SearchField
          label="Search applications"
          placeholder="Alias, business name, description, contacts, URLs…"
          value={searchTerm}
          onChange={setSearchTerm}
          className="hidden w-72 lg:block"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!hasActiveFilters}
          onClick={() => {
            setSearchTerm('');
            setFilterCompliance([]);
          }}
          aria-label="Reset search and filters"
        >
          <FilterX className="size-4" />
        </Button>
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

      <div className="mb-4 space-y-4 lg:hidden">
        <SearchField
          label="Search applications"
          placeholder="Alias, business name, description…"
          value={searchTerm}
          onChange={setSearchTerm}
        />
      </div>

      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center gap-2">
          <Label className="text-sm font-medium">Filter by compliance</Label>
          <span className="text-xs text-slate-500">
            Match any selected (OR)
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          {COMPLIANCE_TAGS.map((tag) => (
            <label key={tag} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={filterCompliance.includes(tag)}
                onCheckedChange={(v) => toggleCompliance(tag, v === true)}
              />
              <ComplianceBadge tag={tag} />
            </label>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        loading={appsQuery.isLoading}
        getRowId={(row) => row.id}
      />

      <EntitySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={editingId ? 'Edit application' : 'New application'}
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
            <Label htmlFor="app_alias">App alias</Label>
            <Input
              id="app_alias"
              value={form.app_alias}
              onChange={(e) =>
                setForm((f) => ({ ...f, app_alias: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="business_name">Business name</Label>
            <Input
              id="business_name"
              value={form.business_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, business_name: e.target.value }))
              }
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
            <div className="flex items-center gap-1">
              <Label htmlFor="data_class">Data class</Label>
              <GuidanceTable
                title="Choosing a data class"
                intro={dataClassShortGuidance}
                rows={dataClassGuidance.map((g) => ({
                  badge: <DataClassBadge value={g.dc} />,
                  when: g.when,
                }))}
              />
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
            <p className="text-xs text-slate-500">{dataClassShortGuidance}</p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label>Compliance</Label>
              <GuidanceTable
                title="Choosing compliance tags"
                intro={complianceShortGuidance}
                rows={complianceGuidance.map((g) => ({
                  badge: <ComplianceBadge tag={g.tag} />,
                  when: g.when,
                }))}
              />
            </div>
            <div className="flex flex-wrap gap-2 rounded-md border border-slate-200 p-3">
              {COMPLIANCE_TAGS.map((tag) => (
                <label key={tag} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.compliance.includes(tag)}
                    onCheckedChange={(v) =>
                      toggleFormCompliance(tag, v === true)
                    }
                  />
                  <ComplianceBadge tag={tag} />
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-500">{complianceShortGuidance}</p>
          </div>
          {(
            [
              ['business_contact', 'Business contact'],
              ['development_contact', 'Development contact'],
              ['support_contact', 'Support contact'],
              ['source_repository', 'Source repository'],
              ['prod_url', 'Prod URL'],
              ['runbook_url', 'Runbook URL'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key}>{label}</Label>
              <Input
                id={key}
                value={form[key]}
                onChange={(e) =>
                  setForm((f) => ({ ...f, [key]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
      </EntitySheet>

      <ConfirmDialog
        open={deactivateTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null);
        }}
        title="Deactivate application"
        message={
          deactivateTarget
            ? `Soft-deactivate “${deactivateTarget.app_alias}”?`
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
