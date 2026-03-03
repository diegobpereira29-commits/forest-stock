import { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell
} from "recharts";
import {
  Plus, Trash2, FolderOpen, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp,
  Target, DollarSign, Activity, BarChart2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { differenceInDays, parseISO, isWithinInterval } from "date-fns";

// ── helpers ───────────────────────────────────────────────────────────────────

function classifyExecution(pct) {
  if (pct < 70 || pct > 120) return "risco";
  if (pct < 90 || pct > 110) return "atencao";
  return "saudavel";
}

function isMidPeriodRisk(planning, pct) {
  if (!planning.period_start || !planning.period_end) return false;
  const today = new Date();
  const start = parseISO(planning.period_start);
  const end = parseISO(planning.period_end);
  const total = differenceInDays(end, start) || 1;
  const elapsed = differenceInDays(today, start);
  if (elapsed <= 0 || elapsed >= total) return false;
  const progress = elapsed / total;
  // Mid-period: expect proportional progress; flag if below 70% of expected
  return pct < progress * 100 * 0.7;
}

const CLASS = {
  saudavel: { label: "Saudável", color: "#16a34a", bgClass: "bg-green-50", borderClass: "border-green-200", textClass: "text-green-700", Icon: CheckCircle },
  atencao:  { label: "Atenção",   color: "#d97706", bgClass: "bg-amber-50", borderClass: "border-amber-200", textClass: "text-amber-700", Icon: AlertTriangle },
  risco:    { label: "Risco",     color: "#dc2626", bgClass: "bg-red-50",   borderClass: "border-red-200",   textClass: "text-red-700",   Icon: XCircle },
};

const BR = (n) => (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── custom tooltip ─────────────────────────────────────────────────────────────

function DeviationTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.value;
  const color = d > 0 ? "#dc2626" : d < 0 ? "#d97706" : "#16a34a";
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-semibold text-gray-800 mb-1 max-w-[180px]">{label}</p>
      <p style={{ color }} className="font-bold text-sm">{d > 0 ? "+" : ""}{d?.toFixed(1)}% de desvio</p>
      {d > 20 && <p className="text-red-500 mt-1">⚠ Consumo acima do planejado</p>}
      {d < -30 && <p className="text-amber-500 mt-1">⚠ Execução muito abaixo do esperado</p>}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function PlannedVsActual({ products, movements, projects, plannings, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ project_id: "", product_id: "", planned_quantity: "", period_start: "", period_end: "" });
  const [saving, setSaving] = useState(false);
  const [showOnlyRisk, setShowOnlyRisk] = useState(false);
  const [filterProject, setFilterProject] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("");
  const [expandedAnalysis, setExpandedAnalysis] = useState(true);

  // Unique teams from movements
  const teams = useMemo(() => {
    const map = {};
    movements.forEach(m => { if (m.team_id && m.team_name) map[m.team_id] = m.team_name; });
    return Object.entries(map).map(([id, name]) => ({ id, name }));
  }, [movements]);

  // Unique categories from products
  const categories = useMemo(() => {
    const s = new Set(products.map(p => p.category).filter(Boolean));
    return [...s];
  }, [products]);

  // Enriched planning rows
  const enriched = useMemo(() => plannings.map(p => {
    const product = products.find(pr => pr.id === p.product_id);
    const matchMovements = movements.filter(m =>
      m.type === "saida" &&
      m.product_id === p.product_id &&
      m.project_id === p.project_id &&
      (!filterPeriod || m.date?.startsWith(filterPeriod))
    );
    const actual = matchMovements.reduce((s, m) => s + (m.quantity || 0), 0);
    const planned = Number(p.planned_quantity) || 0;
    const pct = planned > 0 ? (actual / planned) * 100 : 0;
    const deviation = pct - 100;
    const unitCost = product?.unit_cost || 0;
    const financialImpact = Math.abs(actual - planned) * unitCost;
    const teamIds = new Set(matchMovements.map(m => m.team_id).filter(Boolean));
    const classification = classifyExecution(pct);
    const midRisk = isMidPeriodRisk(p, pct);
    return {
      ...p,
      product,
      actual,
      planned,
      pct,
      deviation,
      financialImpact,
      teamIds,
      classification,
      midRisk,
      unitCost,
    };
  }), [plannings, movements, products, filterPeriod]);

  // Apply filters
  const filtered = useMemo(() => enriched.filter(p => {
    if (filterProject && p.project_id !== filterProject) return false;
    if (filterTeam && !p.teamIds.has(filterTeam)) return false;
    if (filterCategory && p.product?.category !== filterCategory) return false;
    if (showOnlyRisk && p.classification === "saudavel") return false;
    return true;
  }), [enriched, filterProject, filterTeam, filterCategory, showOnlyRisk]);

  // KPIs
  const kpis = useMemo(() => {
    if (!filtered.length) return { execIndex: 0, avgDeviation: 0, atRisk: 0, financialImpact: 0 };
    const withPlan = filtered.filter(p => p.planned > 0);
    const execIndex = withPlan.length ? withPlan.reduce((s, p) => s + p.pct, 0) / withPlan.length : 0;
    const avgDeviation = withPlan.length ? withPlan.reduce((s, p) => s + p.deviation, 0) / withPlan.length : 0;
    const atRisk = filtered.filter(p => p.classification === "risco").length;
    const financialImpact = filtered.reduce((s, p) => s + p.financialImpact, 0);
    return { execIndex, avgDeviation, atRisk, financialImpact };
  }, [filtered]);

  // Project ranking (group by project)
  const projectRanking = useMemo(() => {
    const map = {};
    filtered.forEach(p => {
      if (!map[p.project_id]) map[p.project_id] = { id: p.project_id, name: p.project_name || "—", totalPlanned: 0, totalActual: 0, financialImpact: 0, items: 0 };
      map[p.project_id].totalPlanned += p.planned;
      map[p.project_id].totalActual += p.actual;
      map[p.project_id].financialImpact += p.financialImpact;
      map[p.project_id].items++;
    });
    return Object.values(map).map(proj => {
      const pct = proj.totalPlanned > 0 ? (proj.totalActual / proj.totalPlanned) * 100 : 0;
      return { ...proj, pct, classification: classifyExecution(pct) };
    }).sort((a, b) => {
      const order = { risco: 0, atencao: 1, saudavel: 2 };
      return order[a.classification] - order[b.classification];
    });
  }, [filtered]);

  // Deviation chart data
  const chartData = useMemo(() =>
    filtered
      .filter(p => p.planned > 0)
      .map(p => ({
        label: `${p.product_name || "Produto"}`,
        project: p.project_name || "",
        deviation: parseFloat(p.deviation.toFixed(1)),
        classification: p.classification,
      }))
      .sort((a, b) => b.deviation - a.deviation)
      .slice(0, 20),
    [filtered]
  );

  // Executive analysis
  const analysis = useMemo(() => {
    const overConsumed = filtered.filter(p => p.pct > 120);
    const underExecuted = filtered.filter(p => p.pct < 70 && p.planned > 0);
    const midRisks = filtered.filter(p => p.midRisk);
    const topFinancial = [...filtered].sort((a, b) => b.financialImpact - a.financialImpact).slice(0, 3);

    const points = [];

    if (overConsumed.length) {
      points.push({
        type: "risco",
        title: `${overConsumed.length} item(s) com consumo acima de 120% do planejado`,
        detail: overConsumed.slice(0, 3).map(p => `${p.product_name} em ${p.project_name} (${p.pct.toFixed(0)}%)`).join(", "),
        action: "Revisar planejamento e verificar se há consumo indevido ou erro de registro.",
      });
    }

    if (underExecuted.length) {
      points.push({
        type: "atencao",
        title: `${underExecuted.length} item(s) com execução abaixo de 70%`,
        detail: underExecuted.slice(0, 3).map(p => `${p.product_name} em ${p.project_name} (${p.pct.toFixed(0)}%)`).join(", "),
        action: "Verificar se há atrasos no projeto ou necessidade de replanejamento.",
      });
    }

    if (midRisks.length) {
      points.push({
        type: "atencao",
        title: `${midRisks.length} item(s) com risco de não execução no prazo`,
        detail: "Projetos no meio do período com execução proporcional abaixo do esperado.",
        action: "Acionar equipes responsáveis para retomada imediata.",
      });
    }

    if (kpis.financialImpact > 0) {
      points.push({
        type: topFinancial[0]?.classification || "atencao",
        title: `Impacto financeiro dos desvios: R$ ${BR(kpis.financialImpact)}`,
        detail: topFinancial.map(p => `${p.product_name} (R$ ${BR(p.financialImpact)})`).join(", "),
        action: "Priorizar revisão dos itens de maior valor para reduzir exposição financeira.",
      });
    }

    if (!points.length) {
      points.push({
        type: "saudavel",
        title: "Nenhum desvio crítico identificado.",
        detail: "Execução dentro dos parâmetros esperados.",
        action: "Manter monitoramento periódico.",
      });
    }

    // Overall classification
    const overallClass = kpis.atRisk > 0
      ? "risco"
      : filtered.some(p => p.classification === "atencao") ? "atencao" : "saudavel";

    return { points, overallClass };
  }, [filtered, kpis]);

  // Form handlers
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const project = projects.find(p => p.id === form.project_id);
    const product = products.find(p => p.id === form.product_id);
    await base44.entities.ProjectPlanning.create({
      ...form,
      planned_quantity: Number(form.planned_quantity),
      project_name: project?.name || "",
      product_name: product?.name || "",
    });
    setShowForm(false);
    setForm({ project_id: "", product_id: "", planned_quantity: "", period_start: "", period_end: "" });
    setSaving(false);
    onRefresh();
  };

  const handleDelete = async (id) => {
    if (!confirm("Remover planejamento?")) return;
    await base44.entities.ProjectPlanning.delete(id);
    onRefresh();
  };

  const overallCfg = CLASS[analysis.overallClass];
  const OverallIcon = overallCfg.Icon;

  return (
    <div className="space-y-5">

      {/* ── FILTERS ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Período (mês)</Label>
            <Input type="month" className="h-8 text-sm w-36" value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Projeto</Label>
            <select className="h-8 text-sm border border-gray-200 rounded-lg px-2 bg-white focus:outline-none"
              value={filterProject} onChange={e => setFilterProject(e.target.value)}>
              <option value="">Todos</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Equipe</Label>
            <select className="h-8 text-sm border border-gray-200 rounded-lg px-2 bg-white focus:outline-none"
              value={filterTeam} onChange={e => setFilterTeam(e.target.value)}>
              <option value="">Todas</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">Categoria</Label>
            <select className="h-8 text-sm border border-gray-200 rounded-lg px-2 bg-white focus:outline-none"
              value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">Todas</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button
            onClick={() => setShowOnlyRisk(v => !v)}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium border transition-colors ${
              showOnlyRisk ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-600 border-gray-200 hover:border-red-300"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Apenas em risco
          </button>
          {(filterProject || filterTeam || filterCategory || filterPeriod || showOnlyRisk) && (
            <button onClick={() => { setFilterProject(""); setFilterTeam(""); setFilterCategory(""); setFilterPeriod(""); setShowOnlyRisk(false); }}
              className="h-8 px-3 rounded-lg text-xs text-gray-400 hover:text-gray-600 border border-gray-200">
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Índice Geral de Execução",
            value: `${kpis.execIndex.toFixed(1)}%`,
            icon: Target,
            color: kpis.execIndex >= 90 && kpis.execIndex <= 110 ? "#16a34a" : kpis.execIndex < 70 ? "#dc2626" : "#d97706",
            sub: kpis.execIndex >= 90 && kpis.execIndex <= 110 ? "No alvo" : kpis.execIndex > 110 ? "Acima do planejado" : "Abaixo do esperado"
          },
          {
            label: "Desvio Médio",
            value: `${kpis.avgDeviation > 0 ? "+" : ""}${kpis.avgDeviation.toFixed(1)}%`,
            icon: Activity,
            color: Math.abs(kpis.avgDeviation) < 10 ? "#16a34a" : Math.abs(kpis.avgDeviation) < 25 ? "#d97706" : "#dc2626",
            sub: kpis.avgDeviation > 0 ? "Consumo acima" : kpis.avgDeviation < 0 ? "Execução abaixo" : "Sem desvio"
          },
          {
            label: "Projetos em Risco",
            value: kpis.atRisk.toString(),
            icon: XCircle,
            color: kpis.atRisk === 0 ? "#16a34a" : kpis.atRisk <= 2 ? "#d97706" : "#dc2626",
            sub: kpis.atRisk === 0 ? "Nenhum em risco" : `de ${projectRanking.length} projetos`
          },
          {
            label: "Impacto Financeiro",
            value: `R$ ${BR(kpis.financialImpact)}`,
            icon: DollarSign,
            color: kpis.financialImpact < 1000 ? "#16a34a" : kpis.financialImpact < 10000 ? "#d97706" : "#dc2626",
            sub: "Desvio acumulado"
          },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs text-gray-500">{label}</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            <p className="text-xs text-gray-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── PROJECT RANKING ── */}
      {projectRanking.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-gray-400" /> Ranking por Projeto
          </h3>
          <div className="space-y-3">
            {projectRanking.map(proj => {
              const cfg = CLASS[proj.classification];
              const Icon = cfg.Icon;
              const barPct = Math.min(proj.pct, 140);
              return (
                <div key={proj.id} className={`rounded-xl border p-3.5 ${cfg.bgClass} ${cfg.borderClass}`}>
                  <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${cfg.textClass}`} />
                      <span className="font-medium text-gray-800 text-sm">{proj.name}</span>
                      {proj.pct < 70 && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Execução baixa</span>}
                      {proj.pct > 120 && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Acima do planejado</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bgClass} ${cfg.textClass} border ${cfg.borderClass}`}>{cfg.label}</span>
                      <span className="font-bold text-sm" style={{ color: cfg.color }}>{proj.pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-white/60 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${(barPct / 140) * 100}%`,
                        background: cfg.color
                      }} />
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {proj.totalActual.toLocaleString("pt-BR")} / {proj.totalPlanned.toLocaleString("pt-BR")} un
                    </span>
                    {proj.financialImpact > 0 && (
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        Δ R$ {BR(proj.financialImpact)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── DEVIATION CHART ── */}
      {chartData.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Desvio Percentual por Item</h3>
          <p className="text-xs text-gray-400 mb-4">Consumo real vs planejado (%). Positivo = acima; Negativo = abaixo.</p>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} unit="%" domain={['auto', 'auto']} />
              <Tooltip content={<DeviationTooltip />} />
              <ReferenceLine y={0} stroke="#6b7280" strokeWidth={1.5} />
              <ReferenceLine y={20} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1} label={{ value: "+20%", position: "right", fontSize: 9, fill: "#d97706" }} />
              <ReferenceLine y={-30} stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1} label={{ value: "-30%", position: "right", fontSize: 9, fill: "#d97706" }} />
              <Bar dataKey="deviation" radius={[4, 4, 0, 0]} maxBarSize={36}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={
                    entry.deviation > 20 ? "#dc2626" :
                    entry.deviation < -30 ? "#f59e0b" :
                    entry.deviation >= 0 ? "#2d8653" : "#93c5fd"
                  } />
                ))}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-4 mt-3 justify-center">
            {[
              { color: "#dc2626", label: "Acima +20% (risco)" },
              { color: "#2d8653", label: "Dentro do esperado" },
              { color: "#93c5fd", label: "Abaixo do planejado" },
              { color: "#f59e0b", label: "Muito abaixo -30% (atenção)" },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 flex flex-col items-center text-gray-400">
          <FolderOpen className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Nenhum planejamento encontrado para os filtros selecionados.</p>
        </div>
      )}

      {/* ── EXECUTIVE ANALYSIS ── */}
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${overallCfg.bgClass} ${overallCfg.borderClass}`}>
        <button
          onClick={() => setExpandedAnalysis(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: overallCfg.color }}>
              <OverallIcon className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-gray-800">Análise Executiva Automatizada</p>
              <p className={`text-xs font-medium ${overallCfg.textClass}`}>
                Sistema classificado como: {overallCfg.label}
              </p>
            </div>
          </div>
          {expandedAnalysis ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {expandedAnalysis && (
          <div className="px-5 pb-5 space-y-3 border-t border-white/50">
            {analysis.points.map((pt, i) => {
              const cfg = CLASS[pt.type];
              const PtIcon = cfg.Icon;
              return (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start gap-3">
                    <PtIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.textClass}`} />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-gray-800">{pt.title}</p>
                      {pt.detail && <p className="text-xs text-gray-500">{pt.detail}</p>}
                      <div className="flex items-start gap-1.5 mt-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-blue-700 font-medium">{pt.action}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── PLANNINGS TABLE ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Planejamentos Cadastrados</h3>
          <Button onClick={() => setShowForm(v => !v)} size="sm" className="text-white" style={{ background: "#1a6b3c" }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
          </Button>
        </div>

        {showForm && (
          <form onSubmit={handleSave} className="px-5 py-4 bg-gray-50 border-b border-gray-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Projeto *</Label>
              <select required className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none" value={form.project_id} onChange={e => set("project_id", e.target.value)}>
                <option value="">Selecione...</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Produto *</Label>
              <select required className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none" value={form.product_id} onChange={e => set("product_id", e.target.value)}>
                <option value="">Selecione...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Qtd. Planejada *</Label>
              <Input required type="number" min="0" value={form.planned_quantity} onChange={e => set("planned_quantity", e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Início</Label>
              <Input type="date" value={form.period_start} onChange={e => set("period_start", e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Término</Label>
              <Input type="date" value={form.period_end} onChange={e => set("period_end", e.target.value)} />
            </div>
            <div className="col-span-2 sm:col-span-3 lg:col-span-5 flex gap-2 justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" size="sm" className="text-white" style={{ background: "#1a6b3c" }} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {["Projeto", "Produto", "Categoria", "Planejado", "Realizado", "% Exec.", "Status", "Período", ""].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center text-gray-400 py-8 text-sm">Nenhum planejamento encontrado</td></tr>
              ) : filtered.map(p => {
                const cfg = CLASS[p.classification];
                const StatusIcon = cfg.Icon;
                const isHighlighted = p.pct > 120 || p.midRisk;
                return (
                  <tr key={p.id} className={`border-t border-gray-50 hover:bg-gray-50/40 ${isHighlighted ? "bg-red-50/30" : ""}`}>
                    <td className="px-4 py-2.5 text-gray-700">{p.project_name || "—"}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{p.product_name || "—"}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{p.product?.category || "—"}</td>
                    <td className="px-4 py-2.5 text-blue-700 font-semibold">{p.planned.toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-2.5 text-green-700 font-semibold">{p.actual.toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(p.pct, 100)}%`, background: cfg.color }} />
                        </div>
                        <span className="text-xs font-semibold" style={{ color: cfg.color }}>{p.pct.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bgClass} ${cfg.textClass}`}>
                        <StatusIcon className="w-3 h-3" />{cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                      {p.period_start && p.period_end ? `${p.period_start} → ${p.period_end}` : p.period_start || p.period_end || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => handleDelete(p.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}