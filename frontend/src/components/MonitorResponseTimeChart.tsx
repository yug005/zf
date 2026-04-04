import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface CheckResultChartPoint {
  id: string;
  status: 'SUCCESS' | 'FAILURE' | 'TIMEOUT' | 'ERROR';
  responseTimeMs: number | null;
  checkedAt: string;
}

export default function MonitorResponseTimeChart({ checks }: { checks: CheckResultChartPoint[] }) {
  const displayData = [...checks]
    .slice(0, 30)
    .reverse()
    .map((check) => ({
      time: new Date(check.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      response: check.responseTimeMs || 0,
      status: check.status,
    }));

  if (displayData.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-[24px] border border-white/8 bg-white/[0.03] text-sm text-slate-400">
        No data available yet.
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={displayData}>
          <defs>
            <linearGradient id="monitorResponseFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 12, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            minTickGap={20}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => `${value}ms`}
            width={60}
          />
          <Tooltip
            contentStyle={{
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(4,8,22,0.96)',
              color: '#e2e8f0',
              boxShadow: '0 18px 60px rgba(0,0,0,0.35)',
            }}
            formatter={(value) => [`${value ?? 0} ms`, 'Response Time']}
          />
          <Area
            type="monotone"
            dataKey="response"
            stroke="#22d3ee"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#monitorResponseFill)"
            activeDot={{ r: 6, fill: '#22d3ee', stroke: '#020617', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
