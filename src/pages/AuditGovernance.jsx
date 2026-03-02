import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShieldAlert, Activity, CircleDot, Loader2, UsersRound, PackageSearch } from "lucide-react";
import Pagination, { PAGE_SIZE } from "@/components/ui/Pagination";

export default function AuditGovernance() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    const list = await base44.entities.AuditAlert.filter({ status: 'open' }, '-created_date', 100);
    setAlerts(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runAudit = async () => {
    setRunning(true);
    await base44.functions.invoke('runAudit');
    await load();
    setRunning(false);
  };

  const counts = useMemo(() => ({
    unplanned_out: alerts.filter(a => a.type === 'unplanned_out').length,
    plan_deviation: alerts.filter(a => a.type === 'plan_deviation').length,
    sensitive_product: alerts.filter(a => a.type === 'sensitive_product').length,
    team_risk: alerts.filter(a => a.type === 'team_risk').length,
  }), [alerts]);

  const unplanned = alerts.filter(a => a.type === 'unplanned_out');
  const deviations = alerts.filter(a => a.type === 'plan_deviation');
  const sensitive = alerts.filter(a => a.type === 'sensitive_product');
  const teamRisk = alerts.filter(a => a.type === 'team_risk');

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-7 h-7 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Auditoria e Governança</h2>
          <p className="text-xs text-gray-400">Monitoramento inteligente de desvios, riscos e controles internos</p>
        </div>
        <Button onClick={runAudit} disabled={running} variant="outline" className="gap-2">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
          {running ? 'Executando auditoria...' : 'Executar Auditoria'}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Alertas ativos</div>
          <p className="text-2xl font-bold text-gray-800">{alerts.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><PackageSearch className="w-3.5 h-3.5 text-red-600" /> Produtos sensíveis</div>
          <p className="text-2xl font-bold text-gray-800">{counts.sensitive_product}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><UsersRound className="w-3.5 h-3.5 text-orange-600" /> Equipes sob observação</div>
          <p className="text-2xl font-bold text-gray-800">{counts.team_risk}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Activity className="w-3.5 h-3.5 text-blue-600" /> Projetos com desvio</div>
          <p className="text-2xl font-bold text-gray-800">{counts.plan_deviation}</p>
        </div>
      </div>

      {/* Alertas ativos */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-gray-800">Alertas ativos</h3>
        </div>
        {alerts.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">Nenhum alerta ativo</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Tipo', 'Descrição', 'Produto', 'Projeto', 'Equipe', 'Última detecção'].map(h => (
                    <th key={h} className="text-left text-xs text-gray-500 px-4 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {alerts.map(a => (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2 text-xs font-medium">
                      <span className={`px-2 py-0.5 rounded-full border text-xs ${
                        a.type === 'unplanned_out' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        a.type === 'plan_deviation' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        a.type === 'sensitive_product' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-orange-50 text-orange-700 border-orange-200'
                      }`}>
                        {a.type === 'unplanned_out' ? 'Saída não planejada' :
                         a.type === 'plan_deviation' ? 'Desvio de planejamento' :
                         a.type === 'sensitive_product' ? 'Produto sensível' : 'Risco operacional'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-700 max-w-[380px] truncate">{a.description}</td>
                    <td className="px-4 py-2 text-xs text-gray-600">{a.product_name || '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-600">{a.project_name || '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-600">{a.team_name || '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{a.last_detected_at || a.detected_at || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Produtos sensíveis */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <PackageSearch className="w-4 h-4 text-red-600" />
          <h3 className="text-sm font-semibold text-gray-800">Produtos sensíveis</h3>
        </div>
        {sensitive.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">Nenhum produto sensível identificado</div>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sensitive.map(a => (
              <div key={a.id} className="border border-red-200 bg-red-50 rounded-xl p-3">
                <p className="text-sm font-semibold text-red-700">{a.product_name}</p>
                <p className="text-xs text-red-600 mt-1">{a.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Equipes sob observação */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <UsersRound className="w-4 h-4 text-orange-600" />
          <h3 className="text-sm font-semibold text-gray-800">Equipes sob observação</h3>
        </div>
        {teamRisk.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">Nenhuma equipe acima da média</div>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {teamRisk.map(a => (
              <div key={a.id} className="border border-orange-200 bg-orange-50 rounded-xl p-3">
                <p className="text-sm font-semibold text-orange-700">{a.team_name || a.team_id}</p>
                <p className="text-xs text-orange-600 mt-1">{a.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Projetos com desvio */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-800">Projetos com desvio</h3>
        </div>
        {deviations.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">Nenhum desvio acima de 15% encontrado</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Projeto', 'Produto', 'Período', 'Resumo'].map(h => (
                    <th key={h} className="text-left text-xs text-gray-500 px-4 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deviations.map(a => (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2 text-gray-700">{a.project_name || a.project_id}</td>
                    <td className="px-4 py-2 text-gray-700">{a.product_name || a.product_id}</td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{/* período contido em composite_key */}
                      {a.composite_key?.split('__')?.slice(2)?.join(' → ') || '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{a.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}