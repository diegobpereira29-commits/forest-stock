import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, FolderOpen, Edit2, Trash2, MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, parseISO } from "date-fns";

const STATUS_STYLE = {
  ativo: "bg-green-100 text-green-700",
  concluído: "bg-blue-100 text-blue-700",
  suspenso: "bg-yellow-100 text-yellow-700",
};

function ProjectForm({ project, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: project?.name || "",
    area_ha: project?.area_ha || "",
    location: project?.location || "",
    client: project?.client || "",
    status: project?.status || "ativo",
    start_date: project?.start_date || "",
    end_date: project?.end_date || "",
    description: project?.description || "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-800">{project ? "Editar Projeto" : "Novo Projeto"}</h2>
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">✕</button>
      </div>
      <form onSubmit={e => { e.preventDefault(); onSave({ ...form, area_ha: Number(form.area_ha) }); }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <Label className="text-xs text-gray-600 mb-1 block">Nome do Projeto *</Label>
          <Input required value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ex: Reflorestamento Área Norte" />
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
          <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500" value={form.status} onChange={e => set("status", e.target.value)}>
            <option value="ativo">Ativo</option>
            <option value="concluído">Concluído</option>
            <option value="suspenso">Suspenso</option>
          </select>
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Área (hectares)</Label>
          <Input type="number" min="0" step="0.01" value={form.area_ha} onChange={e => set("area_ha", e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Localização</Label>
          <Input value={form.location} onChange={e => set("location", e.target.value)} placeholder="Ex: Fazenda São João - MG" />
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Cliente</Label>
          <Input value={form.client} onChange={e => set("client", e.target.value)} placeholder="Nome do cliente" />
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Data de Início</Label>
          <Input type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} />
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Data de Término</Label>
          <Input type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <Label className="text-xs text-gray-600 mb-1 block">Descrição</Label>
          <Input value={form.description} onChange={e => set("description", e.target.value)} placeholder="Descrição do projeto" />
        </div>
        <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" className="text-white" style={{ background: "#1a6b3c" }}>
            {project ? "Salvar" : "Cadastrar Projeto"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () => {
    Promise.all([base44.entities.Project.list(), base44.entities.Movement.list()]).then(([p, m]) => {
      setProjects(p); setMovements(m); setLoading(false);
    });
  };
  useEffect(load, []);

  const handleSave = async (data) => {
    editing ? await base44.entities.Project.update(editing.id, data) : await base44.entities.Project.create(data);
    setShowForm(false); setEditing(null); load();
  };

  const handleDelete = async (id) => {
    if (!confirm("Deseja excluir este projeto?")) return;
    await base44.entities.Project.delete(id);
    load();
  };

  const getProjectConsumption = (projectId) =>
    movements.filter(m => m.type === "saida" && m.project_id === projectId).reduce((s, m) => s + (m.total_value || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="text-white" style={{ background: "#1a6b3c" }}>
          <Plus className="w-4 h-4 mr-1" /> Novo Projeto
        </Button>
      </div>

      {showForm && <ProjectForm project={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />}

      {loading ? (
        <div className="flex items-center justify-center h-48"><div className="w-7 h-7 border-2 border-green-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 flex flex-col items-center justify-center h-48 text-gray-400">
          <FolderOpen className="w-10 h-10 mb-2 opacity-30" />
          <p className="text-sm">Nenhum projeto cadastrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => {
            const consumption = getProjectConsumption(p.id);
            const exitCount = movements.filter(m => m.type === "saida" && m.project_id === p.id).length;
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#e8f5ee" }}>
                    <FolderOpen className="w-5 h-5" style={{ color: "#1a6b3c" }} />
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[p.status]}`}>{p.status}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">{p.name}</h3>
                  {p.client && <p className="text-xs text-gray-400 mt-0.5">{p.client}</p>}
                </div>
                <div className="space-y-1.5 text-xs text-gray-500">
                  {p.location && <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3" />{p.location}</div>}
                  {p.area_ha && <div className="flex items-center gap-1.5"><span className="w-3 h-3 text-center">🌿</span>{p.area_ha} ha</div>}
                  {p.start_date && <div className="flex items-center gap-1.5"><Calendar className="w-3 h-3" />
                    {format(parseISO(p.start_date), "dd/MM/yyyy")}{p.end_date ? ` → ${format(parseISO(p.end_date), "dd/MM/yyyy")}` : ""}
                  </div>}
                </div>
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">{exitCount} saída(s) de estoque</span>
                    <span className="font-semibold text-gray-700">R$ {consumption.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditing(p); setShowForm(true); }} className="flex-1 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors">Editar</button>
                  <button onClick={() => handleDelete(p.id)} className="py-1.5 px-3 text-xs rounded-lg border border-red-100 hover:bg-red-50 text-red-500 transition-colors">Excluir</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}