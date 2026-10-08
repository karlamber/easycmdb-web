import type { DataClass } from '@/types/cmdb';

export type DataClassBadgeProps = {
  color: string;
  textColor?: string;
  label: string;
};

/** Legacy Quasar-style badge props; null when unset so callers can render a placeholder. */
export function dataClassBadgeProps(
  dc: DataClass | null | undefined,
): DataClassBadgeProps | null {
  if (!dc) return null;
  switch (dc) {
    case 'PUBLIC':
      return { color: 'green', label: dc };
    case 'INTERNAL':
      return { color: 'blue', label: dc };
    case 'CONFIDENTIAL':
      return { color: 'yellow', textColor: 'black', label: dc };
    case 'RESTRICTED':
      return { color: 'red', label: dc };
  }
}

const DATA_CLASS_BADGE_CLASSES: Record<DataClass, string> = {
  PUBLIC: 'bg-green-100 text-green-800 border-green-200',
  INTERNAL: 'bg-blue-100 text-blue-800 border-blue-200',
  CONFIDENTIAL: 'bg-yellow-100 text-yellow-900 border-yellow-200',
  RESTRICTED: 'bg-red-100 text-red-800 border-red-200',
};

export function dataClassBadgeClassName(
  dc: DataClass | null | undefined,
): string | null {
  if (!dc) return null;
  return DATA_CLASS_BADGE_CLASSES[dc];
}

export type DataClassBadgeClass = {
  className: string;
  label: string;
};

export function dataClassBadgeClass(
  dc: DataClass | null | undefined,
): DataClassBadgeClass | null {
  if (!dc) return null;
  return {
    className: dataClassBadgeClassName(dc) ?? '',
    label: dc,
  };
}

export type DataClassGuidance = {
  dc: DataClass;
  when: string;
};

export const dataClassShortGuidance =
  'Classify by the most sensitive data stored, processed, displayed, or accessed.';

export const dataClassGuidance: readonly DataClassGuidance[] = [
  {
    dc: 'PUBLIC',
    when: 'Everything exposed by the app is intentionally safe for the general public, with no login-only sensitive data.',
  },
  {
    dc: 'INTERNAL',
    when: 'Data is meant for company users or approved partners, but compromise would be low/moderate impact.',
  },
  {
    dc: 'CONFIDENTIAL',
    when: 'App handles customer, business, financial, legal, case/job, user, or non-public operational data.',
  },
  {
    dc: 'RESTRICTED',
    when: 'App handles highly sensitive data where exposure would cause serious harm, regulatory concern, legal exposure, or credential/security compromise.',
  },
] as const;
