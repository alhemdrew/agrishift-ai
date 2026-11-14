"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { TextField, PasswordField } from "@/components/form-field";
import { Alert } from "@/components/alert";
import { authApi, ApiError } from "@/lib/auth-api";
import { validateEmail, validatePassword } from "@/lib/validation";
import { btnPrimary, linkClass } from "@/lib/styles";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("reset") === "1") {
      setNotice("Your password has been reset. Sign in with your new password.");
    }
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const emailError = validateEmail(email);
    const passwordError = password ? "" : "Enter your password.";
    setErrors({ email: emailError, password: passwordError });
    if (emailError || passwordError) return;

    setLoading(true);
    setServerError("");
    try {
      await authApi.login(email.trim(), password);
      const next = new URLSearchParams(window.location.search).get("next");
      const safeNext = next && next.startsWith("/app") && !next.startsWith("//") ? next : "/app";
      router.push(safeNext);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not sign you in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue to your field intelligence dashboard."
      footer={
        <>
          New to AgriShift?{" "}
          <Link href="/signup" className={linkClass}>
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {notice && <Alert tone="success">{notice}</Alert>}
        {serverError && <Alert tone="error">{serverError}</Alert>}

        <TextField
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@farm.ng"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />

        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-brand-700 dark:text-brand-300">
            <input type="checkbox" className="h-4 w-4 rounded border-brand-300 accent-brand-700" />
            Keep me signed in
          </label>
          <Link href="/forgot-password" className={linkClass}>
            Forgot password?
          </Link>
        </div>

        <button type="submit" disabled={loading} className={btnPrimary}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
