import { useMemo } from 'react';

import { useQueries } from '@tanstack/react-query';

import * as cmdb from '@/api/cmdb';

import { applicationsQueryKey } from '@/hooks/useApplications';
import { landscapeEnvironmentsQueryKey } from '@/hooks/useLandscapeEnvironments';
import { landscapesQueryKey } from '@/hooks/useLandscapes';
import { resourcesQueryKey } from '@/hooks/useResources';

import type { SearchCatalog } from '@/utils/global-search';

export type SearchCatalogState = {
  catalog: SearchCatalog | null;
  isLoading: boolean;
  isError: boolean;
};

/**
 * Loads the active applications, landscapes, environments and resources for
 * global search. Uses the same query keys as the list pages, so it shares
 * their cache and their invalidation after edits. Nothing is fetched until
 * `enabled` is true (the search dialog is open).
 */
export function useSearchCatalog(enabled: boolean): SearchCatalogState {
  const [applications, landscapes, environments, resources] = useQueries({
    queries: [
      {
        queryKey: applicationsQueryKey(false),
        queryFn: () => cmdb.listApplications(false),
        enabled,
      },
      {
        queryKey: landscapesQueryKey(false),
        queryFn: () => cmdb.listLandscapes(false),
        enabled,
      },
      {
        queryKey: landscapeEnvironmentsQueryKey(false),
        queryFn: () => cmdb.listLandscapeEnvironments(false),
        enabled,
      },
      {
        queryKey: resourcesQueryKey(false),
        queryFn: () => cmdb.listResources(false, {}),
        enabled,
      },
    ],
  });

  const isError =
    applications.isError ||
    landscapes.isError ||
    environments.isError ||
    resources.isError;

  const appData = applications.data;
  const landscapeData = landscapes.data;
  const environmentData = environments.data;
  const resourceData = resources.data;

  const catalog = useMemo<SearchCatalog | null>(() => {
    if (!appData || !landscapeData || !environmentData || !resourceData) {
      return null;
    }
    return {
      applications: appData,
      landscapes: landscapeData,
      environments: environmentData,
      resources: resourceData,
    };
  }, [appData, landscapeData, environmentData, resourceData]);

  return {
    catalog,
    isLoading: enabled && catalog === null && !isError,
    isError,
  };
}
