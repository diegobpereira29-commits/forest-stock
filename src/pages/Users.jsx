import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, Trash2, Shield, Eye, Package, Search } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const ROLE_CONFIG = {
  admin: { label: "Administrador", color: "bg-purple-100 text-purple-700", icon: Shield },
  almoxarife: { label: "Almoxarife", color: "bg-blue-100 text-blue-700", icon: Package },
  leitura: { label: "Somente Leitura", color: "bg-gray-100 text-gray-600", icon: Eye },
};

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("leitura");
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
    loadUsers();
  }, []);

  const loadUsers = () => {
    base44.entities.User.list().then(u => { setUsers(u); setLoading(false); });
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteMsg(null);
    await base44.users.inviteUser(inviteEmail.trim(), inviteRole);
    setInviteMsg({ type: "success", text: `Convite enviado para ${inviteEmail}` });
    setInviteEmail("");
    setInviting(false);
    loadUsers();
  };

  const handleChangeRole = async (userId, newRole) => {
    await base44.entities.User.update(userId, { role: newRole });
    loadUsers();
  };

  const filtered = users.filter(u =>
    !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (currentUser?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
        <Shield className="w-10 h-10 text-gray-300" />
        <p className="text-gray-500 font-medium">Acesso restrito</p>
        <p className="text-gray-400 text-sm">Apenas administradores podem gerenciar usuários.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Invite */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-green-700" /> Convidar Novo Usuário
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="E-mail do usuário"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            className="flex-1"
            type="email"
          />
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
          >
            <option value="leitura">Somente Leitura</option>
            <option value="almoxarife">Almoxarife</option>
            <option value="admin">Administrador</option>
          </select>
          <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="bg-green-700 hover:bg-green-800 text-white whitespace-nowrap">
            {inviting ? "Enviando..." : "Enviar Convite"}
          </Button>
        </div>
        {inviteMsg && (
          <p className={`mt-2 text-xs ${inviteMsg.type === "success" ? "text-green-600" : "text-red-500"}`}>{inviteMsg.text}</p>
        )}
      </div>

      {/* User list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Usuários Cadastrados</h2>
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input className="pl-8 text-xs h-8" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(u => {
              const rc = ROLE_CONFIG[u.role] || ROLE_CONFIG.leitura;
              const RIcon = rc.icon;
              const isSelf = u.email === currentUser?.email;
              return (
                <div key={u.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: "#1a6b3c" }}>
                    {(u.full_name?.[0] || u.email?.[0] || "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{u.full_name || "—"} {isSelf && <span className="text-xs text-gray-400">(você)</span>}</p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${rc.color}`}>
                      <RIcon className="w-3 h-3" />{rc.label}
                    </span>
                    {!isSelf && (
                      <select
                        value={u.role || "leitura"}
                        onChange={e => handleChangeRole(u.id, e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none"
                      >
                        <option value="leitura">Somente Leitura</option>
                        <option value="almoxarife">Almoxarife</option>
                        <option value="admin">Administrador</option>
                      </select>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 hidden sm:block whitespace-nowrap">
                    {u.created_date ? format(parseISO(u.created_date), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-10">Nenhum usuário encontrado</p>
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">{filtered.length} usuário(s)</p>
    </div>
  );
}