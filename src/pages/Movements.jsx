import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { ArrowUp, ArrowDown, Search, SlidersHorizontal, ArrowLeftRight, Pencil, MessageSquarePlus, History } from "lucide-react";
import Pagination, { PAGE_SIZE } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import MovementForm from "@/components/movements/MovementForm";
import RequestChangeModal from "@/components/movements/RequestChangeModal";
import MovementHistoryModal from "@/components/movements/MovementHistoryModal";
import { MOVEMENT_LABELS } from "@/components/shared/movementTypes";

const TYPE_STYLE = {
  entrada:       { bg: "bg-green-100 text-green-700",  label: MOVEMENT_LABELS.entrada,       icon: ArrowUp },
  saida:         { bg: "bg-red-100 text-red-700",      label: MOVEMENT_LABELS.saida,          icon: ArrowDown },
  ajuste:        { bg: "bg-blue-100 text-blue-700",    label: MOVEMENT_LABELS.ajuste,         icon: SlidersHorizontal },
  transferencia: { bg: "bg-purple-100 text-purple-700",label: MOVEMENT_LABELS.transferencia,  icon: ArrowLeftRight },
  perda:         { bg: "bg-orange-100 text-orange-700",label: MOVEMENT_LABELS.perda,          icon: SlidersHorizontal },
};

export default function Movements() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState("entrada");
  const [editData, setEditData] = useState(null);
  const [requestTarget, setRequestTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [page, setPage] = useState(1);
  const [historyMovementId, setHistoryMovementId] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  useEffect(() => { setPage(1); }, [search, filterType, filterDate]);

  const load = () => {
    Promise.all([
      base44.entities.Movement.list("-date", 300),
      base44.entities.Product.list(),
      base44.entities.Project.filter({ status: "ativo" }),
    ]).then(([m, p, pr]) => { setMovements(m); setProducts(p); setProjects(pr); setLoading(false); });
  };
  useEffect(load, []);

  const canWrite = currentUser?.role === "admin" || currentUser?.role === "almoxarife";
  const isAdmin = currentUser?.role === "admin";
  const isAlmoxarife = currentUser?.role === "almoxarife";

  const filtered = useMemo(() => movements.filter(m => {
    const matchSearch = !search || m.product_name?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || m.type === filterType;
    const matchDate = !filterDate || m.date?.startsWith(filterDate);
    return matchSearch && matchType && matchDate;
  }), [movements, search, filterType, filterDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSave = async (data) => {
    const payload = editData ? { data, movement_id: editData.id } : { data };
    const res = await base44.functions.invoke("saveMovement", payload);
    if (res.data?.error) { alert(`Erro: ${res.data.error}`); return; }
    setShowForm(false);
    setEditData(null);
    load();
  };

  const openForm = (type) => { setFormType(type); setEditData(null); setShowForm(true); };
  const openEdit = (movement) => { setEditData(movement); setFormType(movement.type); setShowForm(true); };
  const openRequest = (movement) => { setRequestTarget(movement); setShowForm(false); };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input className="pl-9 bg-white" placeholder="Buscar por produto..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none" value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="all">Todos os tipos</option>
            <option value="entrada">{MOVEMENT_LABELS.entrada}</option>
            <option value="saida">{MOVEMENT_LABELS.saida}</option>
            <option value="transferencia">{MOVEMENT_LABELS.transferencia}</option>
            <option value="ajuste">{MOVEMENT_LABELS.ajuste}</option>
            <option value="perda">{MOVEMENT_LABELS.perda}</option>
          </select>
          <Input type="month" className="bg-white w-36" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          {canWrite && <>
            <Button onClick={() => openForm("entrada")} className="bg-green-600 hover:bg-green-700 text-white">
              <ArrowUp className="w-3.5 h-3.5 mr-1" /> Entrada Operacional
            </Button>
            <Button onClick={() => openForm("saida")} className="bg-red-500 hover:bg-red-600 text-white">
              <ArrowDown className="w-3.5 h-3.5 mr-1" /> Saída Planejada
            </Button>
            <Button onClick={() => openForm("transferencia")} className="bg-purple-600 hover:bg-purple-700 text-white">
              <ArrowLeftRight className="w-3.5 h-3.5 mr-1" /> Transferência Interna
            </Button>
          </>}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <MovementForm
          type={formType}
          products={products}
          projects={projects}
          editData={editData}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditData(null); }}
        />
      )}

      {requestTarget && (
        <RequestChangeModal
          movement={requestTarget}
          currentUser={currentUser}
          onClose={() => setRequestTarget(null)}
          onSaved={() => { setRequestTarget(null); }}
        />
      )}

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
                  {["Tipo", "Data", "Produto", "Qtd.", "Valor Unit.", "Total", "Projeto/Uso", "Orig./Dest.", "Resp.", "NF", ""].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={11} className="text-center text-gray-400 py-12 text-sm">Nenhuma movimentação encontrada</td></tr>
                ) : paginated.map(m => {
                  const s = TYPE_STYLE[m.type] || TYPE_STYLE.entrada;
                  const Icon = s.icon;
                  return (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${s.bg}`}>
                          <Icon className="w-3 h-3" />{s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {m.date ? format(parseISO(m.date), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-[140px] truncate">{m.product_name || "—"}</td>
                      <td className="px-4 py-3 font-semibold">{m.quantity}</td>
                      <td className="px-4 py-3 text-gray-600">R$ {(m.unit_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-gray-700 font-medium">R$ {(m.total_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px] truncate">
                        {m.project_name ? m.project_name : ""}{m.usage_type ? ` / ${m.usage_type}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-[120px] truncate">
                        {m.origin_location || m.destination_location ? `${m.origin_location || "?"} → ${m.destination_location || "?"}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{m.responsible || "—"}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs font-mono">{m.invoice_number || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {isAdmin && (
                            <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors" title="Editar">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(isAlmoxarife || isAdmin) && (
                            <button onClick={() => openRequest(m)} className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors" title="Solicitar alteração">
                              <MessageSquarePlus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Pagination page={safePage} totalPages={totalPages} onChange={setPage} totalItems={filtered.length} />
    </div>
  );
}