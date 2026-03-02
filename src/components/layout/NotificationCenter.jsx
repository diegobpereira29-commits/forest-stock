import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import {
  Bell, X, AlertTriangle, Package, MessageSquare,
  TrendingDown, ShieldAlert, CheckCheck, ChevronLeft, ChevronRight
} from "lucide-react";

const TYPE_CONFIG = {
  critical:  { label: "Alertas Críticos",   icon: ShieldAlert,   color: "text-red-600",    bg: "bg-red-50",    dot: "bg-red-500"    },
  pending:   { label: "Solicitações",        icon: MessageSquare, color: "text-amber-600",  bg: "bg-amber-50",  dot: "bg-amber-500"  },
  low_stock: { label: "Estoque Mínimo",      icon: Package,       color: "text-blue-600",   bg: "bg-blue-50",   dot: "bg-blue-500"   },
  loss:      { label: "Perdas Recentes",     icon: TrendingDown,  color: "text-orange-600", bg: "bg-orange-50", dot: "bg-orange-500" },
  proactive: { label: "Alertas Proativos",   icon: AlertTriangle, color: "text-purple-600", bg: "bg-purple-50", dot: "bg-purple-500" },
};

const FILTERS = [
  { key: "all",       label: "Todos" },
  { key: "critical",  label: "Críticos" },
  { key: "proactive", label: "Proativos" },
  { key: "pending",   label: "Solicitações" },
  { key: "low_stock", label: "Estoque" },
  { key: "loss",      label: "Perdas" },
];

const PAGE_SIZE = 6;

function buildNotifications(auditAlerts, changeRequests, lowStockProducts, losses60) {
  const list = [];

  // Critical audit alerts
  auditAlerts.forEach(a => {
    list.push({
      id: `alert_${a.id}`,
      type: "critical",
      title: a.type === "unplanned_out" ? "Saída sem planejamento"
           : a.type === "plan_deviation" ? "Desvio de planejamento"
           : a.type === "sensitive_product" ? "Produto sensível"
           : "Risco de equipe",
      message: a.description || "",
      date: a.last_detected_at || a.detected_at || a.created_date,
      link: createPageUrl("AuditGovernance"),
      read: false,
    });
  });

  // Pending change requests
  changeRequests.forEach(r => {
    list.push({
      id: `req_${r.id}`,
      type: "pending",
      title: "Solicitação pendente",
      message: r.reason || r.movement_summary || "Nova solicitação de alteração",
      date: r.created_date,
      link: createPageUrl("ChangeRequests"),
      read: false,
    });
  });

  // Low stock
  lowStockProducts.forEach(p => {
    list.push({
      id: `stock_${p.id}`,
      type: "low_stock",
      title: `${p.name} — estoque crítico`,
      message: `Atual: ${p.current_stock} ${p.unit} | Mínimo: ${p.min_stock} ${p.unit}`,
      date: null,
      link: createPageUrl("Products"),
      read: false,
    });
  });

  // Recent losses
  losses60.forEach(m => {
    list.push({
      id: `loss_${m.id}`,
      type: "loss",
      title: `Perda: ${m.product_name || "Produto"}`,
      message: `${m.quantity} ${m.product_unit || "un"} em ${m.date || "—"}${m.loss_reason ? ` — ${m.loss_reason}` : ""}`,
      date: m.date,
      link: createPageUrl("Losses"),
      read: false,
    });
  });

  return list.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date) - new Date(a.date);
  });
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("readNotifIds") || "[]")); } catch { return new Set(); }
  });
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
      const [auditAlerts, changeRequests, products, losses] = await Promise.all([
        base44.entities.AuditAlert.filter({ status: "open" }, "-created_date", 50),
        base44.entities.MovementChangeRequest.filter({ status: "pendente" }, "-created_date", 50),
        base44.entities.Product.list("-name", 200),
        base44.entities.Movement.filter({ type: "perda" }, "-date", 30),
      ]);
      const lowStock = products.filter(p => p.min_stock > 0 && p.current_stock <= p.min_stock);
      const losses60 = losses.filter(m => m.date >= sixtyDaysAgo);
      setNotifications(buildNotifications(auditAlerts, changeRequests, lowStock, losses60));
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [filter]);

  const persistRead = (ids) => {
    localStorage.setItem("readNotifIds", JSON.stringify([...ids]));
  };

  const markRead = (id) => {
    const next = new Set(readIds);
    next.add(id);
    setReadIds(next);
    persistRead(next);
  };

  const markAllRead = () => {
    const next = new Set(notifications.map(n => n.id));
    setReadIds(next);
    persistRead(next);
  };

  const withRead = notifications.map(n => ({ ...n, read: readIds.has(n.id) }));
  const filtered = filter === "all" ? withRead : withRead.filter(n => n.type === filter);
  const unread = withRead.filter(n => !n.read).length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) load(); }}
        className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 flex flex-col max-h-[560px]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-gray-600" />
              <p className="text-sm font-semibold text-gray-800">Notificações</p>
              {unread > 0 && (
                <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">{unread}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-green-700 hover:text-green-800 font-medium">
                  <CheckCheck className="w-3.5 h-3.5" /> Marcar todas
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-1 px-3 py-2 border-b border-gray-50 overflow-x-auto scrollbar-hide">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  filter === f.key
                    ? "bg-green-700 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : paginated.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Bell className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              paginated.map(n => {
                const cfg = TYPE_CONFIG[n.type];
                const Icon = cfg.icon;
                return (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-4 py-3 border-b border-gray-50 transition-colors ${n.read ? "opacity-60" : "bg-white"}`}
                  >
                    <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${cfg.bg}`}>
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={n.link}
                          onClick={() => { markRead(n.id); setOpen(false); }}
                          className="text-xs font-semibold text-gray-800 hover:text-green-700 leading-snug"
                        >
                          {n.title}
                        </Link>
                        {!n.read && (
                          <button onClick={() => markRead(n.id)} title="Marcar como lida">
                            <span className={`shrink-0 w-2 h-2 rounded-full mt-1 ${cfg.dot}`} />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                      {n.date && <p className="text-[10px] text-gray-400 mt-1">{n.date}</p>}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
              <p className="text-xs text-gray-400">{filtered.length} notificações</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-gray-600" />
                </button>
                <span className="text-xs text-gray-600 px-1">{safePage}/{totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}