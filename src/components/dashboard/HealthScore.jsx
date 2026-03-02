import { ShieldCheck, ShieldAlert, Shield } from "lucide-react";

function ScoreMeter({ score }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  // Arc from 210° to -30° (240° sweep)
  const radius = 54;
  const cx = 70;
  const cy = 70;
  const startAngle = 210;
  const sweepAngle = 240;

  function polarToXY(angleDeg, r) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(startDeg, endDeg, r) {
    const s = polarToXY(startDeg, r);
    const e = polarToXY(endDeg, r);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const endAngle = startAngle + (sweepAngle * clampedScore) / 100;
  const scoreColor = clampedScore >= 85 ? "#16a34a" : clampedScore >= 70 ? "#d97706" : "#dc2626";
  const trackColor = "#e5e7eb";

  return (
    <svg viewBox="0 0 140 100" className="w-40 h-28">
      {/* Track */}
      <path d={arcPath(startAngle, startAngle + sweepAngle, radius)} fill="none" stroke={trackColor} strokeWidth="10" strokeLinecap="round" />
      {/* Progress */}
      {clampedScore > 0 && (
        <path d={arcPath(startAngle, endAngle, radius)} fill="none" stroke={scoreColor} strokeWidth="10" strokeLinecap="round" />
      )}
      {/* Score text */}
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="22" fontWeight="700" fill={scoreColor}>
        {Math.round(clampedScore)}
      </text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize="9" fill="#9ca3af">
        de 100
      </text>
    </svg>
  );
}

const INDICATORS = [
  { label: "Itens abaixo do mínimo", weight: 30, key: "below_min" },
  { label: "Perdas registradas", weight: 20, key: "losses" },
  { label: "Divergência de inventário", weight: 20, key: "inventory_div" },
  { label: "Saídas sem planejamento", weight: 20, key: "unplanned" },
  { label: "Solicitações pendentes", weight: 10, key: "pending_requests" },
];

export default function HealthScore({ score, details, loading }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const clampedScore = Math.max(0, Math.min(100, score ?? 0));
  const isHealthy = clampedScore >= 85;
  const isWarning = clampedScore >= 70 && clampedScore < 85;
  const isRisk = clampedScore < 70;

  const statusLabel = isHealthy ? "Saudável" : isWarning ? "Atenção" : "Risco";
  const statusColor = isHealthy ? "text-green-600" : isWarning ? "text-amber-600" : "text-red-600";
  const statusBg = isHealthy ? "bg-green-50 border-green-100" : isWarning ? "bg-amber-50 border-amber-100" : "bg-red-50 border-red-100";
  const StatusIcon = isHealthy ? ShieldCheck : isWarning ? Shield : ShieldAlert;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isRisk ? "border-red-200" : isWarning ? "border-amber-200" : "border-gray-100"}`}>
      {/* Header */}
      <div className={`px-5 pt-4 pb-3 border-b ${statusBg}`}>
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-4 h-4 ${statusColor}`} />
          <p className="text-sm font-semibold text-gray-700">Índice de Saúde do Estoque</p>
          <span className={`ml-auto text-xs font-bold px-2.5 py-0.5 rounded-full ${isHealthy ? "bg-green-100 text-green-700" : isWarning ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="p-5 flex flex-col sm:flex-row items-center gap-5">
        {/* Meter */}
        <div className="flex-shrink-0 flex flex-col items-center">
          <ScoreMeter score={clampedScore} />
          <p className={`text-xs font-semibold -mt-2 ${statusColor}`}>{statusLabel}</p>
        </div>

        {/* Indicators breakdown */}
        <div className="flex-1 w-full space-y-2">
          {INDICATORS.map(({ label, weight, key }) => {
            const penaltyPct = details?.[key] ?? 0; // 0–100 where 100 = max penalty
            const contribution = weight * (1 - penaltyPct / 100);
            const barWidth = Math.max(0, Math.min(100, contribution / weight * 100));
            const barColor = barWidth >= 80 ? "#16a34a" : barWidth >= 50 ? "#d97706" : "#dc2626";
            return (
              <div key={key}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-gray-600 truncate">{label}</span>
                  <span className="text-gray-400 ml-2 shrink-0">{weight}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${barWidth}%`, background: barColor }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}