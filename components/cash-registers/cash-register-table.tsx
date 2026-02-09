"use client";

import Badge from "@/components/ui/badge";
import type { CashRegisterWithStats } from "@/types/cash-register";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface CashRegisterTableProps {
  registers: CashRegisterWithStats[];
  onEdit: (register: CashRegisterWithStats) => void;
  onDelete: (register: CashRegisterWithStats) => void;
  onOpenSession: (registerId: string) => void;
  onViewSession?: (sessionId: string) => void;
}

export default function CashRegisterTable({
  registers,
  onEdit,
  onDelete,
  onOpenSession,
  onViewSession,
}: CashRegisterTableProps) {
  if (registers.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          No hay cajas registradoras
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Comienza creando una nueva caja registradora.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Nombre
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Sesión Activa
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {registers.map((register) => {
            const activeSession = register.sessions[0];

            return (
              <tr key={register.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {register.name}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {register.active ? (
                    <Badge variant="success">Activa</Badge>
                  ) : (
                    <Badge variant="neutral">Inactiva</Badge>
                  )}
                </td>
                <td className="px-6 py-4">
                  {activeSession ? (
                    <button
                      onClick={() => onViewSession?.(activeSession.id)}
                      className="text-left text-sm hover:bg-blue-50 p-2 -m-2 rounded transition-colors w-full"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="success">ABIERTA</Badge>
                        <svg
                          className="h-4 w-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                      <div className="text-gray-600">
                        Usuario:{" "}
                        {activeSession.user.name || activeSession.user.email}
                      </div>
                      <div className="text-gray-500 text-xs">
                        Desde:{" "}
                        {formatDistanceToNow(new Date(activeSession.openedAt), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </div>
                    </button>
                  ) : (
                    <Badge variant="neutral">Cerrada</Badge>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-2">
                    {!activeSession && register.active && (
                      <button
                        onClick={() => onOpenSession(register.id)}
                        className="text-green-600 hover:text-green-900 font-medium"
                      >
                        Iniciar Arqueo
                      </button>
                    )}
                    <button
                      onClick={() => onEdit(register)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onDelete(register)}
                      className="text-red-600 hover:text-red-900"
                      disabled={activeSession !== undefined}
                      title={
                        activeSession
                          ? "No se puede eliminar una caja con sesión activa"
                          : "Eliminar caja"
                      }
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
