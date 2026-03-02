import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, AlertTriangle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Losses() {
  const [losses, setLosses] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ product_id: "", quantity: "", loss_reason: "", date: new Date().toISOString().split("T")[0], notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
    load();
  }, []);

  const load = () => {
    Promise.all([
      base44.entities.Movement.filter({ type: "perda" }, "-date", 200),
      base44.entities.Product.list(),
    ]).then(([l, p]) => { setLosses(l); setProducts(p); setLoading(false); });
  };

  const canWrite = currentUser?.role === "admin" || currentUser?.role === "almoxarife";

  const handleSave = async () => {
    if (!form.product_id || !form.quantity) return;
    setSaving(true);
    const product = products.find(p => p.id === form.product_id);
    const res = await base44.functions.invoke("saveMovement", {
      data: {
        type: "perda",
        date: form.date,
        product_id: form.product_id,
        product_name: product?.name || "",
        product_category: product?.category || "",
        quantity: Number(form.quantity),
        loss_reason: form.loss_reason,
        notes: form.notes,
        responsible: currentUser?.full_name || currentUser?.email || "",
      }
    });
    if (res.data?.error) {
      alert(`Erro: ${res.data.error}`);
      setSaving(false);
      return;
    }
    setShowForm(false);
    setForm({ product_id: "", quantity: "", loss_reason: "", date: new Date().toISOString().split("T")[0], notes: "" });
    setSaving(false);
    load();
  };

  const filtered = losses.filter(l =>
    !search || l.product_name?.toLowerCase().includes(search.toLowerCase()) || l.loss_reason?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input className="pl-9 bg-white" placeholder="Buscar por produto ou motivo..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {canWrite && (
          <Button onClick={() => setShowForm(!showForm)} className="bg-orange-600 hover:bg-orange-700 text-white">
            <Plus className="w-3.5 h-3.5 mr-1" /> Registrar Saída Extraordinária
          </Button>
        )}
      </div>

      {showForm && canWrite && (
        <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" /> Nova Saída Extraordinária
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Produto *</label>
              <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none" value={form.product_id} onChange={e => setForm({ ...form, product_id: e.target.value })}>
                <option value="">Selecione...</option>
                {products.filter(p => p.active !== false).map(p => (
                  <option key={p.id} value={p.id}>{p.name} (estoque: {p.current_stock} {p.unit})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Data *</label>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Quantidade *</label>
              <Input type="number" placeholder="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Motivo da Perda</label>
              <Input placeholder="Ex: vencimento, dano físico, furto..." value={form.loss_reason} onChange={e => setForm({ ...form, loss_reason: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Observações</label>
              <Input placeholder="Informações adicionais..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.product_id || !form.quantity} className="bg-orange-600 hover:bg-orange-700 text-white">
              {saving ? "Salvando..." : "Registrar Saída Extraordinária"}
            </Button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {["Data", "Produto", "Categoria", "Qtd.", "Motivo", "Responsável", "Observações"].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-gray-400 py-12 text-sm">Nenhuma perda registrada</td></tr>
                ) : filtered.map(l => (
                  <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {l.date ? format(parseISO(l.date), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800">{l.product_name || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{l.product_category || "—"}</td>
                    <td className="px-4 py-3 font-semibold text-orange-600">{l.quantity}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{l.loss_reason || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{l.responsible || "—"}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{l.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">{filtered.length} registro(s) de perda</p>
    </div>
  );
}