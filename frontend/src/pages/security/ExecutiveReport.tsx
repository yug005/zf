import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Clock, Target, FileText, Route, Database,
  Download, TrendingUp, TrendingDown, Minus, AlertTriangle,
  CheckCircle, XCircle, ArrowUp, Wrench, Scale,
  GitBranch, Layers, Filter, ChevronRight, Zap,
} from 'lucide-react';
import {
  securityApi,
  type SecurityAttackPath,
  type ComplianceScore,
  type RemediationItem,
  type HistoricalComparison,
  type SecurityFinding,
} from '../../services/security';
import { RiskScoreGauge } from '../../components/security/ui/RiskScoreGauge';
import { ScanProgressIndicator } from '../../components/security/ui/ScanProgressIndicator';
import { ThreatCard } from '../../components/security/ui/ThreatCard';
import { SecurityEmptyState } from '../../components/security/ui/SecurityEmptyState';
import { SeverityMixChart } from '../../components/security/charts/SeverityMixChart';
import { ScoreTrendChart } from '../../components/security/charts/ScoreTrendChart';
import {
  securityCard, securityCardHover, glassPanel,
  verificationColors, severityColors, complianceColors,
  categoryLabels, categoryIcons,
} from '../../components/security/tokens';
import { PageMeta } from '../../components/PageMeta';

type ReportTab = 'dashboard' | 'findings' | 'attack-paths' | 'assets' | 'remediation' | 'compliance' | 'delta';

const TABS: Array<{ id: ReportTab; label: string; icon: React.ReactNode }> = [
  { id: 'dashboard', label: 'Dashboard', icon: <Layers className="h-3.5 w-3.5" /> },
  { id: 'findings', label: 'Findings', icon: <FileText className="h-3.5 w-3.5" /> },
  { id: 'attack-paths', label: 'Attack Paths', icon: <Route className="h-3.5 w-3.5" /> },
  { id: 'assets', label: 'Assets', icon: <Database className="h-3.5 w-3.5" /> },
  { id: 'remediation', label: 'Remediation', icon: <Wrench className="h-3.5 w-3.5" /> },
  { id: 'compliance', label: 'Compliance', icon: <Scale className="h-3.5 w-3.5" /> },
  { id: 'delta', label: 'Changes', icon: <GitBranch className="h-3.5 w-3.5" /> },
];

export default function ExecutiveReport() {
  const { scanId } = useParams<{ scanId: string }>();
  const [activeTab, setActiveTab] = useState<ReportTab>('dashboard');
  const [severityFilter, setSeverityFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ['security-report', scanId],
    queryFn: () => securityApi.getReport(scanId!),
    enabled: !!scanId,
    refetchInterval: (query) => {
      const data = query.state?.data;
      if (!data) return 5000;
      return data.scan.status === 'RUNNING' || data.scan.status === 'QUEUED' ? 3000 : false;
    },
  });

  if (isLoading || !report) return <ReportSkeleton />;
  if (isError) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-rose-400">Failed to load report.</p>
      </div>
    );
  }

  const {
    scan, target, findings, endpointInventory, trendHistory,
    attackPaths, controlVerdicts, assets, evidenceArtifacts,
    complianceScores, remediationQueue, historicalComparison,
    assetTopology,
  } = report;

  const isComplete = scan.status === 'COMPLETED';
  const isRunning = scan.status === 'RUNNING' || scan.status === 'QUEUED';
  const vColors = verificationColors[target.verificationState] || verificationColors.UNVERIFIED;

  // Filtered findings
  const filteredFindings = findings.filter(f => {
    if (severityFilter && f.severity !== severityFilter) return false;
    if (categoryFilter && f.category !== categoryFilter) return false;
    return true;
  });

  const handleDownload = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeTargetName = target.name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'security-report';
    const payload = {
      exportedAt: new Date().toISOString(),
      scan, target, findings, attackPaths, controlVerdicts, assets,
      endpointInventory, evidenceArtifacts, trendHistory,
      reportMetadata: report.reportMetadata,
      complianceScores, remediationQueue, historicalComparison,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `${safeTargetName}-${scan.id}-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  };

  return (
    <div className="space-y-6">
      <PageMeta
        title={`Report: ${target.name} | Security | Zer0Friction`}
        description={`Executive security report for ${target.name}`}
        noIndex
      />

      {/* ─── Premium Header ─── */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300/70">
            Executive Security Report
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">{target.name}</h2>
          <p className="mt-1 text-xs text-slate-500 font-mono">{target.baseUrl}</p>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            {target.targetKind} • {target.environment} • {target.criticality} criticality
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isComplete && (
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/15 hover:text-cyan-200"
            >
              <Download className="h-3.5 w-3.5" />
              Export Report
            </button>
          )}
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${vColors.bg} ${vColors.text}`}>
            {vColors.label}
          </span>
          {isComplete && (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              {scan.executionMode || scan.tier}
            </span>
          )}
        </div>
      </div>

      {/* ─── In-Progress State ─── */}
      {isRunning && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${securityCard} p-6`}>
          <ScanProgressIndicator currentStage={scan.stage} status={scan.status} stageProgress={scan.stageProgress} />
          <SecurityEmptyState type="scan-in-progress" />
        </motion.div>
      )}

      {/* ─── Tab Navigation ─── */}
      {isComplete && (
        <>
          <div className="flex items-center gap-1 rounded-2xl border border-white/6 bg-white/[0.02] p-1.5 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-white/10 text-white shadow-[0_2px_8px_rgba(0,0,0,0.2)]'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.id === 'findings' && findings.length > 0 && (
                  <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] tabular-nums">{findings.length}</span>
                )}
                {tab.id === 'attack-paths' && attackPaths.length > 0 && (
                  <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] tabular-nums">{attackPaths.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* ─── Tab Content ─── */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && (
                <DashboardTab
                  scan={scan} findings={findings} endpointInventory={endpointInventory}
                  trendHistory={trendHistory} attackPaths={attackPaths} controlVerdicts={controlVerdicts}
                  assets={assets} historicalComparison={historicalComparison}
                />
              )}
              {activeTab === 'findings' && (
                <FindingsTab
                  findings={filteredFindings} allFindings={findings}
                  severityFilter={severityFilter} setSeverityFilter={setSeverityFilter}
                  categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
                />
              )}
              {activeTab === 'attack-paths' && <AttackPathsTab attackPaths={attackPaths} />}
              {activeTab === 'assets' && <AssetsTab assets={assets} topology={assetTopology} />}
              {activeTab === 'remediation' && <RemediationTab queue={remediationQueue || []} />}
              {activeTab === 'compliance' && <ComplianceTab scores={complianceScores || []} />}
              {activeTab === 'delta' && <DeltaTab comparison={historicalComparison} />}
            </motion.div>
          </AnimatePresence>
        </>
      )}

      {/* ─── Failed State ─── */}
      {scan.status === 'FAILED' && (
        <div className={`${securityCard} p-6`}>
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-rose-400/20 bg-rose-400/10">
              <Shield className="h-8 w-8 text-rose-400" />
            </div>
            <p className="text-lg font-semibold text-white">Scan Failed</p>
            <p className="mt-2 text-sm text-slate-400">{scan.errorMessage || 'An unexpected error occurred during the scan.'}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB: Dashboard
// ═══════════════════════════════════════════════════════════════════

function DashboardTab({ scan, findings, endpointInventory, trendHistory, attackPaths, controlVerdicts, assets, historicalComparison }: any) {
  const validatedFindings = findings.filter((f: SecurityFinding) => f.validationState === 'VALIDATED').length;
  const labOnlyFindings = findings.filter((f: SecurityFinding) => f.validationState === 'LAB_ONLY').length;

  return (
    <div className="space-y-6">
      {/* Score + Summary Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`${securityCard} relative overflow-hidden p-6 lg:col-span-5`}>
          <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-gradient-to-bl from-cyan-500/6 to-transparent blur-3xl" />
          <div className="relative flex flex-col items-center">
            <RiskScoreGauge score={scan.score || 0} riskLevel={scan.riskLevel || 'SECURE'} size="lg" />
            {scan.severityCounts && (
              <div className="mt-6 w-full">
                <SeverityMixChart data={scan.severityCounts as any} />
              </div>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-4 lg:col-span-7">
          <div className={`${securityCard} p-5`}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Executive Summary</p>
            <p className="text-sm leading-relaxed text-slate-300">{scan.summary}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ValidationPill label="Validated" value={validatedFindings} tone="emerald" />
              <ValidationPill label="Lab only" value={labOnlyFindings} tone="amber" />
              <ValidationPill label="Attack paths" value={attackPaths.length} tone="cyan" />
              <ValidationPill label="Control verdicts" value={controlVerdicts.length} tone="slate" />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Findings" value={String(findings.length)} icon={<FileText className="h-4 w-4" />} />
            <StatCard label="Endpoints" value={String(endpointInventory?.length || 0)} icon={<Target className="h-4 w-4" />} />
            <StatCard label="Assets" value={String(assets?.length || 0)} icon={<Database className="h-4 w-4" />} />
            <StatCard
              label="Duration"
              value={scan.startedAt && scan.completedAt
                ? `${Math.round((new Date(scan.completedAt).getTime() - new Date(scan.startedAt).getTime()) / 1000)}s`
                : '—'}
              icon={<Clock className="h-4 w-4" />}
            />
          </div>

          {/* Score Trend */}
          {trendHistory && trendHistory.length >= 2 && (
            <div className={`${securityCard} p-5`}>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Score Trend</p>
              <ScoreTrendChart scans={trendHistory} />
            </div>
          )}
        </motion.div>
      </div>

      {/* Historical Delta Summary (if available) */}
      {historicalComparison && !historicalComparison.isFirstScan && (
        <DeltaSummaryCard comparison={historicalComparison} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB: Findings
// ═══════════════════════════════════════════════════════════════════

function FindingsTab({ findings, allFindings, severityFilter, setSeverityFilter, categoryFilter, setCategoryFilter }: {
  findings: SecurityFinding[];
  allFindings: SecurityFinding[];
  severityFilter: string | null;
  setSeverityFilter: (v: string | null) => void;
  categoryFilter: string | null;
  setCategoryFilter: (v: string | null) => void;
}) {
  const categories = [...new Set(allFindings.map(f => f.category))];
  const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'];

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className={`${glassPanel} flex items-center gap-3 p-3 overflow-x-auto`}>
        <Filter className="h-4 w-4 text-slate-500 shrink-0" />
        <div className="flex items-center gap-1.5">
          <FilterChip label="All" active={!severityFilter} onClick={() => setSeverityFilter(null)} />
          {severities.map(s => {
            const count = allFindings.filter(f => f.severity === s).length;
            if (count === 0) return null;
            const colors = severityColors[s] || severityColors.INFORMATIONAL;
            return (
              <FilterChip
                key={s}
                label={`${s} (${count})`}
                active={severityFilter === s}
                onClick={() => setSeverityFilter(severityFilter === s ? null : s)}
                className={severityFilter === s ? `${colors.bg} ${colors.text}` : undefined}
              />
            );
          })}
        </div>
        <div className="mx-2 h-5 w-px bg-white/10" />
        <div className="flex items-center gap-1.5">
          <FilterChip label="All Types" active={!categoryFilter} onClick={() => setCategoryFilter(null)} />
          {categories.slice(0, 6).map(c => (
            <FilterChip
              key={c}
              label={`${categoryIcons[c] || '🔍'} ${categoryLabels[c] || c}`}
              active={categoryFilter === c}
              onClick={() => setCategoryFilter(categoryFilter === c ? null : c)}
            />
          ))}
        </div>
      </div>

      {/* Findings List */}
      {findings.length === 0 ? (
        <SecurityEmptyState type="all-secure" />
      ) : (
        <div className="space-y-3">
          {findings.map((finding, index) => (
            <ThreatCard key={finding.id} finding={finding} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB: Attack Paths
// ═══════════════════════════════════════════════════════════════════

function AttackPathsTab({ attackPaths }: { attackPaths: SecurityAttackPath[] }) {
  if (attackPaths.length === 0) return <SecurityEmptyState type="all-secure" />;

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 leading-relaxed">
        Attack paths show how individual vulnerabilities chain together to create exploitable workflows.
        Focus on the highest-scoring paths first.
      </p>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {attackPaths.map((path, index) => (
          <AttackPathCard key={path.id} path={path} index={index} />
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB: Assets
// ═══════════════════════════════════════════════════════════════════

function AssetsTab({ assets, topology }: { assets: any[]; topology?: any }) {
  if (assets.length === 0) return <SecurityEmptyState type="all-secure" />;

  const nodeRiskColors: Record<string, string> = {
    CRITICAL: 'border-rose-500/40 bg-rose-500/10',
    HIGH: 'border-orange-500/40 bg-orange-500/10',
    MEDIUM: 'border-amber-500/40 bg-amber-500/10',
    LOW: 'border-sky-500/40 bg-sky-500/10',
    SECURE: 'border-emerald-500/40 bg-emerald-500/10',
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 leading-relaxed">
        All discovered assets across your attack surface. Risk levels are derived from associated findings.
      </p>

      {/* Asset Topology Graph (visual) */}
      {topology && topology.nodes.length > 1 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${securityCard} p-6`}>
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Attack Surface Graph</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {topology.nodes.map((node: any, i: number) => {
              const riskColors = nodeRiskColors[node.riskLevel] || nodeRiskColors.SECURE;
              return (
                <motion.div
                  key={node.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.06, type: 'spring', stiffness: 200 }}
                  className={`relative flex flex-col items-center gap-1 rounded-2xl border ${riskColors} px-4 py-3 min-w-[120px]`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">{node.kind}</span>
                  <span className="text-xs font-semibold text-white text-center truncate max-w-[160px]">{node.name}</span>
                  {node.findingCount > 0 && (
                    <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                      {node.findingCount}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
          {topology.edges.length > 0 && (
            <p className="mt-4 text-center text-[10px] text-slate-600">
              {topology.edges.length} relationship{topology.edges.length !== 1 ? 's' : ''} mapped
            </p>
          )}
        </motion.div>
      )}

      {/* Asset List */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {assets.map((asset: any) => (
          <div key={asset.id} className={`${securityCard} ${securityCardHover} p-4`}>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10">
                <Database className="h-4 w-4 text-cyan-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">{asset.name}</p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  {asset.kind} • {asset.environment} • {asset.criticality}
                </p>
                {(asset.hostname || asset.address) && (
                  <p className="mt-1 font-mono text-[11px] text-slate-400 truncate">{asset.hostname || asset.address}</p>
                )}
                {asset.tags && asset.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(asset.tags as string[]).slice(0, 4).map((tag: string) => (
                      <span key={tag} className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB: Remediation
// ═══════════════════════════════════════════════════════════════════

function RemediationTab({ queue }: { queue: RemediationItem[] }) {
  if (queue.length === 0) {
    return (
      <div className="text-center py-16">
        <CheckCircle className="mx-auto h-12 w-12 text-emerald-400/50 mb-4" />
        <p className="text-lg font-semibold text-white">No remediation needed</p>
        <p className="mt-2 text-sm text-slate-500">Your security posture is excellent.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 leading-relaxed">
        Prioritized fix queue ordered by business impact. Focus on items marked "Fix First" for maximum risk reduction.
      </p>
      <div className="space-y-3">
        {queue.map((item, index) => {
          const colors = severityColors[item.severity] || severityColors.INFORMATIONAL;
          return (
            <motion.div
              key={item.findingId}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04 }}
              className={`${securityCard} relative overflow-hidden p-5`}
            >
              {/* Priority number */}
              <div className="absolute left-0 top-0 bottom-0 flex items-center">
                <span className={`flex h-full w-10 items-center justify-center text-lg font-bold ${colors.text} opacity-30`}>
                  {index + 1}
                </span>
              </div>

              <div className="pl-10">
                <div className="flex items-center gap-2 mb-2">
                  {item.isFixFirst && (
                    <span className="flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-rose-400">
                      <Zap className="h-3 w-3" /> Fix First
                    </span>
                  )}
                  {item.isValidated && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300">
                      Validated
                    </span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${colors.bg} ${colors.text}`}>
                    {item.severity}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                    {categoryLabels[item.category] || item.category}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">{item.title}</h4>
                {item.endpoint && (
                  <p className="text-xs font-mono text-slate-500 mb-2">{item.endpoint}</p>
                )}
                <p className="text-xs text-emerald-300/80 leading-relaxed">{item.remediation}</p>
                <div className="mt-3 flex items-center gap-3">
                  <span className="text-[10px] text-slate-600">
                    Priority: <span className="text-slate-400 font-bold tabular-nums">{item.priorityScore}</span>
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB: Compliance
// ═══════════════════════════════════════════════════════════════════

function ComplianceTab({ scores }: { scores: ComplianceScore[] }) {
  const [expandedFramework, setExpandedFramework] = useState<string | null>(null);

  if (scores.length === 0) {
    return (
      <div className="text-center py-16">
        <Scale className="mx-auto h-12 w-12 text-slate-600 mb-4" />
        <p className="text-lg font-semibold text-white">No compliance data</p>
        <p className="mt-2 text-sm text-slate-500">Run a scan to generate compliance mappings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500 leading-relaxed">
        Automated mapping of findings to industry compliance frameworks. Scores reflect control coverage.
      </p>

      {/* Framework Score Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {scores.map((score, index) => {
          const colors = complianceColors[score.framework] || complianceColors.SOC2;
          return (
            <motion.button
              key={score.framework}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              onClick={() => setExpandedFramework(expandedFramework === score.framework ? null : score.framework)}
              className={`${securityCard} ${securityCardHover} p-5 text-center ${
                expandedFramework === score.framework ? 'ring-1 ring-white/20' : ''
              }`}
            >
              <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${colors.text} mb-2`}>
                {colors.label}
              </p>
              <p className="text-3xl font-bold text-white tabular-nums">{score.score}%</p>
              <div className="mt-3 flex items-center justify-center gap-3 text-[10px]">
                <span className="text-emerald-400">{score.passedControls} pass</span>
                {score.failedControls > 0 && <span className="text-rose-400">{score.failedControls} fail</span>}
                {score.partialControls > 0 && <span className="text-amber-400">{score.partialControls} partial</span>}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Expanded Control Details */}
      <AnimatePresence>
        {expandedFramework && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {scores.filter(s => s.framework === expandedFramework).map(score => (
              <div key={score.framework} className={`${securityCard} p-5 space-y-2`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 mb-3">
                  {complianceColors[score.framework]?.label || score.framework} — Control Details
                </p>
                {score.controlDetails.map(control => {
                  const statusColors = control.status === 'PASS'
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : control.status === 'FAIL'
                      ? 'text-rose-400 bg-rose-500/10'
                      : control.status === 'PARTIAL'
                        ? 'text-amber-400 bg-amber-500/10'
                        : 'text-slate-400 bg-white/5';
                  return (
                    <div key={control.controlId} className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/[0.02] px-4 py-3">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${statusColors}`}>
                        {control.status === 'PASS' ? <CheckCircle className="h-3.5 w-3.5" /> :
                         control.status === 'FAIL' ? <XCircle className="h-3.5 w-3.5" /> :
                         <AlertTriangle className="h-3.5 w-3.5" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white">{control.controlId}: {control.controlTitle}</p>
                      </div>
                      {control.relatedFindings > 0 && (
                        <span className="text-[10px] text-slate-500">{control.relatedFindings} finding{control.relatedFindings !== 1 ? 's' : ''}</span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusColors}`}>
                        {control.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB: Delta (Historical Comparison)
// ═══════════════════════════════════════════════════════════════════

function DeltaTab({ comparison }: { comparison?: HistoricalComparison | null }) {
  if (!comparison || comparison.isFirstScan) {
    return (
      <div className="text-center py-16">
        <GitBranch className="mx-auto h-12 w-12 text-slate-600 mb-4" />
        <p className="text-lg font-semibold text-white">First Scan</p>
        <p className="mt-2 text-sm text-slate-500">No previous scan to compare against. Changes will appear after the next scan.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DeltaSummaryCard comparison={comparison} />

      {/* Regressions (most critical) */}
      {comparison.regressions && comparison.regressions.length > 0 && (
        <DeltaSection
          title="⚠️ Regressions (Previously Fixed)"
          items={comparison.regressions}
          tone="rose"
          icon={<AlertTriangle className="h-4 w-4 text-rose-400" />}
        />
      )}

      {/* New Findings */}
      {comparison.newFindings && comparison.newFindings.length > 0 && (
        <DeltaSection
          title="New Findings"
          items={comparison.newFindings}
          tone="amber"
          icon={<ArrowUp className="h-4 w-4 text-amber-400" />}
        />
      )}

      {/* Resolved Findings */}
      {comparison.resolvedFindings && comparison.resolvedFindings.length > 0 && (
        <DeltaSection
          title="Resolved Findings"
          items={comparison.resolvedFindings}
          tone="emerald"
          icon={<CheckCircle className="h-4 w-4 text-emerald-400" />}
        />
      )}

      {/* Escalated */}
      {comparison.escalatedFindings && comparison.escalatedFindings.length > 0 && (
        <div className={`${securityCard} p-5`}>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
            Severity Escalated ({comparison.escalatedFindings.length})
          </p>
          <div className="space-y-2">
            {comparison.escalatedFindings.map((item: any) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/[0.02] px-4 py-2.5">
                <ArrowUp className="h-4 w-4 text-rose-400 shrink-0" />
                <p className="text-xs text-white flex-1 truncate">{item.title}</p>
                <span className="text-[10px] text-slate-500">{item.from} → {item.to}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Shared Components
// ═══════════════════════════════════════════════════════════════════

function DeltaSummaryCard({ comparison }: { comparison: HistoricalComparison }) {
  const delta = comparison.scoreDelta;
  const isImproved = delta !== undefined && delta !== null && delta < 0;
  const isWorse = delta !== undefined && delta !== null && delta > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={`${securityCard} p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500 mb-2">Since Last Scan</p>
          <p className="text-sm text-slate-300 leading-relaxed">{comparison.summary}</p>
        </div>
        {delta !== null && delta !== undefined && (
          <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2 ${
            isImproved ? 'bg-emerald-500/10' : isWorse ? 'bg-rose-500/10' : 'bg-white/5'
          }`}>
            {isImproved ? <TrendingDown className="h-4 w-4 text-emerald-400" /> :
             isWorse ? <TrendingUp className="h-4 w-4 text-rose-400" /> :
             <Minus className="h-4 w-4 text-slate-400" />}
            <span className={`text-sm font-bold tabular-nums ${
              isImproved ? 'text-emerald-400' : isWorse ? 'text-rose-400' : 'text-slate-400'
            }`}>
              {isWorse ? '+' : ''}{delta}
            </span>
          </div>
        )}
      </div>

      {comparison.severityDelta && (
        <div className="mt-4 flex items-center gap-4">
          {Object.entries(comparison.severityDelta).map(([severity, count]) => {
            if (count === 0) return null;
            const isPositive = count > 0;
            return (
              <span
                key={severity}
                className={`text-[10px] font-bold uppercase tracking-[0.12em] ${
                  isPositive ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {severity}: {isPositive ? `+${count}` : count}
              </span>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function DeltaSection({ title, items, tone, icon }: {
  title: string;
  items: Array<{ id: string; title: string; severity: string; category: string }>;
  tone: 'rose' | 'amber' | 'emerald';
  icon: React.ReactNode;
}) {
  const borderColor = tone === 'rose' ? 'border-rose-500/20' : tone === 'amber' ? 'border-amber-500/20' : 'border-emerald-500/20';
  return (
    <div className={`${securityCard} p-5`}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">{title} ({items.length})</p>
      </div>
      <div className="space-y-2">
        {items.map(item => {
          const colors = severityColors[item.severity] || severityColors.INFORMATIONAL;
          return (
            <div key={item.id} className={`flex items-center gap-3 rounded-xl border ${borderColor} bg-white/[0.02] px-4 py-2.5`}>
              <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
              <p className="text-xs text-white flex-1 truncate">{item.title}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${colors.bg} ${colors.text}`}>
                {item.severity}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AttackPathCard({ path, index }: { path: SecurityAttackPath; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`${securityCard} ${securityCardHover} overflow-hidden`}
    >
      <button onClick={() => setExpanded(!expanded)} className="w-full p-5 text-left">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Route className="h-4 w-4 text-cyan-300 shrink-0" />
              <p className="text-sm font-semibold text-white truncate">{path.title}</p>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">{path.summary}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-300">
              Score {path.score}
            </span>
            <ChevronRight className={`h-4 w-4 text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && path.pathNodes && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/6 px-5 py-4 space-y-2">
              {(path.pathNodes as any[]).map((node: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/6 text-[10px] font-bold text-cyan-400">
                    {i + 1}
                  </span>
                  <p className="text-xs text-slate-300">{node.title || node.name || 'Step'}</p>
                  {node.severity && (
                    <span className={`text-[10px] font-bold ${severityColors[node.severity]?.text || 'text-slate-500'}`}>
                      {node.severity}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {path.techniqueChain && path.techniqueChain.length > 0 && (
        <div className="border-t border-white/6 px-5 py-3 flex flex-wrap gap-1.5">
          {path.techniqueChain.slice(0, 5).map((technique, i) => (
            <span key={`${path.id}-${i}`} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-mono text-slate-300">
              {technique}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function ValidationPill({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'amber' | 'cyan' | 'slate' }) {
  const toneClass = tone === 'emerald'
    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
    : tone === 'amber'
      ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
      : tone === 'cyan'
        ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'
        : 'bg-white/5 text-slate-300 border-white/10';
  return (
    <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] ${toneClass}`}>
      {label}: {value}
    </span>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`${securityCard} flex flex-col items-center p-4`}
    >
      <span className="mb-1 text-slate-600">{icon}</span>
      <span className="tabular-nums text-lg font-bold text-white">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">{label}</span>
    </motion.div>
  );
}

function FilterChip({ label, active, onClick, className }: {
  label: string; active: boolean; onClick: () => void; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] transition-all ${
        className || (active
          ? 'bg-white/12 text-white'
          : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]')
      }`}
    >
      {label}
    </button>
  );
}



function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-3 w-48 animate-pulse rounded bg-white/10" />
        <div className="mt-2 h-6 w-64 animate-pulse rounded bg-white/10" />
      </div>
      <div className="h-12 animate-pulse rounded-2xl bg-white/5" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className={`${securityCard} h-80 animate-pulse lg:col-span-5`} />
        <div className="space-y-4 lg:col-span-7">
          <div className={`${securityCard} h-28 animate-pulse`} />
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`${securityCard} h-24 animate-pulse`} />
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`${securityCard} h-20 animate-pulse`} />
        ))}
      </div>
    </div>
  );
}
