import { api } from '@/api/http';

import type {
  Application,
  HostingProviderRecord,
  Landscape,
  LandscapeEnvironment,
  Resource,
} from '@/types/cmdb';

function inactiveParam(includeInactive: boolean): Record<string, string> {
  return includeInactive ? { include_inactive: 'true' } : {};
}

type ListEnvelope<T> = {
  items?: T[];
  data?: T[];
  results?: T[];
};

function normalizeListResponse<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }
  if (payload && typeof payload === 'object') {
    const envelope = payload as ListEnvelope<T>;
    if (Array.isArray(envelope.items)) {
      return envelope.items;
    }
    if (Array.isArray(envelope.data)) {
      return envelope.data;
    }
    if (Array.isArray(envelope.results)) {
      return envelope.results;
    }
  }
  return [];
}

export async function listApplications(
  includeInactive: boolean,
): Promise<Application[]> {
  const { data } = await api.get<unknown>('/applications', {
    params: inactiveParam(includeInactive),
  });
  return normalizeListResponse<Application>(data);
}

export async function createApplication(
  body: Partial<Application> & { app_alias: string },
): Promise<Application> {
  const { data } = await api.post<Application>('/applications', body);
  return data;
}

export async function updateApplication(
  id: string,
  body: Record<string, unknown>,
): Promise<Application> {
  const { data } = await api.patch<Application>(`/applications/${id}`, body);
  return data;
}

export async function deleteApplication(id: string): Promise<void> {
  await api.delete(`/applications/${id}`);
}

export async function listLandscapes(
  includeInactive: boolean,
): Promise<Landscape[]> {
  const { data } = await api.get<unknown>('/landscapes', {
    params: inactiveParam(includeInactive),
  });
  return normalizeListResponse<Landscape>(data);
}

export async function createLandscape(
  body: Partial<Landscape> & { name: string },
): Promise<Landscape> {
  const { data } = await api.post<Landscape>('/landscapes', body);
  return data;
}

export async function updateLandscape(
  id: string,
  body: Record<string, unknown>,
): Promise<Landscape> {
  const { data } = await api.patch<Landscape>(`/landscapes/${id}`, body);
  return data;
}

export async function deleteLandscape(id: string): Promise<void> {
  await api.delete(`/landscapes/${id}`);
}

export async function listLandscapeEnvironments(
  includeInactive: boolean,
  landscapeId?: string,
): Promise<LandscapeEnvironment[]> {
  const { data } = await api.get<unknown>('/landscape-environments', {
    params: {
      ...inactiveParam(includeInactive),
      ...(landscapeId ? { landscape_id: landscapeId } : {}),
    },
  });
  return normalizeListResponse<LandscapeEnvironment>(data);
}

export async function createLandscapeEnvironment(
  body: Partial<LandscapeEnvironment> & {
    landscape_id: string;
    environment_name: string;
    hosting_provider: LandscapeEnvironment['hosting_provider'];
  },
): Promise<LandscapeEnvironment> {
  const { data } = await api.post<LandscapeEnvironment>(
    '/landscape-environments',
    body,
  );
  return data;
}

export async function updateLandscapeEnvironment(
  id: string,
  body: Record<string, unknown>,
): Promise<LandscapeEnvironment> {
  const { data } = await api.patch<LandscapeEnvironment>(
    `/landscape-environments/${id}`,
    body,
  );
  return data;
}

export async function deleteLandscapeEnvironment(id: string): Promise<void> {
  await api.delete(`/landscape-environments/${id}`);
}

export async function listHostingProviders(
  includeInactive: boolean,
): Promise<HostingProviderRecord[]> {
  const { data } = await api.get<unknown>('/hosting-providers', {
    params: inactiveParam(includeInactive),
  });
  return normalizeListResponse<HostingProviderRecord>(data);
}

export async function createHostingProvider(
  body: Partial<HostingProviderRecord> & {
    code: string;
    display_name: string;
  },
): Promise<HostingProviderRecord> {
  const { data } = await api.post<HostingProviderRecord>(
    '/hosting-providers',
    body,
  );
  return data;
}

export async function updateHostingProvider(
  id: string,
  body: Record<string, unknown>,
): Promise<HostingProviderRecord> {
  const { data } = await api.patch<HostingProviderRecord>(
    `/hosting-providers/${id}`,
    body,
  );
  return data;
}

export async function deleteHostingProvider(id: string): Promise<void> {
  await api.delete(`/hosting-providers/${id}`);
}

export async function listResources(
  includeInactive: boolean,
  filters: {
    landscapeId?: string;
    landscapeEnvironmentId?: string;
    applicationId?: string;
  },
): Promise<Resource[]> {
  const { data } = await api.get<unknown>('/resources', {
    params: {
      ...inactiveParam(includeInactive),
      ...(filters.landscapeId ? { landscape_id: filters.landscapeId } : {}),
      ...(filters.landscapeEnvironmentId
        ? { landscape_environment_id: filters.landscapeEnvironmentId }
        : {}),
      ...(filters.applicationId
        ? { application_id: filters.applicationId }
        : {}),
    },
  });
  return normalizeListResponse<Resource>(data);
}

export async function createResource(
  body: Partial<Resource> & {
    landscape_id: string;
    landscape_environment_id: string;
    resource_scope: Resource['resource_scope'];
    name: string;
  },
): Promise<Resource> {
  const { data } = await api.post<Resource>('/resources', body);
  return data;
}

export async function updateResource(
  id: string,
  body: Record<string, unknown>,
): Promise<Resource> {
  const { data } = await api.patch<Resource>(`/resources/${id}`, body);
  return data;
}

export async function deleteResource(id: string): Promise<void> {
  await api.delete(`/resources/${id}`);
}

export type MeResponse = {
  user: string;
  role: 'admin' | 'app_editor' | 'viewer';
};

export async function getMe(): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>('/me');
  return data;
}
