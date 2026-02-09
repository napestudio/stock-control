"use client";

import { useState, useEffect } from "react";
import { getSessionDetails } from "@/app/actions/cash-session-actions";
import { getPaymentMethodLabel } from "@/types/cash-session";
import Modal from "@/components/ui/modal";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CashMovementType } from "@prisma/client";

type SessionDetails = Awaited<ReturnType<typeof getSessionDetails>>;
type Movement = SessionDetails["movements"][0];

interface MovementDetailsDialogProps {
  sessionId: string;
  movementId: string;
  onClose: () => void;
}

export default function MovementDetailsDialog({
  sessionId,
  movementId,
  onClose,
}: MovementDetailsDialogProps) {
  const [movement, setMovement] = useState<Movement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadMovement() {
      try {
        setLoading(true);
        const session = await getSessionDetails(sessionId);
        const foundMovement = session.movements.find(
          (m) => m.id === movementId,
        );

        if (!foundMovement) {
          throw new Error("Movimiento no encontrado");
        }

        setMovement(foundMovement);
        setError("");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error al cargar movimiento",
        );
      } finally {
        setLoading(false);
      }
    }

    loadMovement();
  }, [sessionId, movementId]);

  function getMovementTypeLabel(type: CashMovementType): string {
    switch (type) {
      case CashMovementType.OPENING:
        return "Apertura";
      case CashMovementType.DEPOSIT:
        return "Ingreso";
      case CashMovementType.WITHDRAWAL:
        return "Retiro";
      case CashMovementType.EXPENSE:
        return "Egreso";
      default:
        return "Desconocido";
    }
  }

  function getMovementTypeColor(type: CashMovementType): string {
    switch (type) {
      case CashMovementType.OPENING:
        return "text-blue-700 bg-blue-100 border-blue-200";
      case CashMovementType.DEPOSIT:
        return "text-green-700 bg-green-100 border-green-200";
      case CashMovementType.WITHDRAWAL:
        return "text-orange-700 bg-orange-100 border-orange-200";
      case CashMovementType.EXPENSE:
        return "text-red-700 bg-red-100 border-red-200";
      default:
        return "text-gray-700 bg-gray-100 border-gray-200";
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Detalles del Movimiento" size="sm">
      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {movement && (
        <div className="space-y-6">
          {/* Movement Type Badge */}
          <div className="flex justify-center">
            <span
              className={`text-sm font-medium px-4 py-2 rounded-lg border ${getMovementTypeColor(
                movement.type,
              )}`}
            >
              {getMovementTypeLabel(movement.type)}
            </span>
          </div>

          {/* Amount */}
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-1">Monto</p>
            <p className="text-3xl font-bold text-gray-900">
              ${movement.amount.toFixed(2)}
            </p>
          </div>

          {/* Details */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Método de Pago:</span>
              <span className="font-medium">
                {getPaymentMethodLabel(movement.paymentMethod)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Fecha y Hora:</span>
              <span className="text-sm font-medium">
                {format(new Date(movement.createdAt), "dd/MM/yyyy HH:mm:ss", {
                  locale: es,
                })}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">ID:</span>
              <span className="text-xs font-mono text-gray-500">
                {movement.id}
              </span>
            </div>
          </div>

          {/* Description */}
          {movement.description && (
            <div>
              <p className="text-sm text-gray-600 mb-2">Descripción:</p>
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <p className="text-sm text-gray-900">{movement.description}</p>
              </div>
            </div>
          )}

          {/* Close Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
