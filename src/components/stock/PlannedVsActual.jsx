import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Plus, Trash2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PlannedVsActual({ products, movements, projects, plannings, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ project_id: "", product_id: "", planned_quantity: "", period_start: "", period_end: "" });
  const [saving, setSaving] = useState(false);

  // Build chart data: for each planning entry, calculate actual consumption
  const chartData = plannings.map(p => {
    const actual = movements
      .filter(m => m.type === "saida" && m.product_id === p.product_id && m.project_id === p.project_id)
      .reduce((s, m) => s + (m.quantity || 0), 0);
    return {
      label: `${p.product_name || "Produto"} (${p.project_name || "Projeto"})`,
      Planejado: Number(p.planned_quantity) || 0,
      Realizado: actual,
    };
  });

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

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 mb-1">Total Planejado</p>
          <p className="text-2xl font-bold text-gray-800">{plannings.reduce((s, p) => s + (Number(p.planned_quantity) || 0), 0).toLocaleString("pt-BR")} un</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 mb-1">Total Realizado</p>
          <p className="text-2xl font-bold text-green-700">
            {plannings.reduce((s, p) => {
              const actual = movements.filter(m => m.type === "saida" && m.product_id === p.product_id && m.project_id === p.project_id).reduce((a, m) => a + (m.quantity || 0), 0);
              return s + actual;
            }, 0).toLocaleString("pt-BR")} un
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs text-gray-500 mb-1">Itens Planejados</p>
          <p className="text-2xl font-bold text-gray-800">{plannings.length}</p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Planejado x Realizado por Item/Projeto</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend verticalAlign="top" />
              <Bar dataKey="Planejado" fill="#93c5fd" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Realizado" fill="#1a6b3c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 flex flex-col items-center text-gray-400">
          <FolderOpen className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Nenhum planejamento cadastrado. Adicione abaixo.</p>
        </div>
      )}

      {/* Plannings list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Planejamentos</h3>
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

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {["Projeto", "Produto", "Planejado", "Realizado", "% Exec.", "Período", ""].map(h => (
                <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plannings.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-gray-400 py-8 text-sm">Nenhum planejamento</td></tr>
            ) : plannings.map(p => {
              const actual = movements.filter(m => m.type === "saida" && m.product_id === p.product_id && m.project_id === p.project_id).reduce((s, m) => s + (m.quantity || 0), 0);
              const pct = p.planned_quantity > 0 ? Math.round((actual / p.planned_quantity) * 100) : 0;
              return (
                <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50/40">
                  <td className="px-4 py-2.5 text-gray-700">{p.project_name || "—"}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{p.product_name || "—"}</td>
                  <td className="px-4 py-2.5 text-blue-700 font-semibold">{Number(p.planned_quantity).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-2.5 text-green-700 font-semibold">{actual.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: pct > 100 ? "#ef4444" : "#1a6b3c" }} />
                      </div>
                      <span className={`text-xs font-medium ${pct > 100 ? "text-red-600" : "text-gray-600"}`}>{pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">
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
  );
}