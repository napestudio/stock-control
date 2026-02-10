/**
 * Export cash movements to CSV format
 */
export function exportMovementsToCSV(
  movements: Array<{
    createdAt: string;
    type: string;
    paymentMethod: string;
    amount: number;
    description: string | null;
    session: {
      cashRegister: { name: string };
      user: { name: string | null; email: string };
    };
  }>,
  filename: string
): void {
  // Convert to CSV format
  const headers = [
    "Fecha",
    "Tipo",
    "Método de Pago",
    "Monto",
    "Caja",
    "Usuario",
    "Descripción",
  ];

  const rows = movements.map((m) => [
    new Date(m.createdAt).toLocaleString("es-AR"),
    m.type,
    m.paymentMethod,
    m.amount.toFixed(2),
    m.session.cashRegister.name,
    m.session.user.name || m.session.user.email,
    m.description || "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  // Trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
