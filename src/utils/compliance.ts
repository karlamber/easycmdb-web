import type { ComplianceTag } from '@/types/cmdb';

/**
 * Canonical compliance tag list. Must stay in sync with the API's
 * `argus-api-lambda/src/domain/compliance.ts` — the API rejects unknown
 * tags with 400, so any drift is caught at write time but it is still the
 * UI's job to only offer values the API will accept.
 *
 * Order here is the order surfaced in pickers / badge lists. Grouped so the
 * dropdown reads like a quick reference rather than alphabet soup.
 */
export const COMPLIANCE_TAGS: readonly ComplianceTag[] = [
  // General privacy
  'PII',
  'PHI',
  // Confidentiality agreements
  'SEALED',
  'NDA',
  // US regulatory frameworks
  'HIPAA',
  'CJIS',
  'CMMC',
  'CCPA',
  'SOC2',
  // EU privacy
  'GDPR',
] as const;

export type ComplianceBadgeProps = {
  color: string;
  textColor?: string;
  label: string;
};

/**
 * Human-readable label for badges/pickers. The wire format is a SCREAMING
 * SNAKE token; this is what the user reads.
 */
const COMPLIANCE_LABELS: Record<ComplianceTag, string> = {
  PII: 'PII',
  PHI: 'PHI',
  SEALED: 'Sealed',
  NDA: 'NDA',
  HIPAA: 'HIPAA',
  CJIS: 'CJIS',
  CMMC: 'CMMC',
  CCPA: 'CCPA',
  SOC2: 'SOC 2',
  GDPR: 'GDPR',
};

/**
 * Stable badge palette per tag. Grouped conceptually so the badge row reads
 * as a category map rather than rainbow confetti.
 */
const COMPLIANCE_COLORS: Record<ComplianceTag, string> = {
  PII: 'teal',
  PHI: 'teal',
  SEALED: 'indigo',
  NDA: 'indigo',
  HIPAA: 'deep-orange',
  CJIS: 'deep-orange',
  CMMC: 'deep-orange',
  CCPA: 'purple',
  GDPR: 'purple',
  SOC2: 'blue-grey',
};

const COMPLIANCE_BADGE_CLASSES: Record<ComplianceTag, string> = {
  PII: 'bg-teal-100 text-teal-800 border-teal-200',
  PHI: 'bg-teal-100 text-teal-800 border-teal-200',
  SEALED: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  NDA: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  HIPAA: 'bg-orange-100 text-orange-800 border-orange-200',
  CJIS: 'bg-orange-100 text-orange-800 border-orange-200',
  CMMC: 'bg-orange-100 text-orange-800 border-orange-200',
  CCPA: 'bg-purple-100 text-purple-800 border-purple-200',
  GDPR: 'bg-purple-100 text-purple-800 border-purple-200',
  SOC2: 'bg-slate-200 text-slate-700 border-slate-300',
};

export function complianceLabel(tag: ComplianceTag): string {
  return COMPLIANCE_LABELS[tag];
}

export function complianceBadgeProps(tag: ComplianceTag): ComplianceBadgeProps {
  return { color: COMPLIANCE_COLORS[tag], label: complianceLabel(tag) };
}

export function complianceBadgeClassName(tag: ComplianceTag): string {
  return COMPLIANCE_BADGE_CLASSES[tag];
}

export type ComplianceBadgeClass = {
  className: string;
  label: string;
};

export function complianceBadgeClass(tag: ComplianceTag): ComplianceBadgeClass {
  return {
    className: complianceBadgeClassName(tag),
    label: complianceLabel(tag),
  };
}

/** Sort a tag list into the canonical display order (matches COMPLIANCE_TAGS). */
export function sortCompliance(
  tags: readonly ComplianceTag[],
): ComplianceTag[] {
  const rank = new Map<ComplianceTag, number>(
    COMPLIANCE_TAGS.map((t, i) => [t, i]),
  );
  return [...tags].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
}

export type ComplianceGuidance = {
  tag: ComplianceTag;
  /** One sentence on when to apply this tag. Surfaced in the editor popup. */
  when: string;
};

export const complianceShortGuidance =
  'Tag every framework or confidentiality category that constrains the data this application stores, processes, or transmits. Apply multiple when they stack.';

export const complianceGuidance: readonly ComplianceGuidance[] = [
  {
    tag: 'PII',
    when: 'App handles names, contact info, identifiers, or other personal data linkable to an individual.',
  },
  {
    tag: 'PHI',
    when: 'App handles protected health information subject to healthcare privacy rules.',
  },
  {
    tag: 'SEALED',
    when: 'App contains material under a seal or protective order limiting access.',
  },
  {
    tag: 'NDA',
    when: 'App stores material covered by a non-disclosure or confidentiality agreement.',
  },
  {
    tag: 'HIPAA',
    when: 'App is in HIPAA scope as a covered entity, business associate, or subcontractor handling PHI.',
  },
  {
    tag: 'CJIS',
    when: 'App handles Criminal Justice Information (criminal-case data, law-enforcement records) and must meet CJIS Security Policy.',
  },
  {
    tag: 'CMMC',
    when: 'App supports DoD or federal-contractor work subject to the Cybersecurity Maturity Model Certification.',
  },
  {
    tag: 'CCPA',
    when: 'App processes personal data of California residents and is subject to CCPA/CPRA obligations.',
  },
  {
    tag: 'SOC2',
    when: 'App is in scope for a SOC 2 audit (security, availability, confidentiality, etc.).',
  },
  {
    tag: 'GDPR',
    when: 'App processes personal data of people in the EU/EEA or UK and is subject to GDPR/UK-GDPR.',
  },
] as const;
