export type DataClass = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export type ComplianceTag =
  | 'PII'
  | 'PHI'
  | 'SEALED'
  | 'NDA'
  | 'HIPAA'
  | 'CJIS'
  | 'CMMC'
  | 'CCPA'
  | 'SOC2'
  | 'GDPR';

export type Application = {
  id: string;
  app_alias: string;
  business_name: string | null;
  description: string | null;
  data_class: DataClass | null;
  /**
   * Compliance frameworks / regulatory tags applied to the application.
   * Always an array; the API normalizes missing/null to `[]`.
   */
  compliance: ComplianceTag[];
  business_contact: string | null;
  development_contact: string | null;
  support_contact: string | null;
  source_repository: string | null;
  prod_url: string | null;
  runbook_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Landscape = {
  id: string;
  name: string;
  description: string | null;
  organization: string | null;
  devops_contact: string | null;
  data_class: DataClass | null;
  runbook_url: string | null;
  iac_repository: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type HostingProviderRecord = {
  id: string;
  code: string;
  display_name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** Provider code stored on landscape environments (e.g. AWS, AZURE, GCP, ONPREM). */
export type HostingProviderCode = string;

export type LandscapeEnvironment = {
  id: string;
  landscape_id: string;
  environment_name: string;
  hosting_provider: HostingProviderCode;
  provider_account_name: string | null;
  provider_account_number: string | null;
  direct_link: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ResourceScope = 'APPLICATION' | 'ENVIRONMENT';

export type Resource = {
  id: string;
  landscape_id: string;
  landscape_environment_id: string;
  application_id: string | null;
  resource_scope: ResourceScope;
  name: string;
  description: string | null;
  region: string | null;
  service: string | null;
  resource_type: string | null;
  provider_resource_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
