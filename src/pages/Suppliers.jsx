import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Edit2, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SupplierForm({ supplier, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: supplier?.name || "",
    lead_time_days: supplier?.lead_time_days ?? 7,
    contact: supplier?.contact || "",
    email: supplier?.email || "",
    phone: supplier?.phone || "",
    notes: supplier?.notes || "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">{supplier ? "Editar Fornecedor" : "Novo Fornecedor"}</h2>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">✕</button>
      </div>
      <form onSubmit={e => { e.preventDefault(); onSave({ ...form, lead_time_days: Number(form.lead_time_days) }); }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <Label className="text-xs text-gray-600 mb-1 block">Nome *</Label>
          <Input required value={form.name} onChange={e => set("name", e.target.value)} placeholder="Nome do fornecedor" />
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Lead Time (dias) *</Label>
          <Input required type="number" min="0" value={form.lead_time_days} onChange={e => set("lead_time_days", e.target.value)} placeholder="7" />
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Contato</Label>
          <Input value={form.contact} onChange={e => set("contact", e.target.value)} placeholder="Nome do contato" />
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">E-mail</Label>
          <Input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@fornecedor.com" />
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Telefone</Label>
          <Input value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="(00) 00000-0000" />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <Label className="text-xs text-gray-600 mb-1 block">Observações</Label>
          <Input value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Observações adicionais" />
        </div>
        <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" className="text-white" style={{ background: "#1a6b3c" }}>
            {supplier ? "Salvar" : "Cadastrar"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () => {
    base44.entities.Supplier.list("-created_date").then(s => { setSuppliers(s); setLoading(false); });
  };
  useEffect(load, []);

  const handleSave = async (data) => {
    editing ? await base44.entities.Supplier.update(editing.id, data) : await base44.entities.Supplier.create(data);
    setShowForm(false); setEditing(null); load();
  };
  const handleDelete = async (id) => {
    if (!confirm("Deseja excluir este fornecedor?")) return;
    await base44.entities.Supplier.delete(id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="text-white" style={{ background: "#1a6b3c" }}>
          <Plus className="w-4 h-4 mr-1" /> Novo Fornecedor
        </Button>
      </div>

      {showForm && <SupplierForm supplier={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : suppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Truck className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Nenhum fornecedor cadastrado</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {["Nome", "Lead Time", "Contato", "E-mail", "Telefone", "Ações"].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                  <td className="px-4 py-3">
                    <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">{s.lead_time_days ?? 7} dias</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.contact || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.email || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => { setEditing(s); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-green-700">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-gray-400">{suppliers.length} fornecedor(es)</p>
    </div>
  );
}