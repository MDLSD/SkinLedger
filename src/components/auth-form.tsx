"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { useErrorMessage } from "@/i18n/error-message";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthFormState } from "@/lib/actions/auth";

type Props = {
  mode: "login" | "register";
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
};

export function AuthForm({ mode, action }: Props) {
  const t = useTranslations("auth");
  const errorMessage = useErrorMessage();
  const [state, formAction, pending] = useActionState(action, {});
  const isLogin = mode === "login";

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{isLogin ? t("signIn") : t("signUp")}</CardTitle>
        <CardDescription>
          {isLogin ? t("signInSubtitle") : t("signUpSubtitle")}
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              minLength={isLogin ? undefined : 8}
              required
            />
          </div>
          {state.error && (
            <p className="text-sm text-red-400" role="alert">
              {errorMessage(state.error, state.errorValues)}
            </p>
          )}
        </CardContent>
        <CardFooter className="mt-6 flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? t("pending") : isLogin ? t("signInAction") : t("signUpAction")}
          </Button>
          <p className="text-sm text-muted-foreground">
            {isLogin ? (
              <>
                {t("noAccount")}{" "}
                <Link href="/register" className="underline">
                  {t("signUpAction")}
                </Link>
              </>
            ) : (
              <>
                {t("haveAccount")}{" "}
                <Link href="/login" className="underline">
                  {t("signInAction")}
                </Link>
              </>
            )}
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
