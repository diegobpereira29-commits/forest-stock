import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertOctagon, Clock, CheckCircle2, RefreshCw, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const CLASS_STYLE = {
  A: { bg: "bg-red-100 text-red-700 border-red-200", label: "Classe A", dot: "bg-red-500" },
  B: { bg: "bg-yellow-100 text-yellow-700 border-yellow-200", label: "Classe B", dot: "bg-yellow-500" },
  C: { bg: "bg-blue-100 text-blue-700 border-blue-200", label: "Classe C", dot: "bg-blue-500" },
};

const STATUS_STYLE = {
  atrasado: { bg: "bg-red-50 text-red-700 border-red-200", icon: AlertOctagon, label: "Atrasado" },
  pendente: { bg: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: Clock, label: "Pendente" },
  realizado: { bg: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2, label: "Realizado" },
};

export default function CycleCountPanel({ currentUser }) {
  const [schedules, setSchedules] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classifying, setClassifying] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterClass, setFilterClass] = useState("all");
  const [markingId, setMarkingId] = useState(null);

  const load = async () => {
    const [s, u] = await Promise.all([
      base44.entities.CycleInventorySchedule.list("-next_count_date", 200),
      base44.entities.User.list(),
    ]);
    setSchedules(s);
    setUsers(u);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runClassification = async () => {
    setClassifying(true);
    await base44.functions.invoke('classifyABC');
    await load();
    setClassifying(false);
  };

  const markAsRealizado = async (schedule) => {
    setMarkingId(schedule.id);
    const today = format(new Date(), "yyyy-MM-dd");
    const next = new Date();
    next.setDate(next.getDate() + schedule.frequency_days);
    await base44.entities.CycleInventorySchedule.update(schedule.id, {
      status: "realizado",
      last_count_date: today,
      next_count_date: format(next, "yyyy-MM-dd"),
    });
    await load();
    setMarkingId(null);
  };

  const assignUser = async (scheduleId, email, userId) => {
    await base44.entities.CycleInventorySchedule.update(scheduleId, {
      responsible_user_email: email,
      responsible_user_id: userId,
    });
    await load();
  };

  const today = format(new Date(), "yyyy-MM-dd");

  // Auto-update overdue
  useEffect(() => {
    const overdue = schedules.filter(s => s.status === "pendente" && s.next_count_date < today);
    if (overdue.length > 0) {
      Promise.all(overdue.map(s =>
        base44.entities.CycleInventorySchedule.update(s.id, { status: "atrasado" })
      )).then(load);
    }
  }, [schedules]);

  const filtered = schedules.filter(s => {
    const matchStatus = filterStatus === "all" || s.status === filterStatus;
    const matchClass = filterClass === "all" || s.inventory_class === filterClass;
    return matchStatus && matchClass;
  });

  const summary = {
    atrasado: schedules.filter(s => s.status === "atrasado").length,
    pendente: schedules.filter(s => s.status === "pendente").length,
    realizado: schedules.filter(s => s.status === "realizado").length,
  };

  const isAdmin = currentUser?.role === "admin";
  const isWriter = currentUser?.role === "admin" || currentUser?.role === "almoxarife";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Inventário Rotativo (Cycle Count)</h2>
          <p className="text-xs text-gray-400">Contagens contínuas baseadas na classificação ABC dos produtos</p>
        </div>
        {isAdmin && (
          <Button onClick={runClassification} disabled={classifying} variant="outline" className="gap-2">
            {classifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {classifying ? "Classificando..." : "Reclassificar ABC"}
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-700">{summary.atrasado}</p>
          <p className="text-xs text-red-500 mt-1 font-medium">Atrasados</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-700">{summary.pendente}</p>
          <p className="text-xs text-yellow-500 mt-1 font-medium">Pendentes</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{summary.realizado}</p>
          <p className="text-xs text-green-500 mt-1 font-medium">Realizados</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {["all", "atrasado", "pendente", "realizado"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterStatus === s ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
            {s === "all" ? "Todos" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <div className="w-px bg-gray-200 mx-1" />
        {["all", "A", "B", "C"].map(c => (
          <button key={c} onClick={() => setFilterClass(c)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterClass === c ? "bg-gray-700 text-white border-gray-700" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
            {c === "all" ? "Todas as Classes" : `Classe ${c}`}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">Nenhum agendamento encontrado.</p>
            {isAdmin && schedules.length === 0 && (
              <p className="text-xs mt-2">Clique em "Reclassificar ABC" para gerar os agendamentos automaticamente.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {["Produto", "Categoria", "Classe", "Frequência", "Próx. Contagem", "Última Contagem", "Responsável", "Status", ...(isWriter ? ["Ação"] : [])].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const cs = CLASS_STYLE[s.inventory_class] || CLASS_STYLE.C;
                  const ss = STATUS_STYLE[s.status] || STATUS_STYLE.pendente;
                  const StatusIcon = ss.icon;
                  return (
                    <tr key={s.id} className={`border-b border-gray-50 hover:bg-gray-50/50 ${s.status === "atrasado" ? "bg-red-50/30" : ""}`}>
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-[160px] truncate">{s.product_name || "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{s.product_category || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${cs.bg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cs.dot}`} />
                          {cs.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        A cada {s.frequency_days}d
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                        {s.next_count_date ? format(parseISO(s.next_count_date), "dd/MM/yyyy") : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {s.last_count_date ? format(parseISO(s.last_count_date), "dd/MM/yyyy") : "Nunca"}
                      </td>
                      <td className="px-4 py-3">
                        {isWriter ? (
                          <select
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none max-w-[140px]"
                            value={s.responsible_user_email || ""}
                            onChange={e => {
                              const u = users.find(u => u.email === e.target.value);
                              assignUser(s.id, e.target.value, u?.id || "");
                            }}>
                            <option value="">— Sem responsável —</option>
                            {users.map(u => <option key={u.id} value={u.email}>{u.full_name || u.email}</option>)}
                          </select>
                        ) : (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {s.responsible_user_email || "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${ss.bg}`}>
                          <StatusIcon className="w-3 h-3" />
                          {ss.label}
                        </span>
                      </td>
                      {isWriter && (
                        <td className="px-4 py-3">
                          {s.status !== "realizado" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={markingId === s.id}
                              onClick={() => markAsRealizado(s)}
                              className="text-xs h-7 px-2 text-green-700 border-green-200 hover:bg-green-50">
                              {markingId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                              Realizado
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">{filtered.length} agendamento(s)</p>
    </div>
  );
}