import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, CheckCircle, XCircle, MessageSquarePlus, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import RequestReviewModal from "@/components/movements/RequestReviewModal";
import Pagination, { PAGE_SIZE } from "@/components/ui/Pagination";

const STATUS_STYLE = {
  pendente:  { bg: "bg-amber-100 text-amber-700",  icon: Clock,         label: "Pendente" },
  aprovada:  { bg: "bg-green-100 text-green-700",  icon: CheckCircle,   label: "Aprovada" },
  rejeitada: { bg: "bg-red-100 text-red-700",      icon: XCircle,       label: "Rejeitada" },
};

export default function ChangeRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [user, setUser]         = useState(null);
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    load();
  }, []);

  const load = () => {
    setLoading(true);
    base44.entities.MovementChangeRequest.list("-created_date", 200)
      .then(r => { setRequests(r); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const canReview = user?.role === "admin" || user?.role === "supervisor";
  const canCreate = user?.role === "admin" || user?.role === "almoxarife";

  const filtered = filterStatus === "all"
    ? requests
    : requests.filter(r => r.status === filterStatus);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-800">Solicitações de Alteração</h2>
          <p className="text-xs text-gray-500 mt-0.5">Pedidos de correção em movimentações registradas</p>
        </div>
        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">Todos os status</option>
          <option value="pendente">Pendentes</option>
          <option value="aprovada">Aprovadas</option>
          <option value="rejeitada">Rejeitadas</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {["pendente","aprovada","rejeitada"].map(s => {
          const count = requests.filter(r => r.status === s).length;
          const st = STATUS_STYLE[s];
          const Icon = st.icon;
          return (
            <div key={s} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <span className={`w-9 h-9 rounded-full flex items-center justify-center ${st.bg}`}>
                <Icon className="w-4 h-4" />
              </span>
              <div>
                <p className="text-xl font-bold text-gray-800">{count}</p>
                <p className="text-xs text-gray-500">{st.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {["Status", "Data", "Solicitante", "Movimentação", "Motivo", "Revisor", ""].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-gray-400 py-12 text-sm">Nenhuma solicitação encontrada</td></tr>
                ) : filtered.map(r => {
                  const st = STATUS_STYLE[r.status] || STATUS_STYLE.pendente;
                  const Icon = st.icon;
                  return (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${st.bg}`}>
                          <Icon className="w-3 h-3" />{st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {r.created_date ? format(parseISO(r.created_date), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-xs">{r.requester_name || r.requester_email || "—"}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs max-w-[180px] truncate">{r.movement_summary || r.movement_id}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{r.reason}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {r.reviewer_name ? r.reviewer_name : (r.status === "pendente" ? <span className="text-amber-500">Aguardando</span> : "—")}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelected(r)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">{filtered.length} solicitação(ões)</p>

      {selected && (
        <RequestReviewModal
          request={selected}
          canReview={canReview}
          currentUser={user}
          onClose={() => setSelected(null)}
          onUpdated={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}