import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user) redirect("/app");

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      {children}
    </main>
  );
}
