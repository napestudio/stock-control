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

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: sale.customer
      ? {
          fullName: sale.customer.fullName,
          email: sale.customer.email,
          phone: sale.customer.phone || "",
          address: sale.customer.address || "",
        }
      : undefined,
  });

  // Calculate total
  const total = items.reduce((sum, item) => {
    const price = item.variant?.price || 0;
    return sum + price * item.quantity;
  }, 0);

  const paymentsTotal = payments.reduce((sum, p) => sum + p.amount, 0);
  const isPaymentComplete = Math.abs(total - paymentsTotal) < 0.01;

  function onSubmit(customerData: CustomerInput) {
    if (items.length === 0) {
      alert("Debes agregar al menos un producto a la venta");
      return;
    }

    if (payments.length === 0) {
      alert("Debes agregar al menos un método de pago");
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

        {/* Payment Breakdown */}
        {items.length > 0 && (
          <div className="pb-6 border-b border-gray-200">
            <PaymentBreakdown
              total={total}
              payments={payments}
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
            disabled={
              isPending ||
              items.length === 0 ||
              payments.length === 0 ||
              !isPaymentComplete
            }
          >
            {isPending ? "Procesando..." : "Completar Venta"}
          </Button>
        </div>
      </form>
    </Sidebar>
  );
}
