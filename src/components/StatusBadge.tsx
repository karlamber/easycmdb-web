import { Badge } from '@/components/ui/badge';

import { cn } from '@/lib/utils';

import {
  complianceBadgeClass,
  type ComplianceBadgeClass,
} from '@/utils/compliance';
import {
  dataClassBadgeClass,
  type DataClassBadgeClass,
} from '@/utils/data-class';

import type { ComplianceTag, DataClass } from '@/types/cmdb';

const badgeBase =
  'border font-medium tracking-wide uppercase text-[11px] px-2 py-0.5';

export function DataClassBadge({
  value,
  className,
}: {
  value: DataClass | null | undefined;
  className?: string;
}) {
  const props: DataClassBadgeClass | null = dataClassBadgeClass(value);
  if (!props) return <span className="text-slate-400">—</span>;
  return (
    <Badge
      variant="outline"
      className={cn(badgeBase, props.className, className)}
    >
      {props.label}
    </Badge>
  );
}

export function ComplianceBadge({
  tag,
  className,
}: {
  tag: ComplianceTag;
  className?: string;
}) {
  const props: ComplianceBadgeClass = complianceBadgeClass(tag);
  return (
    <Badge
      variant="outline"
      className={cn(badgeBase, props.className, className)}
    >
      {props.label}
    </Badge>
  );
}

export function ComplianceBadgeList({
  tags,
  className,
}: {
  tags: readonly ComplianceTag[];
  className?: string;
}) {
  if (tags.length === 0) return <span className="text-slate-400">—</span>;
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {tags.map((tag) => (
        <ComplianceBadge key={tag} tag={tag} />
      ))}
    </div>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        badgeBase,
        active
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-slate-100 text-slate-600 border-slate-200',
      )}
    >
      {active ? 'Yes' : 'No'}
    </Badge>
  );
}

export function HostingProviderBadge({ provider }: { provider: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        badgeBase,
        'bg-teal-50 text-teal-800 border-teal-200 normal-case text-xs',
      )}
    >
      {provider}
    </Badge>
  );
}
