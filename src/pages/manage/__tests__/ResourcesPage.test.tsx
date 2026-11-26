import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as cmdb from '@/api/cmdb';

import { ResourcesPage } from '@/pages/manage/ResourcesPage';

import type {
  Application,
  Landscape,
  LandscapeEnvironment,
  Resource,
} from '@/types/cmdb';

vi.mock('@/api/cmdb');

const STAMP = '2026-01-01T00:00:00.000Z';

const landscapes: Landscape[] = [
  {
    id: '1',
    name: 'delphi',
    description: null,
    organization: null,
    devops_contact: null,
    data_class: null,
    runbook_url: null,
    iac_repository: null,
    is_active: true,
    created_at: STAMP,
    updated_at: STAMP,
  },
  {
    id: '2',
    name: 'kos',
    description: null,
    organization: null,
    devops_contact: null,
    data_class: null,
    runbook_url: null,
    iac_repository: null,
    is_active: true,
    created_at: STAMP,
    updated_at: STAMP,
  },
];

function environment(
  id: string,
  landscapeId: string,
  accountName: string,
): LandscapeEnvironment {
  return {
    id,
    landscape_id: landscapeId,
    environment_name: 'dev',
    hosting_provider: 'AWS',
    provider_account_name: accountName,
    provider_account_number: null,
    direct_link: null,
    is_active: true,
    created_at: STAMP,
    updated_at: STAMP,
  };
}

const environments: LandscapeEnvironment[] = [
  environment('10', '1', 'aws-delphi-prod'),
  environment('11', '1', 'aws-delphi-dev'),
  environment('20', '2', 'aws-kos-dev'),
];

const applications: Application[] = [];

const resource: Resource = {
  id: '100',
  landscape_id: '1',
  landscape_environment_id: '11',
  application_id: null,
  resource_scope: 'ENVIRONMENT',
  name: 'easycmdb-db',
  description: null,
  region: 'us-east-1',
  service: 'rds',
  resource_type: 'cluster',
  provider_resource_id: null,
  is_active: true,
  created_at: STAMP,
  updated_at: STAMP,
};

let container: HTMLDivElement;
let root: Root;

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function renderPage(): Promise<void> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ResourcesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  await flush();
  await flush();
}

async function openEditForFirstRow(): Promise<void> {
  const trigger = Array.from(
    container.querySelectorAll<HTMLButtonElement>('tbody button'),
  ).at(-1);
  if (!trigger) throw new Error('row actions button not found');
  await act(async () => {
    trigger.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0 }),
    );
  });
  const edit = Array.from(
    document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ).find((el) => el.textContent?.includes('Edit'));
  if (!edit) throw new Error('Edit menu item not found');
  await act(async () => {
    edit.click();
  });
  await flush();
}

function select(id: string): HTMLSelectElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLSelectElement)) throw new Error(`#${id} not found`);
  return el;
}

async function choose(el: HTMLSelectElement, value: string): Promise<void> {
  await act(async () => {
    el.value = value;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('ResourcesPage edit form', () => {
  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.mocked(cmdb.listResources).mockResolvedValue([resource]);
    vi.mocked(cmdb.listLandscapes).mockResolvedValue(landscapes);
    vi.mocked(cmdb.listApplications).mockResolvedValue(applications);
    vi.mocked(cmdb.listLandscapeEnvironments).mockResolvedValue(environments);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
    vi.resetAllMocks();
  });

  it('keeps the resource provider account when the edit form opens', async () => {
    // Arrange
    await renderPage();

    // Act
    await openEditForFirstRow();

    // Assert
    expect(select('form-landscape').value).toBe('1');
    expect(select('form-env').value).toBe('11');
  });

  it('clears the provider account when the user picks another landscape', async () => {
    // Arrange
    await renderPage();
    await openEditForFirstRow();

    // Act
    await choose(select('form-landscape'), '2');

    // Assert
    expect(select('form-landscape').value).toBe('2');
    expect(select('form-env').value).toBe('');
  });
});
