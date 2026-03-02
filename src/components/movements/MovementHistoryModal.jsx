import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";

export default function MovementHistoryModal({ movementId, onClose }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    base44.entities.MovementVersion.filter({ movement_id: movementId }, "-version_number")
      .then(setVersions)
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [movementId]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Histórico de Alterações</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Nenhuma versão anterior registrada</p>
          ) : (
            versions.map((version) => (
              <div key={version.id} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Version Header */}
                <button
                  onClick={() => setExpandedId(expandedId === version.id ? null : version.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="text-left flex-1">
                    <h3 className="text-sm font-semibold text-gray-800">
                      Versão {version.version_number}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {version.changed_at ? format(parseISO(version.changed_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR }) : "Data indisponível"}
                    </p>
                  </div>
                  <div className="text-right mr-3">
                    <p className="text-xs font-medium text-gray-700">{version.changed_by || "Sistema"}</p>
                    <p className="text-xs text-gray-500">{version.change_summary || "Alteração"}</p>
                  </div>
                  {expandedId === version.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {/* Expanded Content */}
                {expandedId === version.id && (
                  <div className="px-4 py-4 border-t border-gray-100 bg-white space-y-3">
                    {/* Movement Data */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-600 mb-2">Dados da Movimentação</h4>
                      <pre className="bg-gray-50 p-3 rounded-lg text-xs overflow-x-auto text-gray-700 max-h-48 overflow-y-auto border border-gray-200">
                        {JSON.stringify(JSON.parse(version.movement_data || '{}'), null, 2)}
                      </pre>
                    </div>

                    {/* Reviewer Notes */}
                    {version.reviewer_notes && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-600 mb-1">Observações do Revisor</h4>
                        <p className="text-xs text-gray-700 bg-blue-50 p-2 rounded border border-blue-100">
                          {version.reviewer_notes}
                        </p>
                      </div>
                    )}

                    {/* Change Summary */}
                    {version.change_summary && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-600 mb-1">Motivo da Alteração</h4>
                        <p className="text-xs text-gray-700">{version.change_summary}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <Button onClick={onClose} variant="outline">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}