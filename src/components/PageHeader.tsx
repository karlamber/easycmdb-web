import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';

type PageHeaderProps = {
  title: string;
  countLabel?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  children?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  countLabel,
  onRefresh,
  refreshing = false,
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6 space-y-4', className)}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {countLabel ? (
            <span className="text-sm text-slate-500">{countLabel}</span>
          ) : null}
          {onRefresh ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh"
            >
              <RefreshCw
                className={cn('size-4', refreshing && 'animate-spin')}
              />
            </Button>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
