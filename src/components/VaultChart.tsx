import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const PALETTE = [
  '#3b82f6','#10b981','#8b5cf6','#f59e0b','#ef4444',
  '#06b6d4','#f97316','#ec4899','#84cc16','#6366f1',
];

const TT = {
  contentStyle: {
    background: '#0f1828',
    border: '1px solid #1b2e4a',
    borderRadius: 8,
    fontSize: '0.7rem',
    color: '#eef2ff',
    padding: '6px 10px',
  },
  labelStyle: { color: '#8ba4c8', marginBottom: 2 },
};

function fmt(v: unknown): string {
  if (typeof v !== 'number') return String(v ?? '');
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v % 1 === 0 ? String(v) : v.toFixed(2);
}

const AXIS = { fontSize: 10, fill: '#4d6a8a' };
const GRID = { strokeDasharray: '3 3', stroke: '#1b2e4a' };

interface Props {
  data: Record<string, unknown>[];
  chartType: string;
  height?: number;
}

export default function VaultChart({ data, chartType, height = 260 }: Props) {
  // ── guard: no data ──────────────────────────────────────────────────────────
  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t4)', fontFamily: 'var(--mono)', fontSize: '0.72rem' }}>
        No data to display
      </div>
    );
  }

  const keys = Object.keys(data[0]);
  const numKeys = keys.filter(k => typeof data[0][k] === 'number');
  const strKey = keys.find(k => typeof data[0][k] === 'string') || keys[0];
  const valKey = numKeys[0] || keys[1] || keys[0];
  const labelKey = data[0].label ? 'label' : data[0].month ? 'month' : strKey;

  // ── PIE ────────────────────────────────────────────────────────────────────
  if (chartType === 'pie' || chartType === 'donut') {
    return (
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey={valKey}
              nameKey={strKey}
              cx="50%"
              cy="50%"
              innerRadius={chartType === 'donut' ? height * 0.22 : 0}
              outerRadius={height * 0.34}
              paddingAngle={2}
              label={({ name, percent }: { name?: unknown; percent?: number }) =>
                (percent ?? 0) > 0.04 ? `${String(name ?? '').slice(0, 10)} ${((percent ?? 0) * 100).toFixed(0)}%` : ''
              }
              labelLine={{ stroke: '#2d4560', strokeWidth: 1 }}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip {...TT} formatter={(v: unknown) => [fmt(v), '']} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── LINE / AREA ────────────────────────────────────────────────────────────
  if (chartType === 'line' || chartType === 'area' || chartType === 'trend') {
    const isArea = chartType === 'area';
    const ChartComp = isArea ? AreaChart : LineChart;
    return (
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ChartComp data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey={labelKey} tick={AXIS} tickLine={false} />
            <YAxis tickFormatter={fmt} tick={AXIS} tickLine={false} width={44} />
            <Tooltip {...TT} formatter={(v: unknown) => [fmt(v), '']} />
            {numKeys.slice(0, 3).map((k, i) =>
              isArea ? (
                <Area key={k} type="monotone" dataKey={k} stroke={PALETTE[i]} fill={PALETTE[i] + '22'} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              ) : (
                <Line key={k} type="monotone" dataKey={k} stroke={PALETTE[i]} strokeWidth={2} dot={{ r: 3, fill: PALETTE[i] }} activeDot={{ r: 5 }} />
              )
            )}
            {numKeys.length > 1 && <Legend wrapperStyle={{ fontSize: '0.68rem', color: '#4d6a8a' }} />}
          </ChartComp>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── SCATTER ────────────────────────────────────────────────────────────────
  if (chartType === 'scatter' || chartType === 'correlation') {
    const xKey = numKeys[0] || keys[0];
    const yKey = numKeys[1] || numKeys[0] || keys[1];
    return (
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey={xKey} type="number" tickFormatter={fmt} tick={AXIS} tickLine={false} name={xKey} />
            <YAxis dataKey={yKey} type="number" tickFormatter={fmt} tick={AXIS} tickLine={false} width={44} name={yKey} />
            <Tooltip {...TT} cursor={{ strokeDasharray: '3 3' }} formatter={(v: unknown) => [fmt(v), '']} />
            <Scatter data={data} fill={PALETTE[0]} opacity={0.7} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // ── BAR (default) ──────────────────────────────────────────────────────────
  const isHoriz = data.length > 8;
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={isHoriz ? 'vertical' : 'horizontal'}
          margin={{ top: 8, right: 16, left: isHoriz ? 80 : 0, bottom: isHoriz ? 8 : 24 }}
        >
          <CartesianGrid {...GRID} />
          {isHoriz ? (
            <>
              <XAxis type="number" tickFormatter={fmt} tick={AXIS} tickLine={false} />
              <YAxis type="category" dataKey={strKey} tick={{ ...AXIS, fontSize: 9 }} tickLine={false} width={76} />
            </>
          ) : (
            <>
              <XAxis dataKey={strKey} tick={{ ...AXIS, fontSize: 9 }} tickLine={false} angle={data.length > 5 ? -25 : 0} textAnchor={data.length > 5 ? 'end' : 'middle'} height={data.length > 5 ? 48 : 28} />
              <YAxis tickFormatter={fmt} tick={AXIS} tickLine={false} width={44} />
            </>
          )}
          <Tooltip {...TT} formatter={(v: unknown) => [fmt(v), '']} />
          {numKeys.slice(0, 3).map((k, i) => (
            <Bar key={k} dataKey={k} fill={PALETTE[i]} radius={isHoriz ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={40}>
              {i === 0 && data.map((_, j) => (
                <Cell key={j} fill={PALETTE[j % PALETTE.length]} />
              ))}
            </Bar>
          ))}
          {numKeys.length > 1 && <Legend wrapperStyle={{ fontSize: '0.68rem', color: '#4d6a8a' }} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
