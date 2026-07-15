import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { loginAction } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Вход — SkinLedger" };

export default function LoginPage() {
  return <AuthForm mode="login" action={loginAction} />;
}
