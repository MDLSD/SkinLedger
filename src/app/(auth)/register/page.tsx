import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { registerAction } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Регистрация — SkinLedger" };

export default function RegisterPage() {
  return <AuthForm mode="register" action={registerAction} />;
}
