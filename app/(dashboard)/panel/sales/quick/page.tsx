import QuickSaleClient from "@/components/sales/QuickSaleClient";

export default function QuickSalePage() {
  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Venta Rápida</h1>
        <p className="mt-1 text-sm text-gray-500">
          Escanea el QR de un producto para registrar la venta sin necesidad de
          ingresar datos de cliente.
        </p>
      </div>

      <QuickSaleClient />
    </div>
  );
}
