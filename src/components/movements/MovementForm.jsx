import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

const USAGE_TYPES = ["plantio", "manutenção", "aplicação", "transporte", "administrativo", "outro"];

export default function MovementForm({ type, products, projects, onSave, onCancel }) {
  const [form, setForm] = useState({
    type,
    date: format(new Date(), "yyyy-MM-dd"),
    product_id: "",
    quantity: "",
    unit_value: "",
    supplier: "",
    invoice_number: "",
    project_id: "",
    usage_type: "plantio",
    responsible: "",
    notes: "",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const selectedProduct = products.find(p => p.id === form.product_id);

  const handleSubmit = (e) => {
    e.preventDefault();
    const qty = Number(form.quantity);
    const uv = Number(form.unit_value);
    const proj = projects.find(p => p.id === form.project_id);
    onSave({
      ...form,
      product_name: selectedProduct?.name || "",
      product_category: selectedProduct?.category || "",
      project_name: proj?.name || "",
      quantity: qty,
      unit_value: uv,
      total_value: qty * uv,
    });
  };

  const typeLabel = type === "entrada" ? "Registrar Entrada" : type === "saida" ? "Registrar Saída" : "Registrar Ajuste";
  const typeColor = type === "entrada" ? "#16a34a" : type === "saida" ? "#dc2626" : "#2563eb";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-gray-800">{typeLabel}</h2>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Data *</Label>
          <Input type="date" required value={form.date} onChange={e => set("date", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs text-gray-600 mb-1 block">Produto *</Label>
          <select required className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500" value={form.product_id} onChange={e => { set("product_id", e.target.value); const p = products.find(x => x.id === e.target.value); if (p) set("unit_value", p.unit_cost || ""); }}>
            <option value="">Selecione o produto...</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.current_stock} {p.unit})</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Quantidade *</Label>
          <Input type="number" required min="0.01" step="0.01" value={form.quantity} onChange={e => set("quantity", e.target.value)} placeholder="0" />
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Valor Unitário (R$)</Label>
          <Input type="number" min="0" step="0.01" value={form.unit_value} onChange={e => set("unit_value", e.target.value)} placeholder="0,00" />
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Total</Label>
          <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-medium text-gray-700 border border-gray-200">
            R$ {((Number(form.quantity) || 0) * (Number(form.unit_value) || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
        </div>

        {type === "entrada" && <>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Fornecedor</Label>
            <Input value={form.supplier} onChange={e => set("supplier", e.target.value)} placeholder="Nome do fornecedor" />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Nº da Nota Fiscal</Label>
            <Input value={form.invoice_number} onChange={e => set("invoice_number", e.target.value)} placeholder="NF-0001" />
          </div>
        </>}

        {type === "saida" && <>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Projeto</Label>
            <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500" value={form.project_id} onChange={e => set("project_id", e.target.value)}>
              <option value="">Sem projeto</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Tipo de Uso</Label>
            <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500" value={form.usage_type} onChange={e => set("usage_type", e.target.value)}>
              {USAGE_TYPES.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
        </>}

        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Responsável</Label>
          <Input value={form.responsible} onChange={e => set("responsible", e.target.value)} placeholder="Nome do responsável" />
        </div>
        <div className={type === "entrada" ? "" : "sm:col-span-2"}>
          <Label className="text-xs text-gray-600 mb-1 block">Observações</Label>
          <Input value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Observações adicionais" />
        </div>

        <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" className="text-white" style={{ background: typeColor }}>
            {typeLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}