import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, ClipboardList, CheckCircle2, AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import CycleCountPanel from "@/components/cycle/CycleCountPanel";

const TABS = [
  { id: "physical", label: "Inventário Físico", icon: ClipboardList },
  { id: "cycle", label: "Inventário Rotativo", icon: RotateCw },
];

export default function Inventory() {
  const [tab, setTab] = useState("physical");
  const [products, setProducts] = useState([]);
  const [inventories, setInventories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("list");
  const [counts, setCounts] = useState({});
  const [responsible, setResponsible] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterCat, setFilterCat] = useState("all");
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const load = () => {
    Promise.all([
      base44.entities.Product.list("-name", 200),
      base44.entities.Inventory.list("-date", 100),
    ]).then(([p, inv]) => { setProducts(p); setInventories(inv); setLoading(false); });
  };
  useEffect(load, []);

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
  const filtered = products.filter(p => filterCat === "all" || p.category === filterCat);

  const initCounts = () => {
    const init = {};
    products.forEach(p => { init[p.id] = p.current_stock ?? 0; });
    setCounts(init);
    setMode("count");
  };

  const handleSave = async () => {
    setSaving(true);
    const today = format(new Date(), "yyyy-MM-dd");
    const entries = products.filter(p => counts[p.id] !== undefined && counts[p.id] !== p.current_stock);

    for (const p of entries) {
      const diff = Number(counts[p.id]) - (p.current_stock || 0);
      await base44.entities.Inventory.create({
        date: today,
        product_id: p.id,
        product_name: p.name,
        system_quantity: p.current_stock || 0,
        counted_quantity: Number(counts[p.id]),
        difference: diff,
        responsible,
        notes,
        status: "ajustado",
      });
      await base44.entities.Product.update(p.id, { current_stock: Number(counts[p.id]) });

      if (diff !== 0) {
        await base44.entities.Movement.create({
          type: "ajuste",
          date: today,
          product_id: p.id,
          product_name: p.name,
          product_category: p.category,
          quantity: Number(counts[p.id]),
          unit_value: p.unit_cost || 0,
          total_value: Number(counts[p.id]) * (p.unit_cost || 0),
          responsible,
          notes: `Ajuste de inventário. ${notes}`,
        });
      }
    }
    setSaving(false);
    setMode("list");
    load();
  };

  const diffs = products.filter(p => counts[p.id] !== undefined && Number(counts[p.id]) !== (p.current_stock || 0));

  if (loading) return <div className="flex items-center justify-center h-48"><div className="w-7 h-7 border-2 border-green-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "cycle" ? (
        <CycleCountPanel currentUser={currentUser} />
      ) : (
        <>
          {mode === "list" ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-gray-800">Inventário Físico</h2>
                  <p className="text-xs text-gray-400">Realize a contagem manual e ajuste o estoque</p>
                </div>
                <Button onClick={initCounts} className="text-white" style={{ background: "#1a6b3c" }}>
                  <Plus className="w-4 h-4 mr-1" /> Iniciar Contagem
                </Button>
              </div>

              {inventories.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Ajustes Recentes</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          {["Data", "Produto", "Sistema", "Contado", "Diferença", "Responsável"].map(h => (
                            <th key={h} className="text-left text-xs font-medium text-gray-500 px-3 py-2">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {inventories.slice(0, 20).map(inv => (
                          <tr key={inv.id} className="border-b border-gray-50">
                            <td className="px-3 py-2 text-xs text-gray-500">{inv.date ? format(new Date(inv.date), "dd/MM/yyyy") : "—"}</td>
                            <td className="px-3 py-2 text-sm font-medium text-gray-700">{inv.product_name}</td>
                            <td className="px-3 py-2 text-gray-600">{inv.system_quantity}</td>
                            <td className="px-3 py-2 text-gray-600">{inv.counted_quantity}</td>
                            <td className="px-3 py-2">
                              <span className={`text-xs font-semibold ${inv.difference > 0 ? "text-green-600" : inv.difference < 0 ? "text-red-600" : "text-gray-500"}`}>
                                {inv.difference > 0 ? "+" : ""}{inv.difference}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-500">{inv.responsible || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-gray-800">Contagem de Inventário</h2>
                  <p className="text-xs text-gray-400">Informe a quantidade real de cada item</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setMode("list")}>Cancelar</Button>
                  <Button onClick={handleSave} disabled={saving} className="text-white" style={{ background: "#1a6b3c" }}>
                    {saving ? "Salvando..." : `Confirmar Ajuste${diffs.length > 0 ? ` (${diffs.length})` : ""}`}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Responsável pelo Inventário</Label>
                  <Input value={responsible} onChange={e => setResponsible(e.target.value)} placeholder="Nome do responsável" />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Observações</Label>
                  <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações gerais" />
                </div>
              </div>

              {diffs.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0" />
                  <p className="text-xs text-yellow-700">{diffs.length} item(s) com divergência detectada</p>
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setFilterCat("all")} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterCat === "all" ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-200"}`}>Todos</button>
                {categories.map(c => (
                  <button key={c} onClick={() => setFilterCat(c)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterCat === c ? "bg-green-600 text-white border-green-600" : "bg-white text-gray-600 border-gray-200"}`}>{c}</button>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {["Produto", "Categoria", "Unid.", "Qtd. Sistema", "Qtd. Contada", "Diferença"].map(h => (
                        <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(p => {
                      const counted = counts[p.id] ?? p.current_stock ?? 0;
                      const diff = Number(counted) - (p.current_stock || 0);
                      const isDiff = diff !== 0;
                      return (
                        <tr key={p.id} className={`border-b border-gray-50 ${isDiff ? "bg-yellow-50/50" : ""}`}>
                          <td className="px-4 py-2.5 font-medium text-gray-800">
                            {p.name}
                            {p.inventory_class && (
                              <span className={`ml-2 text-xs font-bold px-1.5 py-0.5 rounded ${p.inventory_class === "A" ? "bg-red-100 text-red-600" : p.inventory_class === "B" ? "bg-yellow-100 text-yellow-600" : "bg-blue-100 text-blue-600"}`}>
                                {p.inventory_class}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs">{p.category}</td>
                          <td className="px-4 py-2.5 text-gray-500">{p.unit}</td>
                          <td className="px-4 py-2.5 text-gray-600">{p.current_stock ?? 0}</td>
                          <td className="px-4 py-2">
                            <Input
                              type="number" min="0" step="0.01"
                              value={counts[p.id] ?? p.current_stock ?? 0}
                              onChange={e => setCounts(c => ({ ...c, [p.id]: e.target.value }))}
                              className="w-24 h-8 text-sm"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-sm font-semibold ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-gray-400"}`}>
                              {diff > 0 ? "+" : ""}{diff || "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}