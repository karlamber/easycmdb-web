import { useQuery } from '@tanstack/react-query';

import * as cmdb from '@/api/cmdb';

export const landscapesQueryKey = (includeInactive: boolean) =>
  ['landscapes', includeInactive] as const;

export function useLandscapes(includeInactive = false) {
  return useQuery({
    queryKey: landscapesQueryKey(includeInactive),
    queryFn: () => cmdb.listLandscapes(includeInactive),
  });
}
