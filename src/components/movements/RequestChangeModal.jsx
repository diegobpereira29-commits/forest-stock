import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const MOVEMENT_FIELDS = [
  { key: "date", label: "Data", type: "date" },
  { key: "quantity", label: "Quantidade", type: "number" },
  { key: "unit_value", label: "Valor Unitário (R$)", type: "number" },
  { key: "supplier", label: "Fornecedor", type: "text" },
  { key: "invoice_number", label: "Nº Nota Fiscal", type: "text" },
  { key: "responsible", label: "Responsável", type: "text" },
  { key: "notes", label: "Observações", type: "text" },
];

export default function RequestChangeModal({ movement, currentUser, onClose, onSaved }) {
  const [reason, setReason] = useState("");
  const [changes, setChanges] = useState({});
  const [saving, setSaving] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [advancedJson, setAdvancedJson] = useState("{}");

  const setField = (k, v) => setChanges(prev => ({ ...prev, [k]: v }));

  const hasChanges = Object.values(changes).some(v => v !== "" && v !== undefined) || (advanced && advancedJson !== "{}");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setSaving(true);

    let proposed = changes;
    if (advanced) {
      try { proposed = JSON.parse(advancedJson); } catch { alert("JSON inválido"); setSaving(false); return; }
    }
    // Remove empty values
    proposed = Object.fromEntries(Object.entries(proposed).filter(([, v]) => v !== "" && v !== undefined));

    const summary = `${movement.type?.toUpperCase()} — ${movement.product_name || movement.product_id} | ${movement.date} | Qtd: ${movement.quantity}`;

    try {
      // 1. Create change request
      const req = await base44.entities.MovementChangeRequest.create({
        movement_id: movement.id,
        movement_summary: summary,
        reason: reason.trim(),
        proposed_changes: JSON.stringify(proposed),
        status: "pendente",
        requester_email: currentUser.email,
        requester_name: currentUser.full_name || currentUser.email,
      });

      // 2. Log activity
      await base44.entities.ActivityLog.create({
        user_email: currentUser.email,
        user_name: currentUser.full_name || currentUser.email,
        action: "Criou solicitação de alteração",
        module: "Movimentações",
        entity_id: req.id,
        details: `Movimento: ${summary} | Motivo: ${reason}`,
      });

      // 3. Call backend to send notifications
      await base44.functions.invoke("notifyChangeRequest", {
        request_id: req.id,
        requester_name: currentUser.full_name || currentUser.email,
        movement_summary: summary,
        reason: reason.trim(),
      });

      onSaved?.();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Solicitar Alteração</h2>
            <p className="text-xs text-gray-400 mt-0.5">{movement.product_name} — {movement.date}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex gap-2 text-xs text-amber-700">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Esta solicitação será enviada para revisão de um supervisor ou administrador antes de qualquer alteração ser aplicada.</span>
          </div>

          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Motivo da Alteração *</Label>
            <textarea
              required
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Descreva o motivo da alteração solicitada..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-gray-600">Campos a Alterar</Label>
              <button
                type="button"
                onClick={() => setAdvanced(a => !a)}
                className="text-xs text-blue-600 hover:underline"
              >
                {advanced ? "Formulário Guiado" : "Editor JSON Avançado"}
              </button>
            </div>

            {advanced ? (
              <textarea
                value={advancedJson}
                onChange={e => setAdvancedJson(e.target.value)}
                rows={6}
                className="w-full text-xs font-mono border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-gray-50"
                placeholder='{"quantity": 50, "notes": "Corrigido"}'
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {MOVEMENT_FIELDS.map(f => (
                  <div key={f.key}>
                    <Label className="text-xs text-gray-500 mb-1 block">{f.label}</Label>
                    <input
                      type={f.type}
                      value={changes[f.key] ?? ""}
                      onChange={e => setField(f.key, e.target.value)}
                      placeholder={`Atual: ${movement[f.key] ?? "—"}`}
                      className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              type="submit"
              disabled={saving || !reason.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {saving ? "Enviando..." : "Enviar Solicitação"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}