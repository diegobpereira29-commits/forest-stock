import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard, Package, ArrowLeftRight, FolderOpen,
  ClipboardList, BarChart3, TreePine, Menu, X, LogOut,
  ChevronRight, AlertTriangle, Warehouse, Truck, Bot,
  Users, ChevronDown, UsersRound, ShieldAlert
} from "lucide-react";
import NotificationCenter from "@/components/layout/NotificationCenter";

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [stockOpen, setStockOpen] = useState(
    ["Stock", "Movements", "Losses", "ChangeRequests"].includes(currentPageName)
  );

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    base44.entities.Product.list().then(products => {
      const low = products.filter(p => p.current_stock <= p.min_stock && p.min_stock > 0);
      setLowStockCount(low.length);
    }).catch(() => {});
  }, []);

  // Keep submenu open if on a stock sub-page
  useEffect(() => {
    if (["Stock", "Movements", "Losses", "ChangeRequests"].includes(currentPageName)) {
      setStockOpen(true);
    }
  }, [currentPageName]);

  const handleLogout = () => base44.auth.logout();
  const isAdmin = user?.role === "admin";

  const topNav = [
    { label: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
    { label: "Produtos", icon: Package, page: "Products", badge: lowStockCount },
    { label: "Projetos", icon: FolderOpen, page: "Projects" },
    { label: "Inventário", icon: ClipboardList, page: "Inventory" },
    { label: "Fornecedores", icon: Truck, page: "Suppliers" },
    { label: "Relatórios", icon: BarChart3, page: "Reports" },
    { label: "Risco Operacional", icon: AlertTriangle, page: "OperationalRisk" },
    { label: "Assistente IA", icon: Bot, page: "Assistant" },
    { label: "Auditoria por Equipe", icon: UsersRound, page: "TeamAudit" },
    { label: "Auditoria e Governança", icon: ShieldAlert, page: "AuditGovernance" },
  ];

  const stockSubNav = [
    { label: "Visão de Estoque", page: "Stock" },
    { label: "Movimentações", page: "Movements" },
    { label: "Perdas de Processo", page: "Losses" },
    { label: "Solicitações", page: "ChangeRequests" },
  ];

  const isStockActive = ["Stock", "Movements", "Losses", "ChangeRequests"].includes(currentPageName);

  return (
    <div className="min-h-screen bg-[#f0f4f0] flex font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        * { font-family: 'Inter', sans-serif; }
        :root {
          --green-primary: #1a6b3c;
          --green-secondary: #2d8653;
          --green-light: #e8f5ee;
          --green-accent: #4caf75;
          --sidebar-bg: #0f3d23;
        }
        .sidebar-link.active { background: rgba(255,255,255,0.15); }
        .sidebar-link:hover { background: rgba(255,255,255,0.1); }
        .sub-link.active { background: rgba(255,255,255,0.12); }
        .sub-link:hover { background: rgba(255,255,255,0.07); }
      `}</style>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 z-30 flex flex-col transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: "var(--sidebar-bg)" }}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--green-accent)" }}>
            <TreePine className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">ReforestStock</p>
            <p className="text-white/50 text-xs">Gestão de Estoque</p>
          </div>
          <button className="ml-auto lg:hidden text-white/60" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {/* Dashboard */}
          {[topNav[0]].map(({ label, icon: Icon, page, badge }) => {
            const active = currentPageName === page;
            return (
              <Link key={page} to={createPageUrl(page)} onClick={() => setSidebarOpen(false)}
                className={`sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${active ? "active" : ""}`}>
                <Icon className={`w-4.5 h-4.5 ${active ? "text-green-300" : "text-white/50 group-hover:text-white/80"}`} style={{ width: 18, height: 18 }} />
                <span className={`text-sm font-medium ${active ? "text-white" : "text-white/60 group-hover:text-white/90"}`}>{label}</span>
                {active && <ChevronRight className="ml-auto text-white/40 w-3.5 h-3.5" />}
              </Link>
            );
          })}

          {/* Produtos */}
          {[topNav[1]].map(({ label, icon: Icon, page, badge }) => {
            const active = currentPageName === page;
            return (
              <Link key={page} to={createPageUrl(page)} onClick={() => setSidebarOpen(false)}
                className={`sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${active ? "active" : ""}`}>
                <Icon style={{ width: 18, height: 18 }} className={active ? "text-green-300" : "text-white/50 group-hover:text-white/80"} />
                <span className={`text-sm font-medium flex-1 ${active ? "text-white" : "text-white/60 group-hover:text-white/90"}`}>{label}</span>
                {badge > 0 && <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{badge}</span>}
                {active && <ChevronRight className="text-white/40 w-3.5 h-3.5" />}
              </Link>
            );
          })}

          {/* Estoque (submenu) */}
          <button
            onClick={() => setStockOpen(o => !o)}
            className={`sidebar-link w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${isStockActive ? "active" : ""}`}>
            <Warehouse style={{ width: 18, height: 18 }} className={isStockActive ? "text-green-300" : "text-white/50 group-hover:text-white/80"} />
            <span className={`text-sm font-medium flex-1 text-left ${isStockActive ? "text-white" : "text-white/60 group-hover:text-white/90"}`}>Estoque</span>
            <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform ${stockOpen ? "rotate-180" : ""}`} />
          </button>
          {stockOpen && (
            <div className="ml-6 pl-3 border-l border-white/10 space-y-0.5 mt-0.5">
              {stockSubNav.map(({ label, page }) => {
                const active = currentPageName === page;
                return (
                  <Link key={page} to={createPageUrl(page)} onClick={() => setSidebarOpen(false)}
                    className={`sub-link flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${active ? "active" : ""}`}>
                    <span className={`text-xs font-medium ${active ? "text-white" : "text-white/50 hover:text-white/80"}`}>{label}</span>
                    {active && <ChevronRight className="ml-auto text-white/40 w-3 h-3" />}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Rest of nav */}
          {topNav.slice(2).map(({ label, icon: Icon, page }) => {
            const active = currentPageName === page;
            return (
              <Link key={page} to={createPageUrl(page)} onClick={() => setSidebarOpen(false)}
                className={`sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${active ? "active" : ""}`}>
                <Icon style={{ width: 18, height: 18 }} className={active ? "text-green-300" : "text-white/50 group-hover:text-white/80"} />
                <span className={`text-sm font-medium ${active ? "text-white" : "text-white/60 group-hover:text-white/90"}`}>{label}</span>
                {active && <ChevronRight className="ml-auto text-white/40 w-3.5 h-3.5" />}
              </Link>
            );
          })}

          {/* Usuários — admin only */}
          {isAdmin && (() => {
            const active = currentPageName === "Users";
            return (
              <Link to={createPageUrl("Users")} onClick={() => setSidebarOpen(false)}
                className={`sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${active ? "active" : ""}`}>
                <Users style={{ width: 18, height: 18 }} className={active ? "text-green-300" : "text-white/50 group-hover:text-white/80"} />
                <span className={`text-sm font-medium ${active ? "text-white" : "text-white/60 group-hover:text-white/90"}`}>Usuários</span>
                {active && <ChevronRight className="ml-auto text-white/40 w-3.5 h-3.5" />}
              </Link>
            );
          })()}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: "var(--green-accent)" }}>
              {user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{user?.full_name || user?.email || "Usuário"}</p>
              <p className="text-white/40 text-xs truncate">
                {user?.role === "admin" ? "Administrador" : user?.role === "supervisor" ? "Supervisor" : user?.role === "almoxarife" ? "Almoxarife" : "Somente Leitura"}
              </p>
            </div>
            <button onClick={handleLogout} className="text-white/40 hover:text-white/80 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <header className="bg-white border-b border-gray-100 px-4 lg:px-6 py-3 flex items-center gap-4 sticky top-0 z-10">
          <button className="lg:hidden text-gray-500" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-gray-800">
              {currentPageName === "Stock" ? "Visão de Estoque"
                : currentPageName === "Movements" ? "Movimentações"
                : currentPageName === "Losses" ? "Perdas de Processo"
                : currentPageName === "Users" ? "Usuários"
                : currentPageName === "TeamAudit" ? "Auditoria por Equipe"
                : currentPageName === "AuditGovernance" ? "Auditoria e Governança"
                : currentPageName === "ChangeRequests" ? "Solicitações de Alteração"
                : currentPageName || ""}
            </h1>
          </div>
          {lowStockCount > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 bg-red-50 text-red-600 text-xs font-medium px-3 py-1.5 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5" />
              {lowStockCount} itens em alerta
            </div>
          )}
          <NotificationCenter />
        </header>

        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}