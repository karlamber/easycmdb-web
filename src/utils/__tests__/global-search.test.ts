import { describe, expect, it } from 'vitest';

import {
  countSearchResults,
  MAX_RESULTS_PER_KIND,
  type SearchCatalog,
  searchCatalog,
} from '@/utils/global-search';

import type {
  Application,
  Landscape,
  LandscapeEnvironment,
  Resource,
} from '@/types/cmdb';

const STAMP = '2026-01-01T00:00:00Z';

function landscape(id: string, name: string): Landscape {
  return {
    id,
    name,
    description: null,
    organization: 'fifty9',
    devops_contact: null,
    data_class: null,
    runbook_url: null,
    iac_repository: null,
    is_active: true,
    created_at: STAMP,
    updated_at: STAMP,
  };
}

function environment(
  id: string,
  landscapeId: string,
  accountName: string | null,
  accountNumber: string | null,
  environmentName = 'dev',
): LandscapeEnvironment {
  return {
    id,
    landscape_id: landscapeId,
    environment_name: environmentName,
    hosting_provider: 'AWS',
    provider_account_name: accountName,
    provider_account_number: accountNumber,
    direct_link: null,
    is_active: true,
    created_at: STAMP,
    updated_at: STAMP,
  };
}

function application(id: string, alias: string): Application {
  return {
    id,
    app_alias: alias,
    business_name: 'easyCMDB',
    description: 'Back end api for easyCMDB.',
    data_class: 'INTERNAL',
    compliance: [],
    business_contact: null,
    development_contact: null,
    support_contact: null,
    source_repository: null,
    prod_url: null,
    runbook_url: null,
    is_active: true,
    created_at: STAMP,
    updated_at: STAMP,
  };
}

function resource(
  id: string,
  name: string,
  envId: string,
  appId: string | null,
  providerResourceId: string | null = null,
): Resource {
  return {
    id,
    landscape_id: '1',
    landscape_environment_id: envId,
    application_id: appId,
    resource_scope: appId ? 'APPLICATION' : 'ENVIRONMENT',
    name,
    description: null,
    region: 'us-east-1',
    service: 'lambda',
    resource_type: 'function',
    provider_resource_id: providerResourceId,
    is_active: true,
    created_at: STAMP,
    updated_at: STAMP,
  };
}

const catalog: SearchCatalog = {
  landscapes: [landscape('1', 'delphi'), landscape('2', 'kos')],
  environments: [
    environment('10', '1', 'aws-delphi-dev', '000000000001'),
    environment('11', '1', 'aws-delphi-prod', '000000000002', 'prod'),
    environment('20', '2', 'aws-kos-dev', '000000000003'),
  ],
  applications: [application('3', 'argus-api')],
  resources: [
    resource(
      '100',
      'easycmdb-api',
      '11',
      '3',
      'arn:aws:lambda:us-east-1:000000000002:function:easycmdb-api',
    ),
    resource('101', 'easycmdb-db', '10', '3'),
    resource('102', 'hebe-web', '20', null),
  ],
};

describe('searchCatalog', () => {
  it('returns nothing for a blank query', () => {
    // Arrange
    const query = '   ';

    // Act
    const target = searchCatalog(catalog, query);

    // Assert
    expect(countSearchResults(target)).toBe(0);
  });

  it('finds every type that matches by name, case-insensitively', () => {
    // Arrange
    const query = 'DELPHI';

    // Act
    const target = searchCatalog(catalog, query);

    // Assert
    expect(target.landscape.map((r) => r.title)).toEqual(['delphi']);
    expect(target.account.map((r) => r.title)).toEqual([
      'aws-delphi-dev',
      'aws-delphi-prod',
    ]);
    expect(target.application).toEqual([]);
  });

  it('matches provider accounts by account number', () => {
    // Arrange
    const query = '000000000001';

    // Act
    const target = searchCatalog(catalog, query);

    // Assert
    expect(target.account.map((r) => r.title)).toEqual(['aws-delphi-dev']);
    expect(target.account[0]?.href).toBe('/provider-accounts/aws-delphi-dev');
  });

  it('matches resources by provider resource id and links to their account', () => {
    // Arrange
    const query = 'arn:aws:lambda';

    // Act
    const target = searchCatalog(catalog, query);

    // Assert
    expect(target.resource).toHaveLength(1);
    expect(target.resource[0]?.title).toBe('easycmdb-api');
    expect(target.resource[0]?.subtitle).toBe(
      'lambda function · argus-api · aws-delphi-prod',
    );
    expect(target.resource[0]?.href).toBe('/provider-accounts/aws-delphi-prod');
  });

  it('ranks exact and prefix name matches above other matches', () => {
    // Arrange
    const query = 'easycmdb';

    // Act
    const target = searchCatalog(catalog, query);

    // Assert
    // argus-api only matches through business name and description.
    expect(target.application[0]?.rank).toBe(3);
    expect(target.resource.map((r) => r.rank)).toEqual([1, 1]);
  });

  it('caps each group', () => {
    // Arrange
    const many: SearchCatalog = {
      ...catalog,
      resources: Array.from({ length: MAX_RESULTS_PER_KIND + 5 }, (_, i) =>
        resource(String(200 + i), `bulk-${i}`, '10', null),
      ),
    };

    // Act
    const target = searchCatalog(many, 'bulk');

    // Assert
    expect(target.resource).toHaveLength(MAX_RESULTS_PER_KIND);
  });

  it('encodes names in links', () => {
    // Arrange
    const withSpace: SearchCatalog = {
      ...catalog,
      landscapes: [landscape('9', 'lab one')],
    };

    // Act
    const target = searchCatalog(withSpace, 'lab');

    // Assert
    expect(target.landscape[0]?.href).toBe('/landscapes/lab%20one');
  });
});
