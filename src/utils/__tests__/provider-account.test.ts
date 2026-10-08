import { describe, expect, it } from 'vitest';

import { providerAccountName } from '@/utils/provider-account';

import type { LandscapeEnvironment } from '@/types/cmdb';

const baseEnv: LandscapeEnvironment = {
  id: '1',
  landscape_id: '10',
  environment_name: 'Production',
  hosting_provider: 'AWS',
  provider_account_name: 'agora-prod',
  provider_account_number: '123456789012',
  direct_link: null,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('providerAccountName', () => {
  it('returns provider_account_name when set', () => {
    expect(providerAccountName(baseEnv)).toBe('agora-prod');
  });

  it('returns em dash when missing and no fallback id', () => {
    expect(
      providerAccountName({ ...baseEnv, provider_account_name: null }),
    ).toBe('—');
  });

  it('returns fallback id when name is missing', () => {
    expect(
      providerAccountName({ ...baseEnv, provider_account_name: null }, '42'),
    ).toBe('#42');
  });

  it('treats blank names as missing', () => {
    expect(
      providerAccountName({ ...baseEnv, provider_account_name: '   ' }),
    ).toBe('—');
  });
});
