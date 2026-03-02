import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Package, TrendingUp, TrendingDown, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Leaf, DollarSign
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = ["#1a6b3c", "#2d8653", "#4caf75", "#7bc99a", "#a8ddb8", "#d4edda"];

function StatCard({ title, value, subtitle, icon: Icon, color, trend, trendVal }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center`} style={{ background: color + "20" }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {trendVal && (
          <span className={`flex items-center gap-1 text-xs font-medium ${trend === "up" ? "text-green-600" : "text-red-500"}`}>
            {trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trendVal}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-800 mb-0.5">{value}</p>
      <p className="text-sm text-gray-500">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [projects, setProjects] = useState([]);
  const [overdueClassA, setOverdueClassA] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      base44.entities.Product.list(),
      base44.entities.Movement.list("-date", 500),
      base44.entities.Project.list(),
      base44.entities.CycleInventorySchedule.filter({ status: "atrasado", inventory_class: "A" }),
    ]).then(([p, m, pr, overdueA]) => {
      setProducts(p);
      setMovements(m);
      setProjects(pr);
      setOverdueClassA(overdueA);
      setLoading(false);
    });
  }, []);

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const thisMonthMovements = movements.filter(m => {
    try { return isWithinInterval(parseISO(m.date), { start: monthStart, end: monthEnd }); } catch { return false; }
  });

  const entriesThisMonth = thisMonthMovements.filter(m => m.type === "entrada").reduce((s, m) => s + (m.quantity || 0), 0);
  const exitsThisMonth = thisMonthMovements.filter(m => m.type === "saida").reduce((s, m) => s + (m.quantity || 0), 0);
  const lowStock = products.filter(p => p.min_stock > 0 && p.current_stock <= p.min_stock);
  const totalValue = products.reduce((s, p) => s + (p.current_stock * p.unit_cost || 0), 0);

  // Monthly chart (last 6 months)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(now, 5 - i);
    const start = startOfMonth(d);
    const end = endOfMonth(d);
    const ms = movements.filter(m => { try { return isWithinInterval(parseISO(m.date), { start, end }); } catch { return false; } });
    return {
      mes: format(d, "MMM", { locale: ptBR }),
      entradas: ms.filter(m => m.type === "entrada").reduce((s, m) => s + (m.quantity || 0), 0),
      saidas: ms.filter(m => m.type === "saida").reduce((s, m) => s + (m.quantity || 0), 0),
    };
  });

  // Category pie
  const catMap = {};
  movements.filter(m => m.type === "saida").forEach(m => {
    const cat = m.product_category || "Outros";
    catMap[cat] = (catMap[cat] || 0) + (m.quantity || 0);
  });
  const catData = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }));

  // Top products
  const prodMap = {};
  movements.filter(m => m.type === "saida").forEach(m => {
    prodMap[m.product_name] = (prodMap[m.product_name] || 0) + (m.quantity || 0);
  });
  const topProducts = Object.entries(prodMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Project consumption
  const projMap = {};
  movements.filter(m => m.type === "saida" && m.project_name).forEach(m => {
    projMap[m.project_name] = (projMap[m.project_name] || 0) + (m.total_value || 0);
  });
  const projData = Object.entries(projMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value }));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">{lowStock.length} {lowStock.length === 1 ? "item abaixo" : "itens abaixo"} do estoque mínimo</p>
            <p className="text-xs text-red-500 mt-0.5">{lowStock.slice(0, 3).map(p => p.name).join(", ")}{lowStock.length > 3 ? ` e mais ${lowStock.length - 3}...` : ""}</p>
          </div>
          <Link to={createPageUrl("Products")} className="ml-auto text-xs text-red-600 font-medium hover:underline whitespace-nowrap">Ver itens →</Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total de Itens" value={products.length} subtitle={`${products.filter(p => p.active !== false).length} ativos`} icon={Package} color="#1a6b3c" />
        <StatCard title="Valor em Estoque" value={`R$ ${totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={DollarSign} color="#2d8653" />
        <StatCard title="Entradas no Mês" value={entriesThisMonth.toLocaleString("pt-BR")} icon={TrendingUp} color="#4caf75" trend="up" trendVal="este mês" />
        <StatCard title="Saídas no Mês" value={exitsThisMonth.toLocaleString("pt-BR")} icon={TrendingDown} color="#f59e0b" trend="down" trendVal="este mês" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Monthly movement */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Movimentação Mensal (últimos 6 meses)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="gEntry" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1a6b3c" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1a6b3c" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gExit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="entradas" name="Entradas" stroke="#1a6b3c" fill="url(#gEntry)" strokeWidth={2} />
              <Area type="monotone" dataKey="saidas" name="Saídas" stroke="#f59e0b" fill="url(#gExit)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Category pie */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Categorias Consumidas</h3>
          {catData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={catData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                  {catData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => [v.toLocaleString("pt-BR"), "Qtd"]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center mt-8">Sem dados ainda</p>}
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top products */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Produtos Mais Utilizados</h3>
          {topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.map(([name, qty], i) => {
                const max = topProducts[0][1];
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-700 font-medium truncate max-w-[200px]">{name || "—"}</span>
                      <span className="text-gray-500">{qty.toLocaleString("pt-BR")}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(qty / max) * 100}%`, background: "#1a6b3c" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="text-sm text-gray-400">Sem dados ainda</p>}
        </div>

        {/* Project consumption */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Consumo por Projeto (R$)</h3>
          {projData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={projData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                <Tooltip formatter={v => [`R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Consumo"]} />
                <Bar dataKey="value" fill="#2d8653" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400">Nenhuma saída vinculada a projetos ainda</p>}
        </div>
      </div>

      {/* Low stock list */}
      {lowStock.length > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Itens com Estoque Crítico
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStock.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <Package className="w-4 h-4 text-red-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                  <p className="text-xs text-red-500">{p.current_stock} / mín {p.min_stock} {p.unit}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}