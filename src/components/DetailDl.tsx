import { ExternalLink } from 'lucide-react';

import {
  ActiveBadge,
  ComplianceBadgeList,
  DataClassBadge,
} from '@/components/StatusBadge';

import { cn } from '@/lib/utils';

import type { ComplianceTag, DataClass } from '@/types/cmdb';

export type DetailItem = {
  label: string;
  value: unknown;
  type?: 'url' | 'badge' | 'boolean' | 'compliance';
};

type DetailDlProps = {
  items: DetailItem[];
  className?: string;
};

function renderValue(item: DetailItem): React.ReactNode {
  const { value, type } = item;

  if (type === 'compliance') {
    return <ComplianceBadgeList tags={value as ComplianceTag[]} />;
  }

  if (value == null || value === '') {
    return <span className="text-slate-400">—</span>;
  }

  if (type === 'badge') {
    return <DataClassBadge value={value as DataClass | null} />;
  }

  if (type === 'boolean') {
    return <ActiveBadge active={Boolean(value)} />;
  }

  if (type === 'url') {
    const href = String(value);
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900 hover:underline break-all"
      >
        {href}
        <ExternalLink className="size-3.5 shrink-0" />
      </a>
    );
  }

  return <span className="break-words">{String(value)}</span>;
}

export function DetailDl({ items, className }: DetailDlProps) {
  return (
    <dl className={cn('divide-y divide-slate-100', className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="grid gap-1 py-3 sm:grid-cols-[minmax(0,200px)_1fr] sm:gap-4"
        >
          <dt className="text-sm font-medium text-slate-600">{item.label}</dt>
          <dd className="text-sm text-slate-900">{renderValue(item)}</dd>
        </div>
      ))}
    </dl>
  );
}
