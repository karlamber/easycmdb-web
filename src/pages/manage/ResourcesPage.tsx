import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ColumnDef } from '@tanstack/react-table';
import { Ban, FilterX, MoreHorizontal, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';

import * as cmdb from '@/api/cmdb';
import { parseApiError } from '@/api/http';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DataTable } from '@/components/DataTable';
import { EntitySheet } from '@/components/EntitySheet';
import { PageHeader } from '@/components/PageHeader';
import { SearchField } from '@/components/SearchField';
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

import { type ResourceFilters, resourcesQueryKey } from '@/hooks/useResources';

import { coerceSearchInputModelValue, emptyToNull } from '@/utils/form';
import { providerAccountName } from '@/utils/provider-account';

import type {
  Application,
  Landscape,
  LandscapeEnvironment,
  Resource,
  ResourceScope,
} from '@/types/cmdb';

type ResourceForm = {
  landscape_id: string | null;
  landscape_environment_id: string | null;
  application_id: string | null;
  resource_scope: ResourceScope;
  name: string;
  region: string;
  service: string;
  resource_type: string;
  provider_resource_id: string;
};

const emptyForm = (landscapeId: string | null = null): ResourceForm => ({
  landscape_id: landscapeId,
  landscape_environment_id: null,
  application_id: null,
  resource_scope: 'ENVIRONMENT',
  name: '',
  region: '',
  service: '',
  resource_type: '',
  provider_resource_id: '',
});

function ComboboxInput({
  id,
  label,
  value,
  options,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  hint?: string;
}) {
  const listId = `${id}-options`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {options.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function ResourcesPage() {
  const queryClient = useQueryClient();
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [includeInactive, setIncludeInactive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterApplicationId, setFilterApplicationId] = useState<string | null>(
    null,
  );
  const [filterLandscapeId, setFilterLandscapeId] = useState<string | null>(
    null,
  );
  const [filterEnvironmentId, setFilterEnvironmentId] = useState<string | null>(
    null,
  );
  const [filterService, setFilterService] = useState<string | null>(null);
  const [filterResourceType, setFilterResourceType] = useState<string | null>(
    null,
  );
  const skipFilterLoad = useRef(false);

  const apiFilters: ResourceFilters = useMemo(
    () => ({
      landscapeId: filterLandscapeId ?? undefined,
      landscapeEnvironmentId: filterEnvironmentId ?? undefined,
      applicationId: filterApplicationId ?? undefined,
    }),
    [filterLandscapeId, filterEnvironmentId, filterApplicationId],
  );

  const resourcesQuery = useQuery({
    queryKey: resourcesQueryKey(includeInactive, apiFilters),
    queryFn: () => cmdb.listResources(includeInactive, apiFilters),
  });

  const referencesQuery = useQuery({
    queryKey: ['resource-references'] as const,
    queryFn: async () => {
      const [landscapes, applications, environments] = await Promise.all([
        cmdb.listLandscapes(true),
        cmdb.listApplications(true),
        cmdb.listLandscapeEnvironments(true),
      ]);
      return { landscapes, applications, environments };
    },
  });

  const landscapes = useMemo(
    () => referencesQuery.data?.landscapes ?? [],
    [referencesQuery.data?.landscapes],
  );
  const applications = useMemo(
    () => referencesQuery.data?.applications ?? [],
    [referencesQuery.data?.applications],
  );
  const environments = useMemo(
    () => referencesQuery.data?.environments ?? [],
    [referencesQuery.data?.environments],
  );
  const rows = useMemo(() => resourcesQuery.data ?? [], [resourcesQuery.data]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ResourceForm>(emptyForm());
  const [deactivateTarget, setDeactivateTarget] = useState<Resource | null>(
    null,
  );

  const landscapeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of landscapes) map.set(l.id, l.name);
    return map;
  }, [landscapes]);

  const applicationNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of applications) map.set(a.id, a.app_alias);
    return map;
  }, [applications]);

  const environmentById = useMemo(() => {
    const map = new Map<string, LandscapeEnvironment>();
    for (const e of environments) map.set(e.id, e);
    return map;
  }, [environments]);

  const serviceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.service != null && r.service.trim() !== '') set.add(r.service);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);
  const resourceTypeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.resource_type != null && r.resource_type.trim() !== '') {
        set.add(r.resource_type);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);
  const regionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.region != null && r.region.trim() !== '') set.add(r.region);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const landscapeLabel = useMemo(
    () =>
      (row: Resource): string =>
        landscapeNameById.get(row.landscape_id) ?? `#${row.landscape_id}`,
    [landscapeNameById],
  );

  const applicationLabel = useMemo(
    () =>
      (row: Resource): string => {
        if (row.application_id == null) return '—';
        return (
          applicationNameById.get(row.application_id) ??
          `#${row.application_id}`
        );
      },
    [applicationNameById],
  );

  const providerAccountLabel = useMemo(
    () =>
      (row: Resource): string =>
        providerAccountName(environmentById.get(row.landscape_environment_id)),
    [environmentById],
  );

  const filterEnvironmentOptions = useMemo(
    () =>
      environments
        .filter(
          (e) => !filterLandscapeId || e.landscape_id === filterLandscapeId,
        )
        .map((e) => ({
          label: filterLandscapeId
            ? providerAccountName(e, e.id)
            : `${landscapeNameById.get(e.landscape_id) ?? '—'} · ${providerAccountName(e, e.id)}`,
          value: e.id,
        })),
    [environments, filterLandscapeId, landscapeNameById],
  );

  const formEnvironmentOptions = useMemo(
    () =>
      environments
        .filter(
          (e) => !form.landscape_id || e.landscape_id === form.landscape_id,
        )
        .map((e) => ({
          label: providerAccountName(e, e.id),
          value: e.id,
        })),
    [environments, form.landscape_id],
  );

  const filteredRows = useMemo(() => {
    let result = rows;
    if (filterService) {
      result = result.filter((row) => row.service === filterService);
    }
    if (filterResourceType) {
      result = result.filter((row) => row.resource_type === filterResourceType);
    }
    const q = coerceSearchInputModelValue(searchTerm).trim().toLowerCase();
    if (q === '') return result;
    return result.filter((row) => {
      const env = environmentById.get(row.landscape_environment_id);
      const parts: (string | null | undefined)[] = [
        row.name,
        row.id,
        landscapeLabel(row),
        providerAccountLabel(row),
        applicationLabel(row),
        env?.environment_name,
        row.service,
        row.resource_type,
        row.region,
        row.resource_scope,
        row.description,
        row.provider_resource_id,
      ];
      return parts.some(
        (p) => p != null && String(p).toLowerCase().includes(q),
      );
    });
  }, [
    rows,
    filterService,
    filterResourceType,
    searchTerm,
    environmentById,
    landscapeLabel,
    providerAccountLabel,
    applicationLabel,
  ]);

  const hasActiveFilters =
    coerceSearchInputModelValue(searchTerm).trim() !== '' ||
    filterApplicationId != null ||
    filterLandscapeId != null ||
    filterEnvironmentId != null ||
    filterService != null ||
    filterResourceType != null;

  useEffect(() => {
    if (skipFilterLoad.current) return;
    setFilterEnvironmentId((prev) => {
      if (filterLandscapeId == null) return prev;
      if (prev == null) return prev;
      const env = environmentById.get(prev);
      if (env && env.landscape_id !== filterLandscapeId) return null;
      return prev;
    });
  }, [filterLandscapeId, environmentById]);

  useEffect(() => {
    setForm((f) => ({ ...f, landscape_environment_id: null }));
  }, [form.landscape_id]);

  useEffect(() => {
    if (form.resource_scope === 'ENVIRONMENT') {
      setForm((f) => ({ ...f, application_id: null }));
    }
  }, [form.resource_scope]);

  function resetFilters(): void {
    skipFilterLoad.current = true;
    setSearchTerm('');
    setFilterApplicationId(null);
    setFilterLandscapeId(null);
    setFilterEnvironmentId(null);
    setFilterService(null);
    setFilterResourceType(null);
    skipFilterLoad.current = false;
  }

  function openCreate(): void {
    setEditingId(null);
    setForm(emptyForm(filterLandscapeId));
    setSheetOpen(true);
  }

  function openEdit(row: Resource): void {
    setEditingId(row.id);
    setForm({
      landscape_id: row.landscape_id,
      landscape_environment_id: row.landscape_environment_id,
      application_id: row.application_id,
      resource_scope: row.resource_scope,
      name: row.name,
      region: row.region ?? '',
      service: row.service ?? '',
      resource_type: row.resource_type ?? '',
      provider_resource_id: row.provider_resource_id ?? '',
    });
    setSheetOpen(true);
  }

  function toPayload(): Record<string, unknown> {
    const applicationId =
      form.resource_scope === 'APPLICATION' ? form.application_id : null;
    return {
      landscape_id: form.landscape_id,
      landscape_environment_id: form.landscape_environment_id,
      application_id: applicationId,
      resource_scope: form.resource_scope,
      name: form.name.trim(),
      region: emptyToNull(form.region),
      service: emptyToNull(form.service),
      resource_type: emptyToNull(form.resource_type),
      provider_resource_id: emptyToNull(form.provider_resource_id),
    };
  }

  async function persist(): Promise<boolean> {
    if (!form.landscape_id || !form.landscape_environment_id) {
      toast.warning('Landscape and provider account are required.');
      return false;
    }
    if (!form.name.trim()) {
      toast.warning('Resource name is required.');
      return false;
    }
    if (form.resource_scope === 'APPLICATION' && !form.application_id) {
      toast.warning('Application is required for APPLICATION scope.');
      return false;
    }
    try {
      if (editingId) {
        await cmdb.updateResource(editingId, toPayload());
        toast.success('Resource updated.');
      } else {
        await cmdb.createResource(
          toPayload() as Parameters<typeof cmdb.createResource>[0],
        );
        toast.success('Resource created.');
      }
      await queryClient.invalidateQueries({ queryKey: ['resources'] });
      return true;
    } catch (err) {
      toast.error(await parseApiError(err));
      return false;
    }
  }

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => cmdb.deleteResource(id),
    onSuccess: async () => {
      toast.success('Resource deactivated.');
      setDeactivateTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
    onError: async (err) => toast.error(await parseApiError(err)),
  });

  function resetForAnotherNewResource(): void {
    setForm((f) => ({
      ...f,
      name: '',
      service: '',
      resource_type: '',
      provider_resource_id: '',
    }));
  }

  async function save(): Promise<void> {
    if (!(await persist())) return;
    setSheetOpen(false);
  }

  async function saveAndNew(): Promise<void> {
    if (!(await persist())) return;
    setEditingId(null);
    resetForAnotherNewResource();
    nameInputRef.current?.focus();
  }

  const columns = useMemo<ColumnDef<Resource>[]>(
    () => [
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'resource_scope', header: 'Scope' },
      {
        id: 'landscape',
        header: 'Landscape',
        accessorFn: landscapeLabel,
        cell: ({ row }) => landscapeLabel(row.original),
      },
      {
        id: 'provider_account',
        header: 'Provider account',
        accessorFn: providerAccountLabel,
        cell: ({ row }) => {
          const env = environmentById.get(
            row.original.landscape_environment_id,
          );
          const accountName = providerAccountLabel(row.original);
          if (env?.provider_account_name) {
            return (
              <Link
                to={`/provider-accounts/${encodeURIComponent(env.provider_account_name)}`}
                className="text-teal-700 hover:underline"
              >
                {accountName}
              </Link>
            );
          }
          return accountName;
        },
      },
      {
        id: 'application',
        header: 'Application',
        accessorFn: applicationLabel,
        cell: ({ row }) => applicationLabel(row.original),
      },
      {
        accessorKey: 'service',
        header: 'Service',
        cell: ({ row }) => row.original.service ?? '—',
      },
      {
        accessorKey: 'resource_type',
        header: 'Type',
        cell: ({ row }) => row.original.resource_type ?? '—',
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
    [environmentById, landscapeLabel, providerAccountLabel, applicationLabel],
  );

  return (
    <div>
      <PageHeader
        title="Resources"
        countLabel={`${filteredRows.length} of ${rows.length}`}
        onRefresh={() => void resourcesQuery.refetch()}
        refreshing={resourcesQuery.isFetching}
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

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <SearchField
          label="Search resources"
          placeholder="Name, service, region…"
          value={searchTerm}
          onChange={setSearchTerm}
          className="min-w-[240px] flex-1 md:max-w-sm"
        />
        <div className="min-w-[160px] space-y-1.5">
          <Label htmlFor="res-filter-app" className="text-sm text-slate-600">
            Application
          </Label>
          <select
            id="res-filter-app"
            value={filterApplicationId ?? ''}
            onChange={(e) =>
              setFilterApplicationId(
                e.target.value === '' ? null : e.target.value,
              )
            }
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All</option>
            {applications.map((a: Application) => (
              <option key={a.id} value={a.id}>
                {a.app_alias} (#{a.id})
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[160px] space-y-1.5">
          <Label htmlFor="res-filter-ls" className="text-sm text-slate-600">
            Landscape
          </Label>
          <select
            id="res-filter-ls"
            value={filterLandscapeId ?? ''}
            onChange={(e) => {
              setFilterLandscapeId(
                e.target.value === '' ? null : e.target.value,
              );
              setFilterEnvironmentId(null);
            }}
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All</option>
            {landscapes.map((l: Landscape) => (
              <option key={l.id} value={l.id}>
                {l.name} (#{l.id})
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[160px] space-y-1.5">
          <Label htmlFor="res-filter-env" className="text-sm text-slate-600">
            Provider account
          </Label>
          <select
            id="res-filter-env"
            value={filterEnvironmentId ?? ''}
            onChange={(e) =>
              setFilterEnvironmentId(
                e.target.value === '' ? null : e.target.value,
              )
            }
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All</option>
            {filterEnvironmentOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[120px] space-y-1.5">
          <Label
            htmlFor="res-filter-service"
            className="text-sm text-slate-600"
          >
            Service
          </Label>
          <select
            id="res-filter-service"
            value={filterService ?? ''}
            onChange={(e) =>
              setFilterService(e.target.value === '' ? null : e.target.value)
            }
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All</option>
            {serviceOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[120px] space-y-1.5">
          <Label htmlFor="res-filter-type" className="text-sm text-slate-600">
            Type
          </Label>
          <select
            id="res-filter-type"
            value={filterResourceType ?? ''}
            onChange={(e) =>
              setFilterResourceType(
                e.target.value === '' ? null : e.target.value,
              )
            }
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">All</option>
            {resourceTypeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!hasActiveFilters}
          onClick={resetFilters}
        >
          <FilterX className="mr-1.5 size-4" />
          Reset filters
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filteredRows}
        loading={resourcesQuery.isLoading}
        getRowId={(row) => row.id}
      />

      <EntitySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={editingId ? 'Edit resource' : 'New resource'}
        className="sm:max-w-xl"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSheetOpen(false)}
            >
              Cancel
            </Button>
            {!editingId ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void saveAndNew()}
              >
                Save + New
              </Button>
            ) : null}
            <Button
              type="button"
              className="bg-teal-700 hover:bg-teal-800"
              onClick={() => void save()}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4 px-1">
          <div className="space-y-1.5">
            <Label htmlFor="form-landscape">Landscape</Label>
            <select
              id="form-landscape"
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
            <Label htmlFor="form-env">Provider account</Label>
            <select
              id="form-env"
              value={form.landscape_environment_id ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  landscape_environment_id: e.target.value || null,
                }))
              }
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
            >
              <option value="">Select provider account</option>
              {formEnvironmentOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            {(
              [
                ['ENVIRONMENT', 'Environment'],
                ['APPLICATION', 'Application'],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant={form.resource_scope === value ? 'default' : 'outline'}
                className={
                  form.resource_scope === value
                    ? 'bg-teal-700 hover:bg-teal-800'
                    : undefined
                }
                onClick={() =>
                  setForm((f) => ({ ...f, resource_scope: value }))
                }
              >
                {label}
              </Button>
            ))}
          </div>
          {form.resource_scope === 'APPLICATION' ? (
            <div className="space-y-1.5">
              <Label htmlFor="form-app">Application</Label>
              <select
                id="form-app"
                value={form.application_id ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    application_id: e.target.value || null,
                  }))
                }
                className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
              >
                <option value="">Select application</option>
                {applications.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.app_alias} (#{a.id})
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="form-name">Resource name</Label>
            <Input
              id="form-name"
              ref={nameInputRef}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <ComboboxInput
            id="form-region"
            label="Region"
            value={form.region}
            options={regionOptions}
            onChange={(region) => setForm((f) => ({ ...f, region }))}
            hint="Pick an existing value or type a new one"
          />
          <ComboboxInput
            id="form-service"
            label="Service"
            value={form.service}
            options={serviceOptions}
            onChange={(service) => setForm((f) => ({ ...f, service }))}
            hint="Pick an existing value or type a new one"
          />
          <ComboboxInput
            id="form-resource-type"
            label="Resource type"
            value={form.resource_type}
            options={resourceTypeOptions}
            onChange={(resource_type) =>
              setForm((f) => ({ ...f, resource_type }))
            }
            hint="Pick an existing value or type a new one"
          />
          <div className="space-y-1.5">
            <Label htmlFor="form-provider-id">Provider resource id</Label>
            <Input
              id="form-provider-id"
              value={form.provider_resource_id}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  provider_resource_id: e.target.value,
                }))
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
        title="Deactivate resource"
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
