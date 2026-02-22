"use client";

import {
  closeCashSession,
  getSessionClosingSummary,
  getSessionDetails,
} from "@/app/actions/cash-session-actions";
import Badge from "@/components/ui/badge";
import Sidebar from "@/components/ui/sidebar";
import {
  closeSessionSchema,
  type CloseSessionInput,
} from "@/lib/validations/cash-session-schema";
import type { SessionClosingSummary } from "@/types/cash-session";
import { getPaymentMethodLabel } from "@/types/cash-session";
import { zodResolver } from "@hookform/resolvers/zod";
import { CashMovementType, PaymentMethod } from "@prisma/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

type SessionDetails = Awaited<ReturnType<typeof getSessionDetails>>;

interface SessionDetailsSidebarProps {
  sessionId: string;
  onClose: () => void;
  onViewMovement?: (movementId: string) => void;
  onCloseSessionSuccess?: () => void;
}

export default function SessionDetailsSidebar({
  sessionId,
  onClose,
  onViewMovement,
  onCloseSessionSuccess,
}: SessionDetailsSidebarProps) {
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});
  const [closingSummary, setClosingSummary] =
    useState<SessionClosingSummary | null>(null);
  const [loadingCloseSummary, setLoadingCloseSummary] = useState(false);
  const [closingSession, setClosingSession] = useState(false);

  const {
    register: registerClose,
    handleSubmit: handleSubmitClose,
    control: controlClose,
    reset: resetClose,
    formState: { errors: closeErrors },
  } = useForm<CloseSessionInput>({
    resolver: zodResolver(closeSessionSchema),
    defaultValues: {
      sessionId,
      closingAmountCash: 0, // CASH is always required (per plan)
      closingAmountCreditCard: undefined,
      closingAmountDebitCard: undefined,
      closingAmountTransfer: undefined,
      closingAmountCheck: undefined,
      closingNotes: "",
    },
  });

  // Watch all closing amounts for real-time difference calculation
  const watchedAmounts = useWatch({ control: controlClose });

  useEffect(() => {
    async function loadSession() {
      try {
        setLoading(true);
        const data = await getSessionDetails(sessionId);
        setSession(data);
        setError("");

        // Load closing summary if session is not closed
        if (!data.closedAt) {
          setLoadingCloseSummary(true);
          try {
            const summary = await getSessionClosingSummary(sessionId);
            setClosingSummary(summary);
          } catch (err) {
            console.error("Error loading closing summary:", err);
          } finally {
            setLoadingCloseSummary(false);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar sesión");
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, [sessionId]);

  // Pre-fill closing amounts with expected values when summary loads
  useEffect(() => {
    if (!closingSummary) return;
    resetClose({
      sessionId,
      closingAmountCash: closingSummary.expectedCash,
      closingAmountCreditCard:
        closingSummary.expectedCreditCard > 0.01
          ? closingSummary.expectedCreditCard
          : undefined,
      closingAmountDebitCard:
        closingSummary.expectedDebitCard > 0.01
          ? closingSummary.expectedDebitCard
          : undefined,
      closingAmountTransfer:
        closingSummary.expectedTransfer > 0.01
          ? closingSummary.expectedTransfer
          : undefined,
      closingAmountCheck:
        closingSummary.expectedCheck > 0.01
          ? closingSummary.expectedCheck
          : undefined,
      closingNotes: "",
    });
  }, [closingSummary, sessionId, resetClose]);

  // Determine which payment methods are used (have transactions)
  const usedPaymentMethods = useMemo(() => {
    if (!closingSummary) return [];

    const methods: Array<{
      method: PaymentMethod;
      label: string;
      fieldName: keyof CloseSessionInput;
      expected: number;
    }> = [];

    methods.push({
      method: PaymentMethod.CASH,
      label: "Efectivo",
      fieldName: "closingAmountCash",
      expected: closingSummary.expectedCash,
    });

    if (closingSummary.expectedCreditCard > 0.01) {
      methods.push({
        method: PaymentMethod.CREDIT_CARD,
        label: "Tarjeta de Crédito",
        fieldName: "closingAmountCreditCard",
        expected: closingSummary.expectedCreditCard,
      });
    }

    if (closingSummary.expectedDebitCard > 0.01) {
      methods.push({
        method: PaymentMethod.DEBIT_CARD,
        label: "Tarjeta de Débito",
        fieldName: "closingAmountDebitCard",
        expected: closingSummary.expectedDebitCard,
      });
    }

    if (closingSummary.expectedTransfer > 0.01) {
      methods.push({
        method: PaymentMethod.TRANSFER,
        label: "Transferencia",
        fieldName: "closingAmountTransfer",
        expected: closingSummary.expectedTransfer,
      });
    }

    if (closingSummary.expectedCheck > 0.01) {
      methods.push({
        method: PaymentMethod.CHECK,
        label: "Cheque",
        fieldName: "closingAmountCheck",
        expected: closingSummary.expectedCheck,
      });
    }

    return methods;
  }, [closingSummary]);

  // Calculate differences per method
  const verifications = useMemo(() => {
    return usedPaymentMethods.map((methodInfo) => {
      const actual =
        (watchedAmounts[methodInfo.fieldName] as number | undefined) || 0;
      const expected = methodInfo.expected;
      const difference = actual - expected;
      const absDiff = Math.abs(difference);

      return {
        ...methodInfo,
        actual,
        difference,
        hasDiscrepancy: absDiff > 0.01,
        discrepancyLevel:
          absDiff < 0.01
            ? ("none" as const)
            : absDiff < 10
              ? ("minor" as const)
              : ("major" as const),
      };
    });
  }, [usedPaymentMethods, watchedAmounts]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalExpected = verifications.reduce((sum, v) => sum + v.expected, 0);
    const totalActual = verifications.reduce((sum, v) => sum + v.actual, 0);
    const totalDifference = totalActual - totalExpected;

    return { totalExpected, totalActual, totalDifference };
  }, [verifications]);

  // Color coding helper
  function getDifferenceColor(level: "none" | "minor" | "major") {
    switch (level) {
      case "none":
        return "text-green-700 bg-green-50 border-green-200";
      case "minor":
        return "text-yellow-700 bg-yellow-50 border-yellow-200";
      case "major":
        return "text-red-700 bg-red-50 border-red-200";
    }
  }

  function toggleSection(section: string) {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }

  async function onSubmitClose(data: CloseSessionInput) {
    setError("");
    setClosingSession(true);

    try {
      await closeCashSession(data);
      onCloseSessionSuccess?.();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al cerrar la sesión",
      );
    } finally {
      setClosingSession(false);
    }
  }

  // Group movements by type and payment method, including sales
  function groupMovementsByPaymentMethod(
    movements: SessionDetails["movements"],
    salesByMethod: SessionDetails["salesByPaymentMethod"],
  ) {
    const ingreso: Record<
      string,
      { total: number; movements: typeof movements; salesTotal: number }
    > = {};
    const egreso: Record<
      string,
      { total: number; movements: typeof movements }
    > = {};

    let ingresoTotal = 0;
    let egresoTotal = 0;

    // Add sales to ingreso by payment method
    const salesMap = {
      [getPaymentMethodLabel(PaymentMethod.CASH)]: salesByMethod.cash,
      [getPaymentMethodLabel(PaymentMethod.CREDIT_CARD)]:
        salesByMethod.creditCard,
      [getPaymentMethodLabel(PaymentMethod.DEBIT_CARD)]:
        salesByMethod.debitCard,
      [getPaymentMethodLabel(PaymentMethod.TRANSFER)]: salesByMethod.transfer,
      [getPaymentMethodLabel(PaymentMethod.CHECK)]: salesByMethod.check,
    };

    Object.entries(salesMap).forEach(([paymentMethod, salesTotal]) => {
      if (salesTotal > 0) {
        if (!ingreso[paymentMethod]) {
          ingreso[paymentMethod] = { total: 0, movements: [], salesTotal: 0 };
        }
        ingreso[paymentMethod].salesTotal = salesTotal;
        ingreso[paymentMethod].total += salesTotal;
        ingresoTotal += salesTotal;
      }
    });

    // Process movements
    movements.forEach((movement) => {
      const amount = movement.amount;
      const paymentMethod = getPaymentMethodLabel(movement.paymentMethod);

      // INGRESO: INCOME and SALE movements
      if (movement.type === CashMovementType.INCOME || movement.type === CashMovementType.SALE) {
        if (!ingreso[paymentMethod]) {
          ingreso[paymentMethod] = { total: 0, movements: [], salesTotal: 0 };
        }
        ingreso[paymentMethod].total += amount;
        ingreso[paymentMethod].movements.push(movement);
        ingresoTotal += amount;
      }
      // EGRESO: EXPENSE and REFUND movements
      else if (movement.type === CashMovementType.EXPENSE || movement.type === CashMovementType.REFUND) {
        if (!egreso[paymentMethod]) {
          egreso[paymentMethod] = { total: 0, movements: [] };
        }
        egreso[paymentMethod].total += amount;
        egreso[paymentMethod].movements.push(movement);
        egresoTotal += amount;
      }
      // Handle deprecated types for archived sessions
      else if (movement.type === CashMovementType.DEPOSIT) {
        if (!ingreso[paymentMethod]) {
          ingreso[paymentMethod] = { total: 0, movements: [], salesTotal: 0 };
        }
        ingreso[paymentMethod].total += amount;
        ingreso[paymentMethod].movements.push(movement);
        ingresoTotal += amount;
      } else if (movement.type === CashMovementType.WITHDRAWAL) {
        if (!egreso[paymentMethod]) {
          egreso[paymentMethod] = { total: 0, movements: [] };
        }
        egreso[paymentMethod].total += amount;
        egreso[paymentMethod].movements.push(movement);
        egresoTotal += amount;
      }
    });

    return { ingreso, egreso, ingresoTotal, egresoTotal };
  }

  function getMovementTypeLabel(type: CashMovementType): string {
    switch (type) {
      case CashMovementType.INCOME:
        return "Ingreso Manual";
      case CashMovementType.EXPENSE:
        return "Egreso Manual";
      case CashMovementType.SALE:
        return "Venta";
      case CashMovementType.REFUND:
        return "Devolución";
      // Deprecated types for archived sessions
      case CashMovementType.OPENING:
        return "Apertura";
      case CashMovementType.DEPOSIT:
        return "Depósito";
      case CashMovementType.WITHDRAWAL:
        return "Retiro";
      default:
        return "Desconocido";
    }
  }

  function getMovementTypeColor(type: CashMovementType): string {
    switch (type) {
      case CashMovementType.INCOME:
        return "text-green-700 bg-green-50";
      case CashMovementType.SALE:
        return "text-blue-700 bg-blue-50";
      case CashMovementType.EXPENSE:
        return "text-red-700 bg-red-50";
      case CashMovementType.REFUND:
        return "text-orange-700 bg-orange-50";
      // Deprecated types for archived sessions
      case CashMovementType.OPENING:
        return "text-blue-700 bg-blue-50";
      case CashMovementType.DEPOSIT:
        return "text-green-700 bg-green-50";
      case CashMovementType.WITHDRAWAL:
        return "text-orange-700 bg-orange-50";
      default:
        return "text-gray-700 bg-gray-50";
    }
  }

  return (
    <Sidebar isOpen onClose={onClose} title="Detalles de Sesión" size="lg">
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

      {session &&
        (() => {
          const { ingreso, egreso, ingresoTotal, egresoTotal } =
            groupMovementsByPaymentMethod(
              session.movements.filter(
                (m) => m.type !== CashMovementType.OPENING,
              ),
              session.salesByPaymentMethod,
            );
          const total = session.openingAmount + ingresoTotal - egresoTotal;

          return (
            <div className="space-y-4">
              {/* Session Info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Caja:</span>
                  <span className="font-medium">
                    {session.cashRegister.name}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Usuario:</span>
                  <span className="font-medium">
                    {session.user.name || session.user.email}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Estado:</span>
                  {session.closedAt ? (
                    <Badge variant="neutral">Cerrada</Badge>
                  ) : (
                    <Badge variant="success">Abierta</Badge>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Apertura:</span>
                  <span className="text-sm">
                    {format(new Date(session.openedAt), "dd/MM/yyyy HH:mm", {
                      locale: es,
                    })}
                  </span>
                </div>
                {session.closedAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Cierre:</span>
                    <span className="text-sm">
                      {format(new Date(session.closedAt), "dd/MM/yyyy HH:mm", {
                        locale: es,
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* SEGÚN SISTEMA Section */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                  Según Sistema
                </h4>

                {/* MONTO INICIAL */}
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-medium text-gray-700">
                    MONTO INICIAL
                  </span>
                  <span className="font-semibold">
                    ${session.openingAmount.toFixed(2)}
                  </span>
                </div>

                {/* INGRESO - Fixed Title (includes sales and deposits) */}
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm font-medium text-green-700">
                      INGRESO
                    </span>
                    <span className="font-semibold text-green-700">
                      ${ingresoTotal.toFixed(2)}
                    </span>
                  </div>

                  {/* Payment Method Accordions for INGRESO */}
                  {Object.entries(ingreso).length > 0 ? (
                    <div className="space-y-2 mt-2">
                      {Object.entries(ingreso).map(([paymentMethod, data]) => {
                        const sectionKey = `ingreso-${paymentMethod}`;
                        const isExpanded = expandedSections[sectionKey];

                        return (
                          <div
                            key={sectionKey}
                            className="border border-gray-200 rounded-lg overflow-hidden"
                          >
                            {/* Payment Method Header (Collapsible) */}
                            <button
                              onClick={() => toggleSection(sectionKey)}
                              className="w-full flex justify-between items-center px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <svg
                                  className={`h-4 w-4 text-gray-500 transition-transform ${
                                    isExpanded ? "rotate-90" : ""
                                  }`}
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
                                <span className="text-sm font-medium text-gray-700">
                                  {paymentMethod}
                                </span>
                                <span className="text-xs text-gray-500">
                                  (
                                  {data.movements.length +
                                    (data.salesTotal > 0 ? 1 : 0)}
                                  )
                                </span>
                              </div>
                              <span className="text-sm font-semibold text-green-600">
                                ${data.total.toFixed(2)}
                              </span>
                            </button>

                            {/* Sales and Movement Cards */}
                            {isExpanded && (
                              <div className="p-2 space-y-2 bg-white">
                                {/* Sales Total Card (if any) */}
                                {data.salesTotal > 0 && (
                                  <div className="bg-white border border-green-200 rounded-md p-3">
                                    <div className="flex justify-between items-start mb-2">
                                      <span className="text-xs font-medium px-2 py-1 rounded text-green-700 bg-green-50">
                                        Ventas
                                      </span>
                                      <span className="text-sm font-semibold text-green-700">
                                        +${data.salesTotal.toFixed(2)}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                      Ingresos por ventas realizadas en esta
                                      sesión
                                    </p>
                                  </div>
                                )}

                                {/* Deposit Movement Cards */}
                                {data.movements.map((movement) => (
                                  <button
                                    key={movement.id}
                                    onClick={() =>
                                      onViewMovement?.(movement.id)
                                    }
                                    className="w-full text-left bg-white border border-gray-200 rounded-md p-3 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                                  >
                                    <div className="flex justify-between items-start mb-2">
                                      <span
                                        className={`text-xs font-medium px-2 py-1 rounded ${getMovementTypeColor(
                                          movement.type,
                                        )}`}
                                      >
                                        {getMovementTypeLabel(movement.type)}
                                      </span>
                                      <span className="text-sm font-semibold text-green-700">
                                        +${movement.amount.toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-gray-600">
                                      <span>
                                        {format(
                                          new Date(movement.createdAt),
                                          "dd/MM/yy HH:mm",
                                          {
                                            locale: es,
                                          },
                                        )}
                                      </span>
                                    </div>
                                    {movement.description && (
                                      <p className="text-xs text-gray-500 mt-1 truncate">
                                        {movement.description}
                                      </p>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic pl-4 py-2">
                      No hay ingresos registrados
                    </p>
                  )}
                </div>

                {/* EGRESO - Fixed Title */}
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm font-medium text-red-700">
                      EGRESO
                    </span>
                    <span className="font-semibold text-red-700">
                      -${egresoTotal.toFixed(2)}
                    </span>
                  </div>

                  {/* Payment Method Accordions for EGRESO */}
                  {Object.entries(egreso).length > 0 ? (
                    <div className="space-y-2 mt-2">
                      {Object.entries(egreso).map(([paymentMethod, data]) => {
                        const sectionKey = `egreso-${paymentMethod}`;
                        const isExpanded = expandedSections[sectionKey];

                        return (
                          <div
                            key={sectionKey}
                            className="border border-gray-200 rounded-lg overflow-hidden"
                          >
                            {/* Payment Method Header (Collapsible) */}
                            <button
                              onClick={() => toggleSection(sectionKey)}
                              className="w-full flex justify-between items-center px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <svg
                                  className={`h-4 w-4 text-gray-500 transition-transform ${
                                    isExpanded ? "rotate-90" : ""
                                  }`}
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
                                <span className="text-sm font-medium text-gray-700">
                                  {paymentMethod}
                                </span>
                                <span className="text-xs text-gray-500">
                                  ({data.movements.length})
                                </span>
                              </div>
                              <span className="text-sm font-semibold text-red-600">
                                -${data.total.toFixed(2)}
                              </span>
                            </button>

                            {/* Movement Cards */}
                            {isExpanded && (
                              <div className="p-2 space-y-2 bg-white">
                                {data.movements.map((movement) => (
                                  <button
                                    key={movement.id}
                                    onClick={() =>
                                      onViewMovement?.(movement.id)
                                    }
                                    className="w-full text-left bg-white border border-gray-200 rounded-md p-3 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                                  >
                                    <div className="flex justify-between items-start mb-2">
                                      <span
                                        className={`text-xs font-medium px-2 py-1 rounded ${getMovementTypeColor(
                                          movement.type,
                                        )}`}
                                      >
                                        {getMovementTypeLabel(movement.type)}
                                      </span>
                                      <span className="text-sm font-semibold text-red-700">
                                        -${movement.amount.toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-gray-600">
                                      <span>
                                        {format(
                                          new Date(movement.createdAt),
                                          "dd/MM/yy HH:mm",
                                          {
                                            locale: es,
                                          },
                                        )}
                                      </span>
                                    </div>
                                    {movement.description && (
                                      <p className="text-xs text-gray-500 mt-1 truncate">
                                        {movement.description}
                                      </p>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic pl-4 py-2">
                      No hay egresos registrados
                    </p>
                  )}
                </div>

                {/* Total */}
                <div className="border-t-2 border-gray-300 mt-3 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-900">
                      Total
                    </span>
                    <span className="text-lg font-bold text-gray-900">
                      ${total.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* SEGÚN USUARIO Section (if session is closed) */}
              {session.closedAt && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                    Según Usuario
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Efectivo *</span>
                      <span className="text-gray-500">
                        Esperado: $
                        {session.expectedAmount?.toFixed(2) || "0.00"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">
                        Efectivo Contado:
                      </span>
                      <span className="font-semibold text-lg">
                        ${session.closingAmount?.toFixed(2) || "0.00"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                      <span className="text-sm font-bold">Total</span>
                      <span className="text-lg font-bold">
                        ${session.closingAmount?.toFixed(2) || "0.00"}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t-2 border-red-300 bg-red-50 -mx-4 px-4 py-2 rounded-b-lg">
                      <span className="font-bold text-red-700">Diferencia</span>
                      <span
                        className={`font-bold text-lg ${
                          (session.difference || 0) >= 0
                            ? "text-green-700"
                            : "text-red-700"
                        }`}
                      >
                        {(session.difference || 0) >= 0 ? "" : "-"}$
                        {Math.abs(session.difference || 0).toFixed(2)}
                      </span>
                    </div>
                    {session.closingNotes && (
                      <div className="pt-3 border-t border-gray-200">
                        <span className="text-sm text-gray-600">Comentarios:</span>
                        <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">{session.closingNotes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SEGÚN USUARIO Section (Close Session Form - if session is open) */}
              {!session.closedAt && closingSummary && (
                <form
                  onSubmit={handleSubmitClose(onSubmitClose)}
                  className="space-y-4"
                >
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                      Según Usuario
                    </h4>

                    {/* Info box */}
                    {/* <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                      <p className="font-medium mb-1">
                        Ingrese los montos verificados:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>Efectivo: Cuente el dinero físico en caja</li>
                        <li>
                          Tarjetas: Verifique totales en terminal bancaria
                        </li>
                        <li>Transferencias: Revise confirmaciones recibidas</li>
                        <li>Cheques: Cuente los cheques recibidos</li>
                      </ul>
                    </div> */}

                    {/* Input fields for each used payment method */}
                    <div className="space-y-4 mb-4">
                      {verifications.map((verification) => (
                        <div key={verification.method} className="space-y-2">
                          {/* Label with expected amount */}
                          <div className="flex justify-between items-baseline">
                            <label
                              htmlFor={verification.fieldName}
                              className="block text-sm font-medium text-gray-700"
                            >
                              {verification.label}{" "}
                              <span className="text-red-500">*</span>
                            </label>
                            <span className="text-xs text-gray-600">
                              Esperado:{" "}
                              <span className="font-semibold">
                                ${verification.expected.toFixed(2)}
                              </span>
                            </span>
                          </div>

                          {/* Input field */}
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                              $
                            </span>
                            <input
                              id={verification.fieldName}
                              type="number"
                              step="0.01"
                              min="0"
                              {...registerClose(verification.fieldName, {
                                valueAsNumber: true,
                              })}
                              className="block w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                              placeholder="0.00"
                            />
                          </div>

                          {/* Real-time difference display */}
                          {verification.actual > 0 && (
                            <div
                              className={`flex justify-between items-center px-3 py-2 rounded-md border text-sm ${getDifferenceColor(
                                verification.discrepancyLevel,
                              )}`}
                            >
                              <span>Diferencia:</span>
                              <span className="font-semibold">
                                {verification.difference >= 0 ? "+" : ""}$
                                {verification.difference.toFixed(2)}
                              </span>
                            </div>
                          )}

                          {closeErrors[verification.fieldName] && (
                            <p className="text-sm text-red-600">
                              {closeErrors[verification.fieldName]?.message}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Total summary */}
                    <div className="border-t pt-4 space-y-3">
                      <div className="flex justify-between text-sm text-gray-700">
                        <span>Total Esperado:</span>
                        <span className="font-semibold">
                          ${totals.totalExpected.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm text-gray-700">
                        <span>Total Ingresado:</span>
                        <span className="font-semibold">
                          ${totals.totalActual.toFixed(2)}
                        </span>
                      </div>
                      <div
                        className={`flex justify-between items-center px-4 py-3 rounded-lg border-2 font-semibold ${
                          Math.abs(totals.totalDifference) < 0.01
                            ? "text-green-700 bg-green-50 border-green-300"
                            : Math.abs(totals.totalDifference) < 10
                              ? "text-yellow-700 bg-yellow-50 border-yellow-300"
                              : "text-red-700 bg-red-50 border-red-300"
                        }`}
                      >
                        <span>Diferencia Total:</span>
                        <span className="text-lg">
                          {totals.totalDifference >= 0 ? "+" : ""}$
                          {totals.totalDifference.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Closing Notes (optional) */}
                    <div className="mt-4">
                      <label
                        htmlFor="closingNotes"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Comentarios (opcional)
                      </label>
                      <textarea
                        id="closingNotes"
                        {...registerClose("closingNotes")}
                        rows={3}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        placeholder="Ej: Diferencia explicada por billetes rotos, fondo de cambio faltante, etc."
                      />
                      {closeErrors.closingNotes && (
                        <p className="mt-1 text-sm text-red-600">
                          {closeErrors.closingNotes.message}
                        </p>
                      )}
                    </div>

                    {/* Warning if major discrepancies */}
                    {verifications.some(
                      (v) => v.discrepancyLevel === "major",
                    ) && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-300 rounded-lg text-sm text-red-800">
                        <p className="font-semibold">
                          ⚠️ Atención: Discrepancia Significativa
                        </p>
                        <p className="mt-1">
                          Se detectaron diferencias mayores a $10. Por favor agregue un comentario explicando la discrepancia.
                        </p>
                      </div>
                    )}

                    {/* Submit button */}
                    <div className="mt-6 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        disabled={closingSession}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={closingSession || loadingCloseSummary}
                        className="px-6 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                        {closingSession ? "Finalizando..." : "Finalizar Arqueo"}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          );
        })()}
    </Sidebar>
  );
}
