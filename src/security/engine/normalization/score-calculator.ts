/**
 * Risk score calculation tuned for evidence-backed validation.
 */

const SEVERITY_WEIGHTS: Record<string, number> = {
  CRITICAL: 10,
  HIGH: 7,
  MEDIUM: 4,
  LOW: 2,
  INFORMATIONAL: 0.5,
};

const EXPLOITABILITY_WEIGHTS: Record<string, number> = {
  PROVEN: 1.0,
  PROBABLE: 0.7,
  THEORETICAL: 0.3,
};

export function calculateScore(
  findings: Array<{
    severity: string;
    exploitability: string;
    confidence?: string;
    validationState?: string;
  }>,
  context?: {
    attackPathScores?: number[];
    controlFailures?: number;
  },
): number {
  if (findings.length === 0 && !(context?.attackPathScores?.length || context?.controlFailures)) {
    return 0;
  }

  let totalWeight = 0;
  let maxWeight = 0;

  for (const finding of findings) {
    const sevWeight = SEVERITY_WEIGHTS[finding.severity] ?? 1;
    const expWeight = EXPLOITABILITY_WEIGHTS[finding.exploitability] ?? 0.3;
    const validationPenalty = finding.validationState === 'LAB_ONLY'
      ? 0.55
      : finding.validationState === 'THEORETICAL'
        ? 0.75
        : 1;
    totalWeight += sevWeight * expWeight * validationPenalty;
    maxWeight += 10;
  }

  let raw = maxWeight === 0 ? 0 : (totalWeight / maxWeight) * 100;
  const topAttackPath = Math.max(...(context?.attackPathScores ?? [0]));
  const controlFailureBoost = Math.min(12, (context?.controlFailures ?? 0) * 3);
  raw = Math.min(100, raw * 0.75 + topAttackPath * 0.2 + controlFailureBoost);

  // ENFORCE SEVERITY BASELINE: Stop 'noise dilution' where 100 Lows cancel out 1 Critical
  const hasCritical = findings.some(f => f.severity === 'CRITICAL');
  const hasHigh = findings.some(f => f.severity === 'HIGH');
  const hasMedium = findings.some(f => f.severity === 'MEDIUM');
  const hasLow = findings.some(f => f.severity === 'LOW');

  if (hasCritical && raw < 90) raw = 90;
  else if (hasHigh && raw < 70) raw = 70;
  else if (hasMedium && raw < 40) raw = 40;
  else if (hasLow && raw < 20) raw = 20;

  return Math.round(raw * 10) / 10;
}

export function determineRiskLevel(
  score: number,
): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL' | 'SECURE' {
  if (score >= 90) return 'CRITICAL';
  if (score >= 70) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  if (score >= 20) return 'LOW';
  if (score >= 5) return 'INFORMATIONAL';
  return 'SECURE';
}
