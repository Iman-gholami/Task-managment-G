// Experimental, non-persisted score. Not an official personnel evaluation.
export const KPI_PREVIEW_TARGET = 10;
export function previewKpi(stats, target = KPI_PREVIEW_TARGET) {
  const parts = [
    { weight: 25, value: Math.min(100, Math.max(0, stats.completed / target * 100)) },
    { weight: 25, value: stats.onTimeRate == null ? null : stats.onTimeRate * 100 },
    { weight: 25, value: stats.highQualityShare == null ? null : stats.highQualityShare * 100 },
    { weight: 25, value: stats.routineRate == null ? null : stats.routineRate * 100 },
  ];
  const available = parts.filter(x => x.value != null);
  const coverage = available.reduce((s, x) => s + x.weight, 0);
  return {
    score: coverage ? available.reduce((s, x) => s + x.value * x.weight, 0) / coverage : null,
    coverage,
  };
}
