"use client";

import { useState } from "react";
import CameraIcon from "@/components/icons/CameraIcon";
import BoltIcon from "@/components/icons/BoltIcon";
import QrScannerDialog from "@/components/toolbar/QrScannerDialog";
import QuickSaleDialog from "@/components/toolbar/QuickSaleDialog";
import type { VariantScanDetail } from "@/types/toolbar";

export default function FloatingToolbar() {
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [autoSell, setAutoSell] = useState(false);
  const [showQuickSale, setShowQuickSale] = useState(false);
  const [scannedVariant, setScannedVariant] = useState<VariantScanDetail | null>(null);

  function handleSellFromScan(variant: VariantScanDetail) {
    setScannedVariant(variant);
    setShowQuickSale(true);
  }

  function handleQuickSaleClose() {
    setShowQuickSale(false);
    setScannedVariant(null);
  }

  function openInspectScanner() {
    setAutoSell(false);
    setShowQrScanner(true);
  }

  function openFastSellScanner() {
    setAutoSell(true);
    setShowQrScanner(true);
  }

  return (
    <>
      {/* Fixed action buttons */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-3">
        <button
          onClick={openInspectScanner}
          className="w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 active:scale-95 transition-transform flex items-center justify-center"
          title="Escanear QR"
          aria-label="Escanear código QR"
        >
          <CameraIcon className="w-6 h-6" />
        </button>

        <button
          onClick={openFastSellScanner}
          className="w-14 h-14 rounded-full bg-green-600 text-white shadow-lg hover:bg-green-700 active:scale-95 transition-transform flex items-center justify-center"
          title="Venta rápida"
          aria-label="Venta rápida"
        >
          <BoltIcon className="w-6 h-6" />
        </button>
      </div>

      <QrScannerDialog
        isOpen={showQrScanner}
        onClose={() => setShowQrScanner(false)}
        onSell={handleSellFromScan}
        autoSell={autoSell}
      />

      <QuickSaleDialog
        isOpen={showQuickSale}
        onClose={handleQuickSaleClose}
        initialVariant={scannedVariant}
      />
    </>
  );
}
