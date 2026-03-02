import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, TrendingUp, Users, Package, Calendar } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function OperationalRisk() {
  const [risks, setRisks] = useState({ projectDeviations: [], criticalProducts: [], teamErrors: [], unInventoriedItems: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRisks();
  }, []);

  const loadRisks = async () => {
    try {
      const [movements, plannings, products, teams, cycles, inventory, inventorySchedules] = await Promise.all([
        base44.entities.Movement.list(),
        base44.entities.ProjectPlanning.list(),
        base44.entities.Product.list(),
        base44.entities.Team.list(),
        base44.entities.Inventory.list(),
        base44.entities.Movement.filter({ type: "ajuste" }),
        base44.entities.CycleInventorySchedule.list(),
      ]);

      // 1. PROJETOS COM DESVIO > 10%
      const projectDeviations = [];
      const projectMovements = {};
      movements.forEach(m => {
        if (m.project_id) {
          if (!projectMovements[m.project_id]) projectMovements[m.project_id] = [];
          projectMovements[m.project_id].push(m);
        }
      });

      plannings.forEach(p => {
        const movements = projectMovements[p.project_id] || [];
        const actual = movements.reduce((s, m) => s + (m.quantity || 0), 0);
        const planned = p.planned_quantity || 1;
        const deviation = Math.abs(actual - planned) / planned;
        if (deviation > 0.1) {
          projectDeviations.push({
            id: p.project_id,
            name: p.project_name,
            product: p.product_name,
            planned,
            actual,
            deviation: (deviation * 100).toFixed(1),
          });
        }
      });

      // 2. PRODUTOS CRÍTICOS CLASSE A
      const criticalProducts = products.filter(p => p.inventory_class === "A" && p.current_stock <= p.min_stock);

      // 3. EQUIPES ACIMA DA MÉDIA DE ERRO
      const teamErrors = {};
      inventory.forEach(inv => {
        if (!teamErrors[inv.team_id || "unknown"]) teamErrors[inv.team_id || "unknown"] = { count: 0, errors: 0, name: null };
        teamErrors[inv.team_id || "unknown"].count++;
        if (inv.difference !== 0) teamErrors[inv.team_id || "unknown"].errors++;
      });
      const avgErrorRate = Object.values(teamErrors).length > 0
        ? Object.values(teamErrors).reduce((s, t) => s + (t.errors / t.count), 0) / Object.values(teamErrors).length
        : 0;

      const aboveAverage = Object.entries(teamErrors)
        .filter(([_, t]) => t.count > 0 && t.errors / t.count > avgErrorRate)
        .map(([teamId, t]) => {
          const team = teams.find(tm => tm.id === teamId);
          return {
            id: teamId,
            name: team?.name || "Equipe desconhecida",
            errorRate: (t.errors / t.count * 100).toFixed(1),
            errors: t.errors,
            total: t.count,
          };
        });

      // 4. ITENS SEM INVENTÁRIO HÁ +30 DIAS
      const today = new Date();
      const unInventoriedItems = [];
      const lastCounts = {};
      cycles.forEach(c => {
        if (!lastCounts[c.product_id] || new Date(c.last_count_date) > new Date(lastCounts[c.product_id])) {
          lastCounts[c.product_id] = c.last_count_date;
        }
      });

      products.forEach(p => {
        const lastCount = lastCounts[p.id];
        if (lastCount) {
          const days = differenceInDays(today, parseISO(lastCount));
          if (days > 30) {
            unInventoriedItems.push({
              id: p.id,
              name: p.name,
              category: p.category,
              lastCount,
              daysAgo: days,
            });
          }
        }
      });

      setRisks({ projectDeviations, criticalProducts, teamErrors: aboveAverage, unInventoriedItems });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const riskSummary = useMemo(() => {
    const { projectDeviations, criticalProducts, teamErrors, unInventoriedItems } = risks;
    const total = projectDeviations.length + criticalProducts.length + teamErrors.length + unInventoriedItems.length;
    const high = projectDeviations.filter(p => p.deviation > 20).length + criticalProducts.length + teamErrors.filter(t => t.errorRate > 20).length;
    const moderate = projectDeviations.filter(p => p.deviation <= 20).length + teamErrors.filter(t => t.errorRate <= 20).length;
    const low = unInventoriedItems.filter(i => i.daysAgo <= 60).length;

    return { total, high, moderate, low };
  }, [risks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-3 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-lg" style={{ background: "#fee2e2" }}>
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Risco Alto</p>
              <p className="text-2xl font-bold text-red-600">{riskSummary.high}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-lg" style={{ background: "#fef3c7" }}>
              <TrendingUp className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Risco Moderado</p>
              <p className="text-2xl font-bold text-amber-600">{riskSummary.moderate}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-lg" style={{ background: "#dbeafe" }}>
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Risco Baixo</p>
              <p className="text-2xl font-bold text-blue-600">{riskSummary.low}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-lg" style={{ background: "#f0fdf4" }}>
              <Package className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total de Riscos</p>
              <p className="text-2xl font-bold text-green-600">{riskSummary.total}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Sections */}
      <div className="space-y-6">
        {/* Projetos com Desvio */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-red-600" />
            <h2 className="text-base font-semibold text-gray-800">Projetos com Desvio {">"}10%</h2>
            <span className="ml-auto text-sm text-gray-500">{risks.projectDeviations.length} item(ns)</span>
          </div>
          {risks.projectDeviations.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum projeto com desvio detectado</p>
          ) : (
            <div className="space-y-2">
              {risks.projectDeviations.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.product} | Planejado: {p.planned} | Real: {p.actual}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-red-600">{p.deviation}%</span>
                    <p className="text-xs text-red-500">Risco Alto</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Produtos Críticos */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-red-600" />
            <h2 className="text-base font-semibold text-gray-800">Produtos Críticos (Classe A)</h2>
            <span className="ml-auto text-sm text-gray-500">{risks.criticalProducts.length} item(ns)</span>
          </div>
          {risks.criticalProducts.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum produto crítico em alerta</p>
          ) : (
            <div className="space-y-2">
              {risks.criticalProducts.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.category} | Estoque: {p.current_stock} {p.unit} | Mín: {p.min_stock}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-red-600 font-semibold">Classe A</p>
                    <p className="text-xs text-red-500">Risco Alto</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Equipes acima da Média */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-semibold text-gray-800">Equipes Acima da Média de Erro</h2>
            <span className="ml-auto text-sm text-gray-500">{risks.teamErrors.length} item(ns)</span>
          </div>
          {risks.teamErrors.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma equipe com taxa de erro elevada</p>
          ) : (
            <div className="space-y-2">
              {risks.teamErrors.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.errors} erros em {t.total} inventários</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-amber-600">{t.errorRate}%</span>
                    <p className="text-xs text-amber-600">Risco {t.errorRate > 20 ? "Alto" : "Moderado"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Itens sem Inventário */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-semibold text-gray-800">Itens sem Inventário há +30 dias</h2>
            <span className="ml-auto text-sm text-gray-500">{risks.unInventoriedItems.length} item(ns)</span>
          </div>
          {risks.unInventoriedItems.length === 0 ? (
            <p className="text-sm text-gray-400">Todos os itens foram contados nos últimos 30 dias</p>
          ) : (
            <div className="space-y-2">
              {risks.unInventoriedItems.map(i => (
                <div key={i.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{i.name}</p>
                    <p className="text-xs text-gray-500">{i.category} | Última contagem: {format(parseISO(i.lastCount), "dd/MM/yyyy", { locale: ptBR })}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-blue-600">{i.daysAgo}d</span>
                    <p className="text-xs text-blue-600">Risco {i.daysAgo > 60 ? "Moderado" : "Baixo"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400">Atualizado em: {format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
    </div>
  );
}