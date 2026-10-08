import { useQuery } from '@tanstack/react-query';

import * as cmdb from '@/api/cmdb';

export const landscapeEnvironmentsQueryKey = (
  includeInactive: boolean,
  landscapeId?: string,
) => ['landscape-environments', includeInactive, landscapeId ?? ''] as const;

export function useLandscapeEnvironments(
  includeInactive = false,
  landscapeId?: string,
) {
  return useQuery({
    queryKey: landscapeEnvironmentsQueryKey(includeInactive, landscapeId),
    queryFn: () => cmdb.listLandscapeEnvironments(includeInactive, landscapeId),
  });
}
