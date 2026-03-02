import { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Filter, AlertTriangle, Edit2, Trash2, Package, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ProductForm from "@/components/products/ProductForm";
import Pagination, { PAGE_SIZE } from "@/components/ui/Pagination";

const CATEGORY_COLORS = {
  Mudas: "bg-green-100 text-green-700",
  Fertilizantes: "bg-blue-100 text-blue-700",
  Defensivos: "bg-yellow-100 text-yellow-700",
  Equipamentos: "bg-purple-100 text-purple-700",
  EPIs: "bg-orange-100 text-orange-700",
  Ferramentas: "bg-gray-100 text-gray-700",
  Combustível: "bg-red-100 text-red-700",
  Outros: "bg-slate-100 text-slate-700",
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterAlert, setFilterAlert] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [page, setPage] = useState(1);

  const load = () => {
    setLoading(true);
    base44.entities.Product.list("-created_date", 100).then(p => { setProducts(p); setLoading(false); });
  };
  useEffect(load, []);

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  const filtered = useMemo(() => products.filter(p => {
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.code?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "all" || p.category === filterCat;
    const matchAlert = !filterAlert || (p.min_stock > 0 && p.current_stock <= p.min_stock);
    return matchSearch && matchCat && matchAlert;
  }), [products, search, filterCat, filterAlert]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSave = async (data) => {
    if (editing) {
      await base44.entities.Product.update(editing.id, data);
    } else {
      await base44.entities.Product.create(data);
    }
    setShowForm(false);
    setEditing(null);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm("Deseja excluir este produto?")) return;
    await base44.entities.Product.delete(id);
    load();
  };

  const lowCount = products.filter(p => p.min_stock > 0 && p.current_stock <= p.min_stock).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input className="pl-9 bg-white" placeholder="Buscar por nome ou código..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="all">Todas categorias</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button
            onClick={() => setFilterAlert(v => !v)}
            className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition-colors ${filterAlert ? "bg-red-50 border-red-200 text-red-600" : "bg-white border-gray-200 text-gray-600"}`}>
            <AlertTriangle className="w-3.5 h-3.5" />
            Alertas{lowCount > 0 && <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{lowCount}</span>}
          </button>
          <Button onClick={() => { setEditing(null); setShowForm(true); }} className="text-white" style={{ background: "#1a6b3c" }}>
            <Plus className="w-4 h-4 mr-1" /> Novo Produto
          </Button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <ProductForm
          product={editing}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Package className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm">Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {["Código", "Nome", "Categoria", "Unid.", "Estoque", "Mínimo", "Custo Unit.", "Localização", "Ações"].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const isLow = p.min_stock > 0 && p.current_stock <= p.min_stock;
                  return (
                    <tr key={p.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${isLow ? "bg-red-50/30" : ""}`}>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.code || "—"}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[p.category] || "bg-gray-100 text-gray-700"}`}>{p.category}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{p.unit}</td>
                      <td className="px-4 py-3">
                        <span className={`font-semibold ${isLow ? "text-red-600" : "text-gray-800"}`}>{p.current_stock ?? 0}</span>
                        {isLow && <AlertTriangle className="w-3.5 h-3.5 text-red-500 inline ml-1" />}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{p.min_stock ?? 0}</td>
                      <td className="px-4 py-3 text-gray-600">R$ {(p.unit_cost ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{p.location || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => { setEditing(p); setShowForm(true); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-green-700 transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
      <p className="text-xs text-gray-400">{filtered.length} produto(s) encontrado(s)</p>
    </div>
  );
}