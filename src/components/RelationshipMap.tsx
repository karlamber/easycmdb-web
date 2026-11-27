import { cn } from '@/lib/utils';

type Tone = 'landscape' | 'account' | 'resource' | 'application';

type MapNode = {
  id: string;
  /** Centre of the node, as a percentage of the map's width and height. */
  x: number;
  y: number;
  tone: Tone;
  kicker: string;
  label: string;
};

const NODES: readonly MapNode[] = [
  {
    id: 'hub',
    x: 50,
    y: 40,
    tone: 'landscape',
    kicker: 'Landscape',
    label: 'platform',
  },
  {
    id: 'dev',
    x: 22,
    y: 16,
    tone: 'account',
    kicker: 'Account · dev',
    label: 'aws-dev',
  },
  {
    id: 'prod',
    x: 78,
    y: 16,
    tone: 'account',
    kicker: 'Account · prod',
    label: 'aws-prod',
  },
  {
    id: 'cdn',
    x: 16,
    y: 58,
    tone: 'resource',
    kicker: 'cloudfront',
    label: 'web',
  },
  { id: 'db', x: 38, y: 66, tone: 'resource', kicker: 'rds', label: 'db' },
  {
    id: 'fn-dev',
    x: 62,
    y: 66,
    tone: 'resource',
    kicker: 'lambda · dev',
    label: 'api',
  },
  {
    id: 'fn-prod',
    x: 84,
    y: 58,
    tone: 'resource',
    kicker: 'lambda · prod',
    label: 'api',
  },
  {
    id: 'app',
    x: 50,
    y: 92,
    tone: 'application',
    kicker: 'Application',
    label: 'storefront',
  },
];

const EDGES: readonly (readonly [string, string, Tone])[] = [
  ['hub', 'dev', 'landscape'],
  ['hub', 'prod', 'landscape'],
  ['dev', 'cdn', 'account'],
  ['dev', 'db', 'account'],
  ['dev', 'fn-dev', 'account'],
  ['prod', 'fn-prod', 'account'],
  ['app', 'db', 'application'],
  ['app', 'fn-dev', 'application'],
  ['app', 'fn-prod', 'application'],
];

const EDGE_COLOR: Record<Tone, string> = {
  landscape: '#34d399',
  account: '#a78bfa',
  resource: '#fb923c',
  application: '#60a5fa',
};

const NODE_CLASS: Record<Tone, string> = {
  landscape: 'border-emerald-400 bg-emerald-950',
  account: 'border-violet-400 bg-indigo-950',
  resource: 'border-orange-400 bg-orange-950',
  application: 'border-blue-400 bg-blue-950',
};

const KICKER_CLASS: Record<Tone, string> = {
  landscape: 'text-emerald-300',
  account: 'text-violet-300',
  resource: 'text-orange-300',
  application: 'text-blue-300',
};

const nodeById = new Map(NODES.map((n) => [n.id, n]));

/**
 * Decorative map for the sign-in page: a landscape, its provider accounts,
 * their resources and the application that owns them, with links animating
 * between them. Generic labels, because nothing can be loaded before sign-in.
 */
export function RelationshipMap({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('relative aspect-[6/5] w-full max-w-[640px]', className)}
    >
      <svg
        className="absolute inset-0 size-full overflow-visible"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        {EDGES.map(([from, to, tone]) => {
          const a = nodeById.get(from);
          const b = nodeById.get(to);
          if (!a || !b) return null;
          return (
            <line
              key={`${from}-${to}`}
              className="animate-edge-flow [stroke-dasharray:4_8] motion-reduce:animate-none"
              stroke={EDGE_COLOR[tone]}
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              x1={a.x}
              x2={b.x}
              y1={a.y}
              y2={b.y}
            />
          );
        })}
      </svg>

      {NODES.map((node) => (
        <div
          key={node.id}
          className={cn(
            'absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-px rounded-[10px] border px-3 py-2 whitespace-nowrap',
            NODE_CLASS[node.tone],
            node.id === 'hub' &&
              'animate-hub-pulse rounded-xl border-[1.5px] px-[18px] py-3 motion-reduce:animate-none',
          )}
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
        >
          <span
            className={cn(
              'text-[10px] font-semibold tracking-[0.08em] uppercase',
              KICKER_CLASS[node.tone],
            )}
          >
            {node.kicker}
          </span>
          <span
            className={cn(
              'font-medium text-white',
              node.id === 'hub' ? 'text-lg' : 'text-sm',
            )}
          >
            {node.label}
          </span>
        </div>
      ))}
    </div>
  );
}
