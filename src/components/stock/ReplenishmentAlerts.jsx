import { useMemo } from "react";
import { addDays, format } from "date-fns";
import { AlertTriangle, CheckCircle, Clock, Truck } from "lucide-react";

function calcDailyRate(movements, productId) {
  const exits = movements
    .filter(m => m.type === "saida" && m.product_id === productId && m.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (exits.length < 2) return exits.reduce((s, m) => s + (m.quantity || 0), 0) / 30 || 0;
  const first = new Date(exits[0].date);
  const last = new Date(exits[exits.length - 1].date);
  const days = Math.max(1, (last - first) / (1000 * 60 * 60 * 24));
  const total = exits.reduce((s, m) => s + (m.quantity || 0), 0);
  return total / days;
}

const URGENCY = [
  { key: "critico", label: "Crítico", color: "bg-red-50 border-red-200 text-red-700", dot: "bg-red-500", icon: AlertTriangle, iconColor: "text-red-500" },
  { key: "urgente", label: "Urgente", color: "bg-amber-50 border-amber-200 text-amber-700", dot: "bg-amber-500", icon: Clock, iconColor: "text-amber-500" },
  { key: "atencao", label: "Atenção", color: "bg-yellow-50 border-yellow-200 text-yellow-700", dot: "bg-yellow-400", icon: Truck, iconColor: "text-yellow-500" },
  { key: "ok", label: "OK", color: "bg-green-50 border-green-200 text-green-700", dot: "bg-green-500", icon: CheckCircle, iconColor: "text-green-500" },
];

export default function ReplenishmentAlerts({ products, movements, suppliers }) {
  const alerts = useMemo(() => {
    const today = new Date();
    return products
      .filter(p => p.active !== false)
      .map(p => {
        const sup = suppliers.find(s => s.id === p.supplier_id || s.name === p.supplier);
        const leadTime = p.lead_time_days || sup?.lead_time_days || 7;
        const dailyRate = calcDailyRate(movements, p.id);
        const daysUntilZero = dailyRate > 0 ? p.current_stock / dailyRate : Infinity;
        const daysUntilMin = dailyRate > 0 && p.min_stock > 0 ? (p.current_stock - p.min_stock) / dailyRate : Infinity;
        const orderDate = addDays(today, Math.floor(daysUntilZero) - leadTime);
        const daysToOrder = Math.floor((orderDate - today) / (1000 * 60 * 60 * 24));

        let urgency = "ok";
        if (daysUntilZero <= leadTime) urgency = "critico";
        else if (daysToOrder <= 0) urgency = "critico";
        else if (daysToOrder <= 3) urgency = "urgente";
        else if (daysToOrder <= 10) urgency = "atencao";

        return {
          product: p,
          dailyRate,
          daysUntilZero: isFinite(daysUntilZero) ? Math.floor(daysUntilZero) : null,
          daysUntilMin: isFinite(daysUntilMin) ? Math.floor(daysUntilMin) : null,
          orderDate: isFinite(daysUntilZero) ? orderDate : null,
          daysToOrder: isFinite(daysToOrder) ? daysToOrder : null,
          leadTime,
          urgency,
          supplierName: sup?.name || p.supplier || "—",
        };
      })
      .filter(a => a.dailyRate > 0 || a.product.current_stock <= a.product.min_stock)
      .sort((a, b) => {
        const order = { critico: 0, urgente: 1, atencao: 2, ok: 3 };
        return (order[a.urgency] - order[b.urgency]) || (a.daysToOrder ?? 999) - (b.daysToOrder ?? 999);
      });
  }, [products, movements, suppliers]);

  const byUrgency = {
    critico: alerts.filter(a => a.urgency === "critico"),
    urgente: alerts.filter(a => a.urgency === "urgente"),
    atencao: alerts.filter(a => a.urgency === "atencao"),
    ok: alerts.filter(a => a.urgency === "ok"),
  };

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {URGENCY.map(u => (
          <div key={u.key} className={`rounded-2xl border p-4 ${u.color}`}>
            <p className="text-xs font-medium opacity-70">{u.label}</p>
            <p className="text-2xl font-bold mt-1">{byUrgency[u.key].length}</p>
            <p className="text-xs opacity-60 mt-0.5">produto(s)</p>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {alerts.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
            <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum produto com dados de consumo para calcular alertas.</p>
          </div>
        )}
        {alerts.map(a => {
          const u = URGENCY.find(x => x.key === a.urgency);
          const Icon = u.icon;
          return (
            <div key={a.product.id} className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${u.color}`}>
              <div className="flex items-center gap-3 flex-1">
                <Icon className={`w-5 h-5 flex-shrink-0 ${u.iconColor}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{a.product.name}</span>
                    <span className="text-xs opacity-60">{a.product.category}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.color}`}>{u.label}</span>
                  </div>
                  <p className="text-xs opacity-70 mt-0.5">
                    Estoque: <strong>{a.product.current_stock} {a.product.unit}</strong> · Taxa: <strong>{a.dailyRate.toFixed(2)}/dia</strong> · Fornecedor: <strong>{a.supplierName}</strong> · Lead time: <strong>{a.leadTime}d</strong>
                  </p>
                </div>
              </div>
              <div className="flex gap-4 text-sm flex-shrink-0">
                <div className="text-center">
                  <p className="text-xs opacity-60">Ruptura em</p>
                  <p className="font-bold">{a.daysUntilZero !== null ? `${a.daysUntilZero}d` : "—"}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs opacity-60">Pedir até</p>
                  <p className="font-bold">{a.orderDate ? format(a.orderDate, "dd/MM") : "—"}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs opacity-60">Dias p/ pedido</p>
                  <p className={`font-bold ${a.daysToOrder !== null && a.daysToOrder <= 0 ? "text-red-700" : ""}`}>
                    {a.daysToOrder !== null ? (a.daysToOrder <= 0 ? "VENCIDO" : `${a.daysToOrder}d`) : "—"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}