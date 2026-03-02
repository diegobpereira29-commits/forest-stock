import { useState } from "react";
import { X, CheckCircle, XCircle, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_STYLE = {
  pendente:  { bg: "bg-amber-100 text-amber-700",  icon: Clock,         label: "Pendente" },
  aprovada:  { bg: "bg-green-100 text-green-700",  icon: CheckCircle,   label: "Aprovada" },
  rejeitada: { bg: "bg-red-100 text-red-700",      icon: XCircle,       label: "Rejeitada" },
};

export default function RequestReviewModal({ request, canReview, currentUser, onClose, onUpdated }) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  let proposed = {};
  try { proposed = JSON.parse(request.proposed_changes || "{}"); } catch {}

  const handleDecision = async (decision) => {
    setSaving(true);
    try {
      // Call approveMovementChange to handle versioning and approval
      await base44.functions.invoke('approveMovementChange', {
        request_id: request.id,
        action: decision,
        reviewer_notes: notes
      });

      // Notify requester
      await base44.functions.invoke("notifyChangeRequest", {
        action: decision,
        request_id: request.id,
        requester_email: request.requester_email,
        requester_name: request.requester_name,
        movement_summary: request.movement_summary,
        reviewer_name: currentUser.full_name || currentUser.email,
        reviewer_notes: notes,
      });

      onUpdated?.();
    } finally {
      setSaving(false);
    }
  };

  const st = STATUS_STYLE[request.status] || STATUS_STYLE.pendente;
  const Icon = st.icon;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Detalhes da Solicitação</h2>
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${st.bg}`}>
              <Icon className="w-3 h-3" />{st.label}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Solicitante</p>
              <p className="font-medium text-gray-700">{request.requester_name || request.requester_email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Data</p>
              <p className="text-gray-600">{request.created_date ? format(parseISO(request.created_date), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-400 mb-0.5">Movimentação</p>
              <p className="text-gray-700 text-xs bg-gray-50 rounded-lg px-3 py-2 font-mono">{request.movement_summary || request.movement_id}</p>
            </div>
          </div>

          {/* Reason */}
          <div>
            <p className="text-xs text-gray-400 mb-1">Motivo da Solicitação</p>
            <p className="text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{request.reason}</p>
          </div>

          {/* Proposed changes */}
          {Object.keys(proposed).length > 0 && (
            <div>
              <p className="text-xs text-gray-400 mb-1 flex items-center gap-1"><FileText className="w-3 h-3" /> Alterações Propostas</p>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 space-y-1">
                {Object.entries(proposed).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-gray-500 font-medium">{k}</span>
                    <span className="text-gray-800">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviewer info (if already reviewed) */}
          {request.status !== "pendente" && (
            <div className="bg-gray-50 rounded-lg px-3 py-2 space-y-1 text-xs">
              <p><span className="text-gray-400">Revisor:</span> <span className="text-gray-700">{request.reviewer_name}</span></p>
              <p><span className="text-gray-400">Data revisão:</span> <span className="text-gray-600">{request.reviewed_at}</span></p>
              {request.reviewer_notes && <p><span className="text-gray-400">Observações:</span> <span className="text-gray-700">{request.reviewer_notes}</span></p>}
            </div>
          )}

          {/* Review actions */}
          {canReview && request.status === "pendente" && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Observações do Revisor</Label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Opcional — justificativa da decisão..."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleDecision("rejeitada")}
                  disabled={saving}
                  className="border-red-200 text-red-600 hover:bg-red-50"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Rejeitar
                </Button>
                <Button
                  onClick={() => handleDecision("aprovada")}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> {saving ? "Salvando..." : "Aprovar"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}