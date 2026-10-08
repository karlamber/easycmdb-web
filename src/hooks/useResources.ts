import { useQuery } from '@tanstack/react-query';

import * as cmdb from '@/api/cmdb';

export type ResourceFilters = {
  landscapeId?: string;
  landscapeEnvironmentId?: string;
  applicationId?: string;
};

export const resourcesQueryKey = (
  includeInactive: boolean,
  filters: ResourceFilters = {},
) =>
  [
    'resources',
    includeInactive,
    filters.landscapeId ?? '',
    filters.landscapeEnvironmentId ?? '',
    filters.applicationId ?? '',
  ] as const;

export function useResources(
  includeInactive = false,
  filters: ResourceFilters = {},
) {
  return useQuery({
    queryKey: resourcesQueryKey(includeInactive, filters),
    queryFn: () => cmdb.listResources(includeInactive, filters),
  });
}
