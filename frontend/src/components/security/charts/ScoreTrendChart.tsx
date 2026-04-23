import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import type { SecurityScan } from '../../../services/security';

interface ScoreTrendChartProps {
  scans: SecurityScan[];
}

export function ScoreTrendChart({ scans }: ScoreTrendChartProps) {
  const data = [...scans]
    .filter((s) => s.score !== undefined && s.score !== null)
    .reverse()
    .map((s) => ({
      date: new Date(s.completedAt || s.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      score: s.score!,
      riskLevel: s.riskLevel,
    }));

  if (data.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-500">
        Trend data requires at least 2 completed scans
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="h-48"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 10 }}
          />
          <YAxis
            domain={[0, 100]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#64748b', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '8px 12px',
              fontSize: '12px',
              color: '#e2e8f0',
            }}
            formatter={(value: number) => [`${value.toFixed(1)}`, 'Risk Score']}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="#22d3ee"
            strokeWidth={2}
            fill="url(#scoreFill)"
            animationDuration={1200}
          />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
