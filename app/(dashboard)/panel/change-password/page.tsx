import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ChangePasswordForm from "./change-password-form";

export default async function ChangePasswordPage() {
  const session = await auth();

  // Redirect to login if not authenticated
  if (!session) {
    redirect("/");
  }

  // Check if user requires password change
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { requirePasswordChange: true },
  });

  // If password change not required, redirect to dashboard
  if (!user?.requirePasswordChange) {
    redirect("/panel");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Change Password
          </h1>
          <p className="text-gray-600">
            You must change your temporary password before continuing.
          </p>
        </div>
        <ChangePasswordForm isFirstLogin={true} />
      </div>
    </div>
  );
}
