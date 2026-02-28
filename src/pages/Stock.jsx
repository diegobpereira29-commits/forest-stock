import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BarChart3, TrendingDown, Clock, ChevronRight } from "lucide-react";
import PlannedVsActual from "@/components/stock/PlannedVsActual";
import StockTimeline from "@/components/stock/StockTimeline.jsx";
import ReplenishmentAlerts from "@/components/stock/ReplenishmentAlerts.jsx";

export default function Stock() {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [projects, setProjects] = useState([]);
  const [plannings, setPlannings] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("planned");

  useEffect(() => {
    Promise.all([
      base44.entities.Product.list("-created_date", 200),
      base44.entities.Movement.list("-date", 500),
      base44.entities.Project.filter({ status: "ativo" }),
      base44.entities.ProjectPlanning.list(),
      base44.entities.Supplier.list(),
    ]).then(([prod, mov, proj, plan, sup]) => {
      setProducts(prod);
      setMovements(mov);
      setProjects(proj);
      setPlannings(plan);
      setSuppliers(sup);
      setLoading(false);
    });
  }, []);

  const tabs = [
    { id: "planned", label: "Planejado x Realizado", icon: BarChart3 },
    { id: "timeline", label: "Projeção de Estoque", icon: TrendingDown },
    { id: "alerts", label: "Alertas de Reposição", icon: Clock },
  ];

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1 shadow-sm w-fit">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-[#1a6b3c] text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-7 h-7 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === "planned" && (
            <PlannedVsActual
              products={products}
              movements={movements}
              projects={projects}
              plannings={plannings}
              onRefresh={() => base44.entities.ProjectPlanning.list().then(setPlannings)}
            />
          )}
          {activeTab === "timeline" && (
            <StockTimeline
              products={products}
              movements={movements}
              suppliers={suppliers}
            />
          )}
          {activeTab === "alerts" && (
            <ReplenishmentAlerts
              products={products}
              movements={movements}
              suppliers={suppliers}
            />
          )}
        </>
      )}
    </div>
  );
}