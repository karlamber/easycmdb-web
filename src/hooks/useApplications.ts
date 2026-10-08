import { useQuery } from '@tanstack/react-query';

import * as cmdb from '@/api/cmdb';

export const applicationsQueryKey = (includeInactive: boolean) =>
  ['applications', includeInactive] as const;

export function useApplications(includeInactive = false) {
  return useQuery({
    queryKey: applicationsQueryKey(includeInactive),
    queryFn: () => cmdb.listApplications(includeInactive),
  });
}
