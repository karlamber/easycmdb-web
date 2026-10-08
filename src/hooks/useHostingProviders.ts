import { useQuery } from '@tanstack/react-query';

import * as cmdb from '@/api/cmdb';

export const hostingProvidersQueryKey = (includeInactive: boolean) =>
  ['hosting-providers', includeInactive] as const;

export function useHostingProviders(includeInactive = false) {
  return useQuery({
    queryKey: hostingProvidersQueryKey(includeInactive),
    queryFn: () => cmdb.listHostingProviders(includeInactive),
  });
}
