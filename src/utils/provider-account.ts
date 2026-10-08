import type { LandscapeEnvironment } from '@/types/cmdb';

/** Display label for a landscape environment's provider account name. */
export function providerAccountName(
  environment: LandscapeEnvironment | undefined,
  fallbackId?: string,
): string {
  const name = environment?.provider_account_name?.trim();
  if (name) return name;
  if (fallbackId) return `#${fallbackId}`;
  return '—';
}
