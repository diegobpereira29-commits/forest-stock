import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import {
  LayoutDashboard, Package, ArrowLeftRight, FolderOpen,
  ClipboardList, BarChart3, TreePine, Menu, X, LogOut,
  ChevronRight, Bell, User, AlertTriangle, Warehouse, Truck, Bot
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { label: "Produtos", icon: Package, page: "Products" },
  { label: "Movimentações", icon: ArrowLeftRight, page: "Movements" },
  { label: "Estoque", icon: Warehouse, page: "Stock" },
  { label: "Projetos", icon: FolderOpen, page: "Projects" },
  { label: "Inventário", icon: ClipboardList, page: "Inventory" },
  { label: "Fornecedores", icon: Truck, page: "Suppliers" },
  { label: "Relatórios", icon: BarChart3, page: "Reports" },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [lowStockCount, setLowStockCount] = useState(0);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    base44.entities.Product.list().then(products => {
      const low = products.filter(p => p.current_stock <= p.min_stock && p.min_stock > 0);
      setLowStockCount(low.length);
    }).catch(() => {});
  }, []);

  const handleLogout = () => base44.auth.logout();

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
      `}</style>

      {/* Overlay */}
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
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ label, icon: Icon, page }) => {
            const active = currentPageName === page;
            return (
              <Link
                key={page}
                to={createPageUrl(page)}
                onClick={() => setSidebarOpen(false)}
                className={`sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${active ? "active" : ""}`}
              >
                <Icon className={`w-4.5 h-4.5 ${active ? "text-green-300" : "text-white/50 group-hover:text-white/80"}`} style={{ width: 18, height: 18 }} />
                <span className={`text-sm font-medium ${active ? "text-white" : "text-white/60 group-hover:text-white/90"}`}>{label}</span>
                {label === "Produtos" && lowStockCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{lowStockCount}</span>
                )}
                {active && <ChevronRight className="ml-auto text-white/40 w-3.5 h-3.5" />}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: "var(--green-accent)" }}>
              {user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">{user?.full_name || user?.email || "Usuário"}</p>
              <p className="text-white/40 text-xs truncate">{user?.role === "admin" ? "Administrador" : user?.role === "almoxarife" ? "Almoxarifado" : "Gestor"}</p>
            </div>
            <button onClick={handleLogout} className="text-white/40 hover:text-white/80 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-100 px-4 lg:px-6 py-3 flex items-center gap-4 sticky top-0 z-10">
          <button className="lg:hidden text-gray-500" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-gray-800">
              {navItems.find(n => n.page === currentPageName)?.label || currentPageName}
            </h1>
          </div>
          {lowStockCount > 0 && (
            <div className="flex items-center gap-1.5 bg-red-50 text-red-600 text-xs font-medium px-3 py-1.5 rounded-full">
              <AlertTriangle className="w-3.5 h-3.5" />
              {lowStockCount} itens em alerta
            </div>
          )}
        </header>

        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}