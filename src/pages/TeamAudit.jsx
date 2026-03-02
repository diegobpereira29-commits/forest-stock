import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, TrendingDown, AlertTriangle, Award, ShieldCheck, ShieldAlert, Shield, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subDays, format, parseISO, isAfter } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const SCORE_CONFIG = [
  { label: "Excelente", min: 85, color: "#16a34a", bg: "bg-green-100 text-green-700 border-green-200", icon: Award },
  { label: "Bom", min: 65, color: "#2563eb", bg: "bg-blue-100 text-blue-700 border-blue-200", icon: ShieldCheck },
  { label: "Atenção", min: 40, color: "#f59e0b", bg: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Shield },
  { label: "Risco", min: 0, color: "#dc2626", bg: "bg-red-100 text-red-700 border-red-200", icon: ShieldAlert },
];

function getScoreConfig(score) {
  return SCORE_CONFIG.find(c => score >= c.min) || SCORE_CONFIG[SCORE_CONFIG.length - 1];
}

function TeamForm({ onSave, onCancel }) {
  const [form, setForm] = useState({ name: "", supervisor_name: "", active: true });
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Nova Equipe</h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Nome da Equipe *</label>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Equipe Alpha" />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Supervisor</label>
          <Input value={form.supervisor_name} onChange={e => setForm({ ...form, supervisor_name: e.target.value })} placeholder="Nome do supervisor" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button disabled={!form.name} onClick={() => onSave(form)} className="text-white" style={{ background: "#1a6b3c" }}>Salvar Equipe</Button>
      </div>
    </div>
  );
}

export default function TeamAudit() {
  const [teams, setTeams] = useState([]);
  const [movements, setMovements] = useState([]);
  const [cycleSchedules, setCycleSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
    load();
  }, []);

  const load = async () => {
    const [t, m, cs] = await Promise.all([
      base44.entities.Team.list(),
      base44.entities.Movement.list("-date", 500),
      base44.entities.CycleInventorySchedule.filter({ status: "atrasado" }),
    ]);
    setTeams(t);
    setMovements(m);
    setCycleSchedules(cs);
    setLoading(false);
  };

  const isAdmin = currentUser?.role === "admin";

  const saveTeam = async (data) => {
    await base44.entities.Team.create(data);
    setShowForm(false);
    load();
  };

  const deleteTeam = async (id) => {
    await base44.entities.Team.delete(id);
    load();
  };

  // Build stats per team
  const teamStats = teams.map(team => {
    const teamMovements = movements.filter(m => m.team_id === team.id);
    const saidas = teamMovements.filter(m => m.type === "saida");
    const perdas = teamMovements.filter(m => m.type === "perda");
    const ajustes = teamMovements.filter(m => m.type === "ajuste");

    const totalConsumed = saidas.reduce((s, m) => s + (m.total_value || 0), 0);
    const totalLosses = perdas.reduce((s, m) => s + (m.total_value || 0), 0);
    const negativeAdjusts = ajustes.filter(m => (m.quantity || 0) < 0).length;
    const lossCount = perdas.length;
    const overdueInventory = cycleSchedules.filter(cs => cs.responsible_user_email && teamMovements.some(m => m.responsible === cs.responsible_user_email)).length;

    // Score
    let score = 100;
    score -= negativeAdjusts * 5;
    score -= lossCount * 10;
    score -= overdueInventory * 5;
    score = Math.max(0, score);

    const divergenceIndex = totalConsumed > 0 ? ((totalLosses / totalConsumed) * 100).toFixed(1) : "0.0";

    return {
      ...team,
      totalConsumed,
      totalLosses,
      negativeAdjusts,
      lossCount,
      overdueInventory,
      score,
      divergenceIndex,
      movementCount: teamMovements.length,
    };
  });

  // Sort by score desc for ranking
  const ranked = [...teamStats].sort((a, b) => b.score - a.score);

  const chartData = ranked.map(t => ({
    name: t.name.length > 12 ? t.name.slice(0, 12) + "…" : t.name,
    consumo: parseFloat((t.totalConsumed / 1000).toFixed(1)),
    perdas: parseFloat((t.totalLosses / 1000).toFixed(1)),
    score: t.score,
  }));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-7 h-7 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Auditoria por Equipe</h2>
          <p className="text-xs text-gray-400">Consumo, perdas e score operacional por equipe</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowForm(true)} className="text-white gap-2" style={{ background: "#1a6b3c" }}>
            <Plus className="w-4 h-4" /> Nova Equipe
          </Button>
        )}
      </div>

      {showForm && <TeamForm onSave={saveTeam} onCancel={() => setShowForm(false)} />}

      {teams.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Nenhuma equipe cadastrada.</p>
          {isAdmin && <p className="text-xs text-gray-400 mt-1">Clique em "Nova Equipe" para começar.</p>}
        </div>
      ) : (
        <>
          {/* Ranking cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ranked.map((team, idx) => {
              const sc = getScoreConfig(team.score);
              const ScIcon = sc.icon;
              return (
                <div key={team.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400">#{idx + 1}</span>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{team.name}</p>
                        {team.supervisor_name && <p className="text-xs text-gray-400">Sup: {team.supervisor_name}</p>}
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full border ${sc.bg}`}>
                      <ScIcon className="w-3 h-3" />
                      {sc.label}
                    </span>
                  </div>

                  {/* Score bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-500">Score Operacional</span>
                      <span className="font-bold" style={{ color: sc.color }}>{team.score}/100</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${team.score}%`, background: sc.color }} />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-gray-400">Consumo</p>
                      <p className="font-semibold text-gray-700">R$ {team.totalConsumed.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-2">
                      <p className="text-orange-400">Perdas</p>
                      <p className="font-semibold text-orange-700">R$ {team.totalLosses.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2">
                      <p className="text-blue-400">Ajustes Neg.</p>
                      <p className="font-semibold text-blue-700">{team.negativeAdjusts}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2">
                      <p className="text-red-400">Diverg. %</p>
                      <p className="font-semibold text-red-700">{team.divergenceIndex}%</p>
                    </div>
                  </div>

                  {/* Score breakdown */}
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-0.5 text-xs text-gray-400">
                    {team.negativeAdjusts > 0 && <p>-{team.negativeAdjusts * 5} pts — {team.negativeAdjusts} ajuste(s) negativo(s)</p>}
                    {team.lossCount > 0 && <p>-{team.lossCount * 10} pts — {team.lossCount} perda(s) registrada(s)</p>}
                    {team.overdueInventory > 0 && <p>-{team.overdueInventory * 5} pts — {team.overdueInventory} inventário(s) atrasado(s)</p>}
                    {team.score === 100 && <p className="text-green-600">Sem penalizações 🎉</p>}
                  </div>

                  {isAdmin && (
                    <button onClick={() => deleteTeam(team.id)} className="mt-3 text-xs text-red-400 hover:text-red-600 transition-colors">Remover equipe</button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Consumo vs Perdas por Equipe (R$ mil)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${v}k`} />
                  <Tooltip formatter={(v, name) => [`R$ ${(v * 1000).toLocaleString("pt-BR")}`, name === "consumo" ? "Consumo" : "Perdas"]} />
                  <Bar dataKey="consumo" name="Consumo" fill="#1a6b3c" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="perdas" name="Perdas" fill="#f87171" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Score ranking chart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Ranking de Score Operacional</h3>
            <ResponsiveContainer width="100%" height={Math.max(120, ranked.length * 44)}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                <Tooltip formatter={v => [`${v}/100`, "Score"]} />
                <Bar dataKey="score" name="Score" radius={[0, 4, 4, 0]}
                  fill="#2d8653"
                  label={{ position: "right", fontSize: 11, formatter: v => `${v}` }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}