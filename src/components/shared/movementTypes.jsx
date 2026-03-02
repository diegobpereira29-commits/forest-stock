// Central mapping for movement type labels — corporate executive nomenclature
export const MOVEMENT_LABELS = {
  entrada:       "Entrada Operacional",
  saida:         "Saída Planejada",
  ajuste:        "Ajuste Manual",
  transferencia: "Transferência Interna",
  perda:         "Saída Extraordinária",
};

export function getMovementLabel(type) {
  return MOVEMENT_LABELS[type] || type;
}