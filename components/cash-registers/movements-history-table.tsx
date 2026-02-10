"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CashMovementType, PaymentMethod } from "@prisma/client";
import { getPaymentMethodLabel } from "@/types/cash-session";
import Badge from "@/components/ui/badge";

type Movement = {
  id: string;
  type: CashMovementType;
  paymentMethod: PaymentMethod;
  amount: number;
  description: string | null;
  createdAt: string;
  session: {
    id: string;
    cashRegister: { id: string; name: string };
    user: { id: string; name: string | null; email: string };
  };
};

interface Props {
  movements: Movement[];
  loading: boolean;
}

function getMovementTypeLabel(type: CashMovementType): string {
  switch (type) {
    case CashMovementType.OPENING:
      return "Apertura";
    case CashMovementType.DEPOSIT:
      return "Depósito";
    case CashMovementType.WITHDRAWAL:
      return "Retiro";
    case CashMovementType.EXPENSE:
      return "Gasto";
    case CashMovementType.REFUND:
      return "Reembolso";
    case CashMovementType.ADJUSTMENT:
      return "Ajuste";
    case CashMovementType.CLOSING:
      return "Cierre";
    default:
      return "Desconocido";
  }
}

function getMovementTypeColor(
  type: CashMovementType
): "success" | "neutral" | "error" {
  switch (type) {
    case CashMovementType.DEPOSIT:
    case CashMovementType.OPENING:
      return "success";
    case CashMovementType.WITHDRAWAL:
    case CashMovementType.EXPENSE:
    case CashMovementType.CLOSING:
      return "error";
    default:
      return "neutral";
  }
}

export default function MovementsHistoryTable({ movements, loading }: Props) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (movements.length === 0) {
    return (
      <div className="bg-white p-8 rounded-lg border text-center text-gray-500">
        No se encontraron movimientos con los filtros seleccionados.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fecha
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tipo
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Método de Pago
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Monto
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Caja
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Usuario
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Descripción
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {movements.map((movement) => (
              <tr key={movement.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm whitespace-nowrap text-gray-900">
                  {format(new Date(movement.createdAt), "dd/MM/yyyy HH:mm", {
                    locale: es,
                  })}
                </td>
                <td className="px-4 py-3 text-sm">
                  <Badge variant={getMovementTypeColor(movement.type)}>
                    {getMovementTypeLabel(movement.type)}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {getPaymentMethodLabel(movement.paymentMethod)}
                </td>
                <td className="px-4 py-3 text-sm text-right font-medium">
                  <span
                    className={
                      movement.type === CashMovementType.DEPOSIT ||
                      movement.type === CashMovementType.OPENING
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    {movement.type === CashMovementType.DEPOSIT ||
                    movement.type === CashMovementType.OPENING
                      ? "+"
                      : "-"}
                    ${movement.amount.toFixed(2)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {movement.session.cashRegister.name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {movement.session.user.name || movement.session.user.email}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                  {movement.description || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
