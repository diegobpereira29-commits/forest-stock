import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, ArrowUp, ArrowDown, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import MovementForm from "@/components/movements/MovementForm";

const TYPE_STYLE = {
  entrada: { bg: "bg-green-100 text-green-700", label: "Entrada", icon: ArrowUp },
  saida: { bg: "bg-red-100 text-red-700", label: "Saída", icon: ArrowDown },
  ajuste: { bg: "bg-blue-100 text-blue-700", label: "Ajuste", icon: Filter },
};

export default function Movements() {
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState("entrada");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterDate, setFilterDate] = useState("");

  const load = () => {
    Promise.all([
      base44.entities.Movement.list("-date", 300),
      base44.entities.Product.list(),
      base44.entities.Project.filter({ status: "ativo" }),
    ]).then(([m, p, pr]) => { setMovements(m); setProducts(p); setProjects(pr); setLoading(false); });
  };
  useEffect(load, []);

  const filtered = movements.filter(m => {
    const matchSearch = !search || m.product_name?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || m.type === filterType;
    const matchDate = !filterDate || m.date?.startsWith(filterDate);
    return matchSearch && matchType && matchDate;
  });

  const handleSave = async (data) => {
    // Create movement
    await base44.entities.Movement.create(data);
    // Update product stock
    const product = products.find(p => p.id === data.product_id);
    if (product) {
      let newStock = Number(product.current_stock || 0);
      if (data.type === "entrada") newStock += Number(data.quantity);
      else if (data.type === "saida") newStock -= Number(data.quantity);
      else if (data.type === "ajuste") newStock = Number(data.quantity);
      await base44.entities.Product.update(product.id, { current_stock: Math.max(0, newStock) });
    }
    setShowForm(false);
    load();
  };

  const openForm = (type) => { setFormType(type); setShowForm(true); };

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
            <option value="entrada">Entradas</option>
            <option value="saida">Saídas</option>
            <option value="ajuste">Ajustes</option>
          </select>
          <Input type="month" className="bg-white w-36" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          <Button onClick={() => openForm("entrada")} className="bg-green-600 hover:bg-green-700 text-white">
            <ArrowUp className="w-3.5 h-3.5 mr-1" /> Entrada
          </Button>
          <Button onClick={() => openForm("saida")} className="bg-red-500 hover:bg-red-600 text-white">
            <ArrowDown className="w-3.5 h-3.5 mr-1" /> Saída
          </Button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <MovementForm
          type={formType}
          products={products}
          projects={projects}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
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
                  {["Tipo", "Data", "Produto", "Qtd.", "Valor Unit.", "Total", "Projeto/Uso", "Resp.", "NF"].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center text-gray-400 py-12 text-sm">Nenhuma movimentação encontrada</td></tr>
                ) : filtered.map(m => {
                  const s = TYPE_STYLE[m.type] || TYPE_STYLE.entrada;
                  const Icon = s.icon;
                  return (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${s.bg}`}>
                          <Icon className="w-3 h-3" />{s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {m.date ? format(parseISO(m.date), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800 max-w-[160px] truncate">{m.product_name || "—"}</td>
                      <td className="px-4 py-3 font-semibold">{m.quantity}</td>
                      <td className="px-4 py-3 text-gray-600">R$ {(m.unit_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-gray-700 font-medium">R$ {(m.total_value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[120px] truncate">
                        {m.project_name ? `${m.project_name}` : ""}{m.usage_type ? ` / ${m.usage_type}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{m.responsible || "—"}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs font-mono">{m.invoice_number || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">{filtered.length} movimentação(ões)</p>
    </div>
  );
}