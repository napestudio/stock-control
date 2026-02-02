import { auth } from "@/auth";
import { redirect } from "next/navigation";
import LoginForm from "@/components/login-form";

export default async function LoginPage() {
  const session = await auth();

  // If already authenticated, redirect to dashboard
  if (session?.user) {
    redirect("/panel");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Control de Stock
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Inicia sesión para continuar
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
