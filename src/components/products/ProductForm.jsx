import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CATEGORIES = ["Mudas", "Fertilizantes", "Defensivos", "Equipamentos", "EPIs", "Ferramentas", "Combustível", "Outros"];
const UNITS = ["un", "kg", "litro", "caixa", "m", "m²", "m³", "saco", "pct", "par"];

export default function ProductForm({ product, onSave, onCancel }) {
  const [form, setForm] = useState({
    code: product?.code || "",
    name: product?.name || "",
    category: product?.category || "Mudas",
    unit: product?.unit || "un",
    current_stock: product?.current_stock ?? 0,
    min_stock: product?.min_stock ?? 0,
    location: product?.location || "",
    unit_cost: product?.unit_cost ?? 0,
    supplier: product?.supplier || "",
    supplier_id: product?.supplier_id || "",
    lead_time_days: product?.lead_time_days ?? "",
    description: product?.description || "",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ ...form, current_stock: Number(form.current_stock), min_stock: Number(form.min_stock), unit_cost: Number(form.unit_cost), lead_time_days: form.lead_time_days !== "" ? Number(form.lead_time_days) : undefined });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-gray-800">{product ? "Editar Produto" : "Novo Produto"}</h2>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Código</Label>
          <Input value={form.code} onChange={e => set("code", e.target.value)} placeholder="Ex: MUD-001" />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs text-gray-600 mb-1 block">Nome *</Label>
          <Input required value={form.name} onChange={e => set("name", e.target.value)} placeholder="Nome do produto" />
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Categoria *</Label>
          <select required className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500" value={form.category} onChange={e => set("category", e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Unidade *</Label>
          <select required className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500" value={form.unit} onChange={e => set("unit", e.target.value)}>
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Estoque Atual</Label>
          <Input type="number" min="0" step="0.01" value={form.current_stock} onChange={e => set("current_stock", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Estoque Mínimo</Label>
          <Input type="number" min="0" step="0.01" value={form.min_stock} onChange={e => set("min_stock", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Custo Unitário (R$)</Label>
          <Input type="number" min="0" step="0.01" value={form.unit_cost} onChange={e => set("unit_cost", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Localização</Label>
          <Input value={form.location} onChange={e => set("location", e.target.value)} placeholder="Ex: Galpão A - Prateleira 3" />
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Fornecedor</Label>
          <Input value={form.supplier} onChange={e => set("supplier", e.target.value)} placeholder="Nome do fornecedor" />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <Label className="text-xs text-gray-600 mb-1 block">Descrição</Label>
          <Input value={form.description} onChange={e => set("description", e.target.value)} placeholder="Descrição adicional (opcional)" />
        </div>
        <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" className="text-white" style={{ background: "#1a6b3c" }}>
            {product ? "Salvar Alterações" : "Cadastrar Produto"}
          </Button>
        </div>
      </form>
    </div>
  );
}