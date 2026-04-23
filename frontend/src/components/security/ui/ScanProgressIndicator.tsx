import { motion } from 'framer-motion';
import { scanStageLabels } from '../tokens';
import { CheckCircle, Loader2, Circle, AlertTriangle } from 'lucide-react';

interface ScanProgressIndicatorProps {
  currentStage: string;
  status: string;
  stageProgress?: { completedStages: number; totalStages: number };
}

const STAGE_KEYS = [
  'TARGET_PREP',
  'VERIFICATION_CHECK',
  'ASSET_DISCOVERY',
  'TARGET_CLASSIFICATION',
  'SCENARIO_PLANNING',
  'SCENARIO_EXECUTION',
  'OBSERVATION_VERIFICATION',
  'VALIDATION_LOOP',
  'ATTACK_PATH_ANALYSIS',
  'SCORING',
  'HISTORICAL_COMPARISON',
  'REPORT_GENERATION',
];

export function ScanProgressIndicator({ currentStage, status }: ScanProgressIndicatorProps) {
  const isComplete = status === 'COMPLETED' || currentStage === 'DONE';
  const isFailed = status === 'FAILED' || status === 'TIMED_OUT';
  const currentIndex = STAGE_KEYS.indexOf(currentStage);

  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className="relative mb-6 h-1.5 overflow-hidden rounded-full bg-white/6">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${
            isComplete
              ? 'bg-gradient-to-r from-emerald-400 to-teal-400'
              : isFailed
                ? 'bg-gradient-to-r from-rose-500 to-red-500'
                : 'bg-gradient-to-r from-cyan-400 to-emerald-400'
          }`}
          initial={{ width: '0%' }}
          animate={{
            width: isComplete
              ? '100%'
              : isFailed
                ? `${((currentIndex + 1) / STAGE_KEYS.length) * 100}%`
                : `${((currentIndex + 0.5) / STAGE_KEYS.length) * 100}%`,
          }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
        {!isComplete && !isFailed && (
          <motion.div
            className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{ left: ['-10%', '110%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </div>

      {/* Stage steps */}
      <div className="flex items-start justify-between gap-1">
        {STAGE_KEYS.map((stageKey, index) => {
          const stageInfo = scanStageLabels[stageKey];
          const isStageComplete = isComplete || index < currentIndex;
          const isStageCurrent = stageKey === currentStage && !isComplete && !isFailed;
          const isStageFailed = isFailed && stageKey === currentStage;

          return (
            <motion.div
              key={stageKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="flex flex-1 flex-col items-center text-center"
            >
              <div className="mb-2">
                {isStageComplete ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', bounce: 0.5 }}
                  >
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                  </motion.div>
                ) : isStageCurrent ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                  >
                    <Loader2 className="h-5 w-5 text-cyan-400" />
                  </motion.div>
                ) : isStageFailed ? (
                  <AlertTriangle className="h-5 w-5 text-rose-400" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-600" />
                )}
              </div>
              <p
                className={`text-[9px] font-bold uppercase tracking-[0.15em] leading-tight ${
                  isStageComplete
                    ? 'text-emerald-400/80'
                    : isStageCurrent
                      ? 'text-cyan-300'
                      : isStageFailed
                        ? 'text-rose-400'
                        : 'text-slate-600'
                }`}
              >
                {stageInfo?.label || stageKey}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
