"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/modal";
import { getVariantDetailsBySku } from "@/app/actions/sale-actions";
import type { VariantScanDetail } from "@/types/toolbar";

type ScanState = "scanning" | "loading" | "found" | "error";

interface QrScannerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSell: (variant: VariantScanDetail) => void;
}

const SCANNER_ELEMENT_ID = "qr-scanner-viewport";

export default function QrScannerDialog({
  isOpen,
  onClose,
  onSell,
}: QrScannerDialogProps) {
  const router = useRouter();
  const scannerRef = useRef<{ clear: () => Promise<void> } | null>(null);
  const hasScannedRef = useRef(false);

  const [state, setState] = useState<ScanState>("scanning");
  const [variant, setVariant] = useState<VariantScanDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    hasScannedRef.current = false;
    setState("scanning");
    setVariant(null);
    setErrorMessage("");

    // Delay to let the modal render the target div
    const timeout = setTimeout(async () => {
      try {
        const { Html5QrcodeScanner } = await import("html5-qrcode");

        const scanner = new Html5QrcodeScanner(
          SCANNER_ELEMENT_ID,
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            rememberLastUsedCamera: true,
            showTorchButtonIfSupported: true,
          },
          false,
        );

        scannerRef.current = scanner;

        scanner.render(
          async (decodedText: string) => {
            // Prevent duplicate scans
            if (hasScannedRef.current) return;
            hasScannedRef.current = true;

            setState("loading");

            try {
              await scanner.clear();
              scannerRef.current = null;
            } catch {
              // ignore cleanup errors
            }

            try {
              const result = await getVariantDetailsBySku(decodedText.trim());
              if (!result) {
                setErrorMessage(
                  "Producto no encontrado o no disponible para la venta.",
                );
                setState("error");
                return;
              }
              setVariant(result);
              setState("found");
            } catch (err) {
              setErrorMessage(
                err instanceof Error
                  ? err.message
                  : "Error al buscar el producto.",
              );
              setState("error");
            }
          },
          () => {
            // scan error — ignored, scanner keeps trying
          },
        );
      } catch {
        setErrorMessage("No se pudo iniciar la cámara.");
        setState("error");
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
    };
  }, [isOpen]);

  async function handleClose() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
    hasScannedRef.current = false;
    setState("scanning");
    setVariant(null);
    setErrorMessage("");
    onClose();
  }

  function handleRetry() {
    hasScannedRef.current = false;
    setState("scanning");
    setVariant(null);
    setErrorMessage("");
    // Re-trigger the scanner by toggling state — easiest is to remount via key
  }

  function handleSell() {
    if (!variant) return;
    handleClose();
    onSell(variant);
  }

  function handleAdjustStock() {
    handleClose();
    router.push("/panel/stock");
  }

  const imageUrl = variant?.variantImageUrl || variant?.productImageUrl || null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Escanear producto"
      size="md"
    >
      <div className="space-y-4">
        {/* Camera viewport — always rendered while scanning so html5-qrcode can attach */}
        {(state === "scanning" || state === "loading") && (
          <div>
            {state === "loading" && (
              <div className="flex items-center justify-center py-4 text-sm text-gray-500">
                Buscando producto...
              </div>
            )}
            <div
              id={SCANNER_ELEMENT_ID}
              className={state === "loading" ? "hidden" : ""}
            />
          </div>
        )}

        {/* Error state */}
        {state === "error" && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {errorMessage}
            </div>
            <button
              onClick={handleRetry}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {/* Found state */}
        {state === "found" && variant && (
          <div className="space-y-4">
            {/* Product image */}
            {imageUrl && (
              <div className="relative w-full h-48 rounded-lg overflow-hidden bg-gray-100">
                <Image
                  src={imageUrl}
                  alt={variant.productName}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 500px"
                />
              </div>
            )}

            {/* Product details */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {variant.productName}
              </h3>
              {variant.displayName && (
                <p className="text-sm text-indigo-600 font-medium">
                  {variant.displayName}
                </p>
              )}
              {variant.productDescription && (
                <p className="text-sm text-gray-600">
                  {variant.productDescription}
                </p>
              )}

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Precio</p>
                  <p className="text-base font-bold text-gray-900">
                    ${variant.price.toFixed(2)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500">Stock</p>
                  <p
                    className={`text-base font-bold ${
                      variant.stockQuantity === 0
                        ? "text-red-600"
                        : variant.stockQuantity <= 5
                          ? "text-yellow-600"
                          : "text-green-600"
                    }`}
                  >
                    {variant.stockQuantity}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 font-mono">SKU</p>
                  <p className="text-xs font-mono text-gray-700 truncate">
                    {variant.sku}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleAdjustStock}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Ajustar stock
              </button>
              <button
                onClick={handleSell}
                disabled={variant.stockQuantity === 0}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Vender
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
