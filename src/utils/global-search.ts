import type {
  Application,
  Landscape,
  LandscapeEnvironment,
  Resource,
} from '@/types/cmdb';

export const SEARCH_KINDS = [
  'landscape',
  'account',
  'application',
  'resource',
] as const;

export type SearchKind = (typeof SEARCH_KINDS)[number];

export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  landscape: 'Landscapes',
  account: 'Provider accounts',
  application: 'Applications',
  resource: 'Resources',
};

export type SearchCatalog = {
  applications: readonly Application[];
  landscapes: readonly Landscape[];
  environments: readonly LandscapeEnvironment[];
  resources: readonly Resource[];
};

export type SearchResult = {
  /** Unique within its kind; used as the React key and the option id. */
  key: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  href: string;
  /** Lower is better. */
  rank: number;
};

export type SearchResults = Record<SearchKind, SearchResult[]>;

/** Results shown per group before the list is cut off. */
export const MAX_RESULTS_PER_KIND = 8;

type Candidate = Omit<SearchResult, 'rank'> & {
  /** The name the user is most likely typing. */
  primary: string;
  /** Other text that should match (descriptions, ids, account numbers). */
  secondary: readonly (string | null | undefined)[];
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function rankCandidate(candidate: Candidate, q: string): number | null {
  const primary = normalize(candidate.primary);
  if (primary === q) return 0;
  if (primary.startsWith(q)) return 1;
  if (primary.includes(q)) return 2;
  const secondaryHit = candidate.secondary.some(
    (s) => s != null && normalize(s).includes(q),
  );
  return secondaryHit ? 3 : null;
}

function joinParts(parts: readonly (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => p != null && p.trim() !== '')
    .join(' · ');
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function encodePath(segment: string): string {
  return encodeURIComponent(segment);
}

function landscapeCandidates(catalog: SearchCatalog): Candidate[] {
  return catalog.landscapes.map((l) => {
    const envCount = catalog.environments.filter(
      (e) => e.landscape_id === l.id,
    ).length;
    return {
      key: `landscape:${l.id}`,
      kind: 'landscape',
      title: l.name,
      subtitle: joinParts([
        l.organization,
        plural(envCount, 'environment', 'environments'),
      ]),
      href: `/landscapes/${encodePath(l.name)}`,
      primary: l.name,
      secondary: [l.description, l.organization, l.devops_contact],
    };
  });
}

/** One result per provider account name, which may span several environments. */
function accountCandidates(catalog: SearchCatalog): Candidate[] {
  const byName = new Map<string, LandscapeEnvironment[]>();
  for (const env of catalog.environments) {
    const name = env.provider_account_name?.trim();
    if (!name) continue;
    const list = byName.get(name) ?? [];
    list.push(env);
    byName.set(name, list);
  }

  return Array.from(byName.entries()).map(([name, envs]) => {
    const envIds = new Set(envs.map((e) => e.id));
    const resourceCount = catalog.resources.filter((r) =>
      envIds.has(r.landscape_environment_id),
    ).length;
    const providers = Array.from(new Set(envs.map((e) => e.hosting_provider)));
    const envNames = Array.from(new Set(envs.map((e) => e.environment_name)));
    const numbers = Array.from(
      new Set(
        envs
          .map((e) => e.provider_account_number)
          .filter((n): n is string => n != null && n.trim() !== ''),
      ),
    );
    return {
      key: `account:${name}`,
      kind: 'account',
      title: name,
      subtitle: joinParts([
        providers.join(', '),
        envNames.join(', '),
        numbers.join(', '),
        plural(resourceCount, 'resource', 'resources'),
      ]),
      href: `/provider-accounts/${encodePath(name)}`,
      primary: name,
      secondary: [...numbers, ...envNames, ...providers],
    };
  });
}

function applicationCandidates(catalog: SearchCatalog): Candidate[] {
  return catalog.applications.map((a) => ({
    key: `application:${a.id}`,
    kind: 'application',
    title: a.app_alias,
    subtitle: joinParts([a.business_name, a.data_class]),
    href: `/applications/${encodePath(a.app_alias)}`,
    primary: a.app_alias,
    secondary: [
      a.business_name,
      a.description,
      a.source_repository,
      a.prod_url,
      ...a.compliance,
    ],
  }));
}

function resourceCandidates(catalog: SearchCatalog): Candidate[] {
  const envById = new Map(catalog.environments.map((e) => [e.id, e]));
  const appById = new Map(catalog.applications.map((a) => [a.id, a]));
  const landscapeById = new Map(catalog.landscapes.map((l) => [l.id, l]));

  return catalog.resources.map((r) => {
    const env = envById.get(r.landscape_environment_id);
    const accountName = env?.provider_account_name?.trim() || null;
    const app = r.application_id ? appById.get(r.application_id) : undefined;
    const landscape = landscapeById.get(r.landscape_id);
    // Resources have no page of their own; open the provider account that
    // lists them, or the landscape when the account has no name.
    const href = accountName
      ? `/provider-accounts/${encodePath(accountName)}`
      : landscape
        ? `/landscapes/${encodePath(landscape.name)}`
        : '/all-resources';
    return {
      key: `resource:${r.id}`,
      kind: 'resource',
      title: r.name,
      subtitle: joinParts([
        [r.service, r.resource_type].filter((p) => p != null).join(' '),
        app?.app_alias,
        accountName,
      ]),
      href,
      primary: r.name,
      secondary: [
        r.provider_resource_id,
        r.description,
        r.service,
        r.resource_type,
        r.region,
      ],
    };
  });
}

export function emptySearchResults(): SearchResults {
  return { landscape: [], account: [], application: [], resource: [] };
}

/**
 * Case-insensitive search across every entity type. Names rank above
 * descriptions, ids and account numbers; each group is sorted by rank, then
 * title, and cut to MAX_RESULTS_PER_KIND.
 */
export function searchCatalog(
  catalog: SearchCatalog,
  query: string,
): SearchResults {
  const q = normalize(query);
  const results = emptySearchResults();
  if (q === '') return results;

  const candidates = [
    ...landscapeCandidates(catalog),
    ...accountCandidates(catalog),
    ...applicationCandidates(catalog),
    ...resourceCandidates(catalog),
  ];

  for (const candidate of candidates) {
    const rank = rankCandidate(candidate, q);
    if (rank === null) continue;
    results[candidate.kind].push({
      key: candidate.key,
      kind: candidate.kind,
      title: candidate.title,
      subtitle: candidate.subtitle,
      href: candidate.href,
      rank,
    });
  }

  for (const kind of SEARCH_KINDS) {
    results[kind] = results[kind]
      .sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title))
      .slice(0, MAX_RESULTS_PER_KIND);
  }
  return results;
}

export function countSearchResults(results: SearchResults): number {
  return SEARCH_KINDS.reduce((sum, kind) => sum + results[kind].length, 0);
}
