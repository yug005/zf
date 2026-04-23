import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { motion } from 'framer-motion';

interface SeverityMixChartProps {
  data: { critical: number; high: number; medium: number; low: number; informational: number };
}

const SEVERITY_COLORS: Record<string, string> = {
  Critical: '#f43f5e',
  High: '#f97316',
  Medium: '#f59e0b',
  Low: '#38bdf8',
  Informational: '#64748b',
};

export function SeverityMixChart({ data }: SeverityMixChartProps) {
  const chartData = [
    { name: 'Critical', value: data.critical, color: SEVERITY_COLORS.Critical },
    { name: 'High', value: data.high, color: SEVERITY_COLORS.High },
    { name: 'Medium', value: data.medium, color: SEVERITY_COLORS.Medium },
    { name: 'Low', value: data.low, color: SEVERITY_COLORS.Low },
    { name: 'Informational', value: data.informational, color: SEVERITY_COLORS.Informational },
  ].filter((d) => d.value > 0);

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-500">
        No findings
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="flex items-center gap-6"
    >
      <div className="h-40 w-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={65}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
              animationBegin={200}
              animationDuration={800}
            >
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '8px 12px',
                fontSize: '12px',
                color: '#e2e8f0',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2">
        {chartData.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-xs text-slate-400">{d.name}</span>
            <span className="text-xs font-bold text-white">{d.value}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
