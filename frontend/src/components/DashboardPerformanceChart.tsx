import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

interface MonitorChartDatum {
  id: string;
  name: string;
  status: 'UP' | 'DOWN' | 'DEGRADED' | 'PAUSED';
  avgResponseTimeMs?: number | null;
}

export function DashboardPerformanceChart({ monitors }: { monitors: MonitorChartDatum[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={monitors}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 12, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => `${value}ms`}
            width={60}
          />
          <Tooltip
            cursor={{ fill: '#f1f5f9' }}
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            formatter={(value) => [`${value ?? 0}ms`, 'Avg Response']}
          />
          <Bar dataKey="avgResponseTimeMs" radius={[4, 4, 0, 0]}>
            {monitors.map((monitor, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  monitor.status === 'UP'
                    ? '#10b981'
                    : monitor.status === 'DEGRADED'
                      ? '#f59e0b'
                      : '#ef4444'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default DashboardPerformanceChart;
