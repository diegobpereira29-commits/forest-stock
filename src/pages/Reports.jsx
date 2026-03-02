import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { FileText, Download, Filter, TrendingUp, Package, AlertTriangle, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const REPORTS = [
  { id: "inventory", label: "Inventário Atual", icon: Package, desc: "Lista todos os produtos com estoque atual" },
  { id: "movements", label: "Movimentações por Período", icon: TrendingUp, desc: "Entradas e saídas em um intervalo de datas" },
  { id: "project_consumption", label: "Consumo por Projeto", icon: FileText, desc: "Saídas agrupadas por projeto" },
  { id: "low_stock", label: "Estoque Abaixo do Mínimo", icon: AlertTriangle, desc: "Produtos com estoque crítico" },
  { id: "financial", label: "Relatório Financeiro", icon: DollarSign, desc: "Valor total do estoque por categoria" },
];

export default function Reports() {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState("inventory");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterProject, setFilterProject] = useState("all");

  useEffect(() => {
    Promise.all([base44.entities.Product.list(), base44.entities.Movement.list("-date", 500)])
      .then(([p, m]) => { setProducts(p); setMovements(m); setLoading(false); });
  }, []);

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
  const projectNames = [...new Set(movements.filter(m => m.project_name).map(m => m.project_name))];

  const filterByDate = (m) => {
    if (!dateFrom && !dateTo) return true;
    try {
      const d = parseISO(m.date);
      if (dateFrom && dateTo) return isWithinInterval(d, { start: startOfDay(parseISO(dateFrom)), end: endOfDay(parseISO(dateTo)) });
      if (dateFrom) return d >= startOfDay(parseISO(dateFrom));
      if (dateTo) return d <= endOfDay(parseISO(dateTo));
    } catch { return true; }
    return true;
  };

  const getReportData = () => {
    switch (activeReport) {
      case "inventory":
        return products.filter(p => filterCat === "all" || p.category === filterCat)
          .map(p => ({ "Código": p.code || "—", "Produto": p.name, "Categoria": p.category, "Unidade": p.unit, "Estoque Atual": p.current_stock ?? 0, "Estoque Mínimo": p.min_stock ?? 0, "Custo Unit.": `R$ ${(p.unit_cost || 0).toFixed(2)}`, "Valor Total": `R$ ${((p.current_stock || 0) * (p.unit_cost || 0)).toFixed(2)}`, "Localização": p.location || "—" }));

      case "movements":
        return movements.filter(filterByDate).filter(m => filterCat === "all" || m.product_category === filterCat)
          .map(m => ({ "Tipo": m.type === "entrada" ? "Entrada Operacional" : m.type === "saida" ? "Saída Planejada" : m.type === "ajuste" ? "Ajuste Manual" : m.type === "transferencia" ? "Transferência Interna" : m.type === "perda" ? "Saída Extraordinária" : m.type, "Data": m.date ? format(parseISO(m.date), "dd/MM/yyyy") : "—", "Produto": m.product_name || "—", "Categoria": m.product_category || "—", "Quantidade": m.quantity, "Valor Unit.": `R$ ${(m.unit_value || 0).toFixed(2)}`, "Total": `R$ ${(m.total_value || 0).toFixed(2)}`, "Projeto": m.project_name || "—", "Tipo Uso": m.usage_type || "—", "Responsável": m.responsible || "—", "NF": m.invoice_number || "—" }));

      case "project_consumption": {
        const proj = {};
        movements.filter(m => m.type === "saida").filter(filterByDate).filter(m => filterProject === "all" || m.project_name === filterProject).forEach(m => {
          if (!proj[m.project_name || "Sem Projeto"]) proj[m.project_name || "Sem Projeto"] = { qtd: 0, valor: 0, itens: new Set() };
          proj[m.project_name || "Sem Projeto"].qtd += m.quantity || 0;
          proj[m.project_name || "Sem Projeto"].valor += m.total_value || 0;
          proj[m.project_name || "Sem Projeto"].itens.add(m.product_name);
        });
        return Object.entries(proj).map(([k, v]) => ({ "Projeto": k, "Qtd. Total Saída": v.qtd, "Valor Total": `R$ ${v.valor.toFixed(2)}`, "Produtos Diferentes": v.itens.size }));
      }

      case "low_stock":
        return products.filter(p => p.min_stock > 0 && p.current_stock <= p.min_stock)
          .map(p => ({ "Produto": p.name, "Categoria": p.category, "Estoque Atual": p.current_stock ?? 0, "Estoque Mínimo": p.min_stock ?? 0, "Diferença": (p.current_stock || 0) - (p.min_stock || 0), "Fornecedor": p.supplier || "—", "Localização": p.location || "—" }));

      case "financial": {
        const catF = {};
        products.filter(p => filterCat === "all" || p.category === filterCat).forEach(p => {
          if (!catF[p.category]) catF[p.category] = { qtdItens: 0, totalEstoque: 0, valorTotal: 0 };
          catF[p.category].qtdItens++;
          catF[p.category].totalEstoque += p.current_stock || 0;
          catF[p.category].valorTotal += (p.current_stock || 0) * (p.unit_cost || 0);
        });
        return Object.entries(catF).sort((a, b) => b[1].valorTotal - a[1].valorTotal)
          .map(([k, v]) => ({ "Categoria": k, "Qtd. Produtos": v.qtdItens, "Qtd. Total em Estoque": v.totalEstoque.toFixed(2), "Valor Total": `R$ ${v.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` }));
      }

      default: return [];
    }
  };

  const data = getReportData();

  const downloadCSV = () => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const rows = data.map(row => headers.map(h => `"${row[h]}"`).join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${activeReport}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const activeRep = REPORTS.find(r => r.id === activeReport);

  if (loading) return <div className="flex items-center justify-center h-48"><div className="w-7 h-7 border-2 border-green-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Report selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {REPORTS.map(r => {
          const Icon = r.icon;
          const active = activeReport === r.id;
          return (
            <button key={r.id} onClick={() => setActiveReport(r.id)}
              className={`flex flex-col items-start gap-2 p-4 rounded-2xl border text-left transition-all ${active ? "border-green-600 shadow-sm" : "bg-white border-gray-100 hover:border-gray-200"}`}
              style={active ? { background: "#e8f5ee", borderColor: "#1a6b3c" } : {}}>
              <Icon className="w-4 h-4" style={{ color: active ? "#1a6b3c" : "#9ca3af" }} />
              <span className={`text-xs font-medium leading-tight ${active ? "text-green-800" : "text-gray-600"}`}>{r.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {(activeReport === "movements" || activeReport === "project_consumption") && <>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">De</Label>
              <Input type="date" className="w-36" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Até</Label>
              <Input type="date" className="w-36" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
          </>}
          {(activeReport === "inventory" || activeReport === "movements" || activeReport === "financial") && (
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Categoria</Label>
              <select className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
                <option value="all">Todas</option>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          )}
          {activeReport === "project_consumption" && (
            <div>
              <Label className="text-xs text-gray-500 mb-1 block">Projeto</Label>
              <select className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
                <option value="all">Todos</option>
                {projectNames.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
          )}
          <Button onClick={downloadCSV} variant="outline" className="ml-auto flex items-center gap-2">
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">{activeRep?.label}</h3>
            <p className="text-xs text-gray-400">{activeRep?.desc}</p>
          </div>
          <span className="text-xs text-gray-400">{data.length} registro(s)</span>
        </div>
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <FileText className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Nenhum dado encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {Object.keys(data[0]).map(h => (
                    <th key={h} className="text-left text-xs font-medium text-gray-500 px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    {Object.values(row).map((v, j) => (
                      <td key={j} className="px-4 py-3 text-gray-700 whitespace-nowrap">{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}