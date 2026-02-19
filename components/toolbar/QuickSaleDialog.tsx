"use client";

import { useRef, useState, useTransition } from "react";
import { PaymentMethod } from "@prisma/client";
import {
  getVariantBySkuForSale,
  quickSale,
} from "@/app/actions/sale-actions";
import Modal from "@/components/ui/modal";
import type { ProductVariantSearchResult } from "@/types/sale";
import type { VariantScanDetail } from "@/types/toolbar";
import type { QuickSaleInput } from "@/lib/validations/sale-schema";

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CREDIT_CARD: "Tarjeta de crédito",
  DEBIT_CARD: "Tarjeta de débito",
  TRANSFER: "Transferencia",
  CHECK: "Cheque",
};

interface QuickSaleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialVariant?: VariantScanDetail | null;
}

export default function QuickSaleDialog({
  isOpen,
  onClose,
  initialVariant,
}: QuickSaleDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [scanInput, setScanInput] = useState("");
  const [variant, setVariant] = useState<ProductVariantSearchResult | null>(
    initialVariant
      ? {
          id: initialVariant.id,
          sku: initialVariant.sku,
          displayName: initialVariant.displayName,
          productName: initialVariant.productName,
          price: initialVariant.price,
          costPrice: initialVariant.costPrice,
          stockQuantity: initialVariant.stockQuantity,
        }
      : null,
  );
  const [lookupError, setLookupError] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    PaymentMethod.CASH,
  );
  const [successMessage, setSuccessMessage] = useState("");
  const [saleError, setSaleError] = useState("");

  const [isLooking, startLookup] = useTransition();
  const [isSelling, startSale] = useTransition();

  function handleClose() {
    setScanInput("");
    setVariant(initialVariant
      ? {
          id: initialVariant.id,
          sku: initialVariant.sku,
          displayName: initialVariant.displayName,
          productName: initialVariant.productName,
          price: initialVariant.price,
          costPrice: initialVariant.costPrice,
          stockQuantity: initialVariant.stockQuantity,
        }
      : null);
    setLookupError("");
    setQuantity(1);
    setPaymentMethod(PaymentMethod.CASH);
    setSaleError("");
    setSuccessMessage("");
    onClose();
  }

  function handleScanInput(value: string) {
    setScanInput(value);
    setVariant(null);
    setLookupError("");
    setSuccessMessage("");
    setSaleError("");
  }

  function handleLookup() {
    const sku = scanInput.trim();
    if (!sku) return;

    startLookup(async () => {
      try {
        const result = await getVariantBySkuForSale(sku);
        if (!result) {
          setLookupError("Producto no encontrado o no disponible.");
          return;
        }
        setVariant(result);
        setLookupError("");
      } catch (err) {
        setLookupError(
          err instanceof Error ? err.message : "Error al buscar el producto.",
        );
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleLookup();
    }
  }

  function handleCompleteSale() {
    if (!variant) return;

    const data: QuickSaleInput = {
      productVariantId: variant.id,
      quantity,
      paymentMethod,
    };

    startSale(async () => {
      try {
        await quickSale(data);
        const label = variant.displayName || variant.productName;
        setSuccessMessage(
          `Venta completada: ${quantity}x ${label} — $${(variant.price * quantity).toFixed(2)}`,
        );
        setScanInput("");
        setVariant(null);
        setQuantity(1);
        setPaymentMethod(PaymentMethod.CASH);
        setSaleError("");
        setTimeout(() => inputRef.current?.focus(), 100);
      } catch (err) {
        setSaleError(
          err instanceof Error ? err.message : "Error al completar la venta.",
        );
      }
    });
  }

  const total = variant ? variant.price * quantity : 0;
  const stockOk = variant ? variant.stockQuantity >= quantity : false;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Venta rápida" size="sm">
      <div className="space-y-4">
        {/* Success banner */}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
            {successMessage}
          </div>
        )}

        {/* SKU input – hidden if variant came from QR scanner */}
        {!initialVariant && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              SKU / Código QR
            </label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={scanInput}
                autoFocus
                onChange={(e) => handleScanInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escanea el QR o escribe el SKU..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={isLooking || isSelling}
              />
              <button
                onClick={handleLookup}
                disabled={!scanInput.trim() || isLooking || isSelling}
                className="px-3 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLooking ? "..." : "Buscar"}
              </button>
            </div>
            {lookupError && (
              <p className="text-sm text-red-600">{lookupError}</p>
            )}
          </div>
        )}

        {/* Product info + sale form */}
        {variant && (
          <div className="space-y-4">
            <div className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-500 font-mono">{variant.sku}</p>
                <p className="text-sm font-semibold text-gray-900">
                  {variant.displayName || variant.productName}
                </p>
                {variant.displayName && (
                  <p className="text-xs text-gray-500">{variant.productName}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-gray-900">
                  ${variant.price.toFixed(2)}
                </p>
                <p
                  className={`text-xs font-medium ${
                    variant.stockQuantity === 0
                      ? "text-red-600"
                      : variant.stockQuantity <= 5
                        ? "text-yellow-600"
                        : "text-green-600"
                  }`}
                >
                  Stock: {variant.stockQuantity}
                </p>
              </div>
            </div>

            {/* Quantity */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700 w-20">
                Cantidad
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1 || isSelling}
                  className="w-8 h-8 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-lg leading-none"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={variant.stockQuantity}
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  disabled={isSelling}
                  className="w-14 text-center border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() =>
                    setQuantity((q) => Math.min(variant.stockQuantity, q + 1))
                  }
                  disabled={quantity >= variant.stockQuantity || isSelling}
                  className="w-8 h-8 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-lg leading-none"
                >
                  +
                </button>
              </div>
            </div>

            {/* Payment method */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700 w-20">
                Pago
              </label>
              <select
                value={paymentMethod}
                onChange={(e) =>
                  setPaymentMethod(e.target.value as PaymentMethod)
                }
                disabled={isSelling}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {Object.values(PaymentMethod).map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center border-t pt-3">
              <span className="text-sm font-medium text-gray-700">Total</span>
              <span className="text-xl font-bold text-gray-900">
                ${total.toFixed(2)}
              </span>
            </div>

            {saleError && (
              <p className="text-sm text-red-600">{saleError}</p>
            )}

            {!stockOk && (
              <p className="text-sm text-red-600">
                Stock insuficiente ({variant.stockQuantity} disponibles).
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={isSelling}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCompleteSale}
                disabled={!stockOk || isSelling}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSelling ? "Procesando..." : "Confirmar venta"}
              </button>
            </div>
          </div>
        )}

        {/* Empty state when opened without initialVariant and nothing scanned */}
        {!variant && !initialVariant && !lookupError && !successMessage && (
          <p className="text-sm text-gray-500 text-center py-2">
            Escanea un código QR o ingresa el SKU para comenzar.
          </p>
        )}
      </div>
    </Modal>
  );
}
