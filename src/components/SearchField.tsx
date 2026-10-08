import { Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { cn } from '@/lib/utils';

import { coerceSearchInputModelValue } from '@/utils/form';

type SearchFieldProps = {
  id?: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function SearchField({
  id = 'search',
  label,
  placeholder,
  value,
  onChange,
  className,
}: SearchFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} className="text-sm text-slate-600">
        {label}
      </Label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          className="pr-9 pl-9"
          onChange={(e) =>
            onChange(coerceSearchInputModelValue(e.target.value))
          }
        />
        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
            aria-label="Clear search"
            onClick={() => onChange('')}
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
