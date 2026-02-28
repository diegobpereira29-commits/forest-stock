import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend } from "recharts";
import { addDays, format, subDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingDown, AlertTriangle } from "lucide-react";

function calcDailyRate(movements, productId) {
  const exits = movements
    .filter(m => m.type === "saida" && m.product_id === productId && m.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (exits.length < 2) return exits.reduce((s, m) => s + (m.quantity || 0), 0) / 30 || 0;
  const first = parseISO(exits[0].date);
  const last = parseISO(exits[exits.length - 1].date);
  const days = Math.max(1, (last - first) / (1000 * 60 * 60 * 24));
  const total = exits.reduce((s, m) => s + (m.quantity || 0), 0);
  return total / days;
}

function buildProjection(product, movements, leadTimeDays) {
  const dailyRate = calcDailyRate(movements, product.id);
  if (dailyRate <= 0) return null;
  const today = new Date();
  const daysUntilZero = product.current_stock / dailyRate;
  const rupture = addDays(today, Math.floor(daysUntilZero));
  const orderDate = addDays(rupture, -leadTimeDays);
  const points = [];
  const totalDays = Math.ceil(daysUntilZero) + 10;
  for (let i = -10; i <= totalDays; i++) {
    const d = addDays(today, i);
    const stock = Math.max(0, product.current_stock - dailyRate * i);
    points.push({
      date: format(d, "dd/MM"),
      stock: Math.round(stock * 10) / 10,
      minStock: product.min_stock || 0,
    });
  }
  return { points, dailyRate, daysUntilZero: Math.floor(daysUntilZero), rupture, orderDate, leadTimeDays };
}

export default function StockTimeline({ products, movements, suppliers }) {
  const [selectedProduct, setSelectedProduct] = useState(products[0]?.id || "");

  const product = products.find(p => p.id === selectedProduct);

  const leadTimeDays = useMemo(() => {
    if (!product) return 7;
    if (product.lead_time_days) return product.lead_time_days;
    const sup = suppliers.find(s => s.id === product.supplier_id || s.name === product.supplier);
    return sup?.lead_time_days || 7;
  }, [product, suppliers]);

  const projection = useMemo(() => {
    if (!product) return null;
    return buildProjection(product, movements, leadTimeDays);
  }, [product, movements, leadTimeDays]);

  return (
    <div className="space-y-5">
      {/* Product selector */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <label className="text-xs font-medium text-gray-600 mb-2 block">Selecione o produto para projeção</label>
        <select
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 w-full sm:w-80"
          value={selectedProduct}
          onChange={e => setSelectedProduct(e.target.value)}
        >
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name} — Estoque: {p.current_stock} {p.unit}</option>
          ))}
        </select>
      </div>

      {product && projection ? (
        <>
          {/* Info cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500">Estoque Atual</p>
              <p className="text-xl font-bold text-gray-800 mt-1">{product.current_stock} <span className="text-sm font-normal text-gray-400">{product.unit}</span></p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500">Taxa de Uso/Dia</p>
              <p className="text-xl font-bold text-orange-600 mt-1">{projection.dailyRate.toFixed(2)} <span className="text-sm font-normal text-gray-400">{product.unit}</span></p>
            </div>
            <div className={`rounded-2xl border shadow-sm p-4 ${projection.daysUntilZero <= leadTimeDays ? "bg-red-50 border-red-200" : "bg-white border-gray-100"}`}>
              <p className="text-xs text-gray-500">Ruptura em</p>
              <p className={`text-xl font-bold mt-1 ${projection.daysUntilZero <= leadTimeDays ? "text-red-600" : "text-gray-800"}`}>
                {projection.daysUntilZero} dias
              </p>
              <p className="text-xs text-gray-400">{format(projection.rupture, "dd/MM/yyyy")}</p>
            </div>
            <div className={`rounded-2xl border shadow-sm p-4 ${new Date() >= projection.orderDate ? "bg-amber-50 border-amber-200" : "bg-white border-gray-100"}`}>
              <p className="text-xs text-gray-500">Pedir até</p>
              <p className={`text-xl font-bold mt-1 ${new Date() >= projection.orderDate ? "text-amber-600" : "text-gray-800"}`}>
                {format(projection.orderDate, "dd/MM/yyyy")}
              </p>
              <p className="text-xs text-gray-400">Lead time: {leadTimeDays}d</p>
            </div>
          </div>

          {/* Alert */}
          {new Date() >= projection.orderDate && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-800 font-medium">
                Atenção: o pedido de reposição de <strong>{product.name}</strong> deveria ter sido feito em {format(projection.orderDate, "dd/MM/yyyy")}. Baseado na taxa de uso atual, o estoque se esgota em {projection.daysUntilZero} dias.
              </p>
            </div>
          )}

          {/* Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Projeção de Estoque — {product.name}</h3>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={projection.points} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(projection.points.length / 8)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v} ${product.unit}`, ""]} />
                <Legend />
                <ReferenceLine x={format(projection.orderDate, "dd/MM")} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Pedir", fill: "#f59e0b", fontSize: 11 }} />
                <ReferenceLine x={format(projection.rupture, "dd/MM")} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Ruptura", fill: "#ef4444", fontSize: 11 }} />
                <Line type="monotone" dataKey="stock" stroke="#1a6b3c" strokeWidth={2} dot={false} name="Estoque Projetado" />
                <Line type="monotone" dataKey="minStock" stroke="#ef4444" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Estoque Mínimo" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : product ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
          <TrendingDown className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Não há movimentações de saída suficientes para calcular a projeção deste produto.</p>
        </div>
      ) : null}
    </div>
  );
}