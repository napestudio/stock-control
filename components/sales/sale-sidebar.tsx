"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Sidebar from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import CustomerFormSection from "./customer-form-section";
import ProductSearchInput from "./product-search-input";
import SaleItemsList from "./sale-items-list";
import PaymentBreakdown from "./payment-breakdown";
import {
  customerSchema,
  type CustomerInput,
  type PaymentEntry,
  type CompleteSaleInput,
} from "@/lib/validations/sale-schema";
import type { SaleWithRelations, SaleItem } from "@/types/sale";

interface SaleSidebarProps {
  sale: SaleWithRelations;
  items: SaleItem[];
  onAddItem: (variantId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onComplete: (data: CompleteSaleInput) => void;
  onClose: () => void;
  isPending?: boolean;
}

export default function SaleSidebar({
  sale,
  items,
  onAddItem,
  onRemoveItem,
  onUpdateQuantity,
  onComplete,
  onClose,
  isPending = false,
}: SaleSidebarProps) {
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [discountPercentage, setDiscountPercentage] = useState(0);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: sale.customer
      ? {
          firstName: sale.customer.firstName,
          lastName: sale.customer.lastName,
          email: sale.customer.email ?? "",
          phone: sale.customer.phone || "",
          address: sale.customer.address || "",
        }
      : undefined,
  });

  // Calculate total
  const subtotal = items.reduce((sum, item) => {
    const price = item.variant?.price || 0;
    return sum + price * item.quantity;
  }, 0);
  const discountAmount = subtotal * (discountPercentage / 100);
  const total = subtotal - discountAmount;

  const paymentsTotal = payments.reduce((sum, p) => sum + p.amount, 0);
  const isPaymentComplete =
    payments.length > 0 && Math.abs(total - paymentsTotal) < 0.01;

  function onSubmit(customerData: CustomerInput) {
    if (items.length === 0) {
      alert("Debes agregar al menos un producto a la venta");
      return;
    }

    if (!isPaymentComplete) {
      alert(
        `Los pagos deben sumar exactamente ${total.toFixed(2)}. Total actual: ${paymentsTotal.toFixed(2)}`,
      );
      return;
    }

    const completeSaleData: CompleteSaleInput = {
      saleId: sale.id,
      payments,
      customerData,
      sessionId: sale.sessionId,
      discountPercentage,
    };

    onComplete(completeSaleData);
  }

  return (
    <Sidebar isOpen onClose={onClose} title="Nueva Venta" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Customer Information */}
        <div className="pb-6 border-b border-gray-200">
          <CustomerFormSection
            register={register}
            setValue={setValue}
            errors={errors}
          />
        </div>

        {/* Product Search */}
        <div className="pb-6 border-b border-gray-200">
          <ProductSearchInput onSelect={onAddItem} disabled={isPending} />
        </div>

        {/* Sale Items */}
        <div className="pb-6 border-b border-gray-200">
          <SaleItemsList
            items={items}
            onRemove={onRemoveItem}
            onUpdateQuantity={onUpdateQuantity}
            disabled={isPending}
          />
        </div>

        {/* Discount */}

        {items.length > 0 && (
          <div className="pb-6 border-b border-gray-200 flex flex-col items-start">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              Descuento
            </h3>
            <div className="relative">
              <input
                id="discount"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={discountPercentage === 0 ? "" : discountPercentage}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setDiscountPercentage(
                    isNaN(val) ? 0 : Math.min(100, Math.max(0, val)),
                  );
                }}
                disabled={isPending}
                placeholder="0"
                className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                %
              </span>
            </div>
            {discountPercentage > 0 && (
              <div className="mt-3 space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${subtotal.toLocaleString("es-Ar")}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Descuento ({discountPercentage}%):</span>
                  <span>-${discountAmount.toLocaleString("es-Ar")}</span>
                </div>
                <div className="flex justify-between font-semibold text-gray-900 border-t pt-1">
                  <span>Total:</span>
                  <span>${total.toLocaleString("es-Ar")}</span>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Payment Breakdown */}
        {items.length > 0 && (
          <div className="pb-6 border-b border-gray-200">
            <PaymentBreakdown
              total={total}
              onPaymentsChange={setPayments}
              disabled={isPending}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 sticky bottom-0 bg-white">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isPending || items.length === 0 || !isPaymentComplete}
          >
            {isPending ? "Procesando..." : "Completar Venta"}
          </Button>
        </div>
      </form>
    </Sidebar>
  );
}
