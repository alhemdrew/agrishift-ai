"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { AuthShell } from "@/components/auth-shell";
import { TextField, PasswordField } from "@/components/form-field";
import { Alert } from "@/components/alert";
import { authApi, ApiError } from "@/lib/auth-api";
import { validateEmail } from "@/lib/validation";
import { btnPrimary, linkClass } from "@/lib/styles";
import { LOCAL_DEMO_EMAIL, LOCAL_DEMO_PASSWORD } from "@/lib/local-auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [serverError, setServerError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const hasDemoCredentials = Boolean(LOCAL_DEMO_EMAIL && LOCAL_DEMO_PASSWORD);

  function useDemoCredentials() {
    setEmail(LOCAL_DEMO_EMAIL);
    setPassword(LOCAL_DEMO_PASSWORD);
    setErrors({ email: "", password: "" });
    setServerError("");
  }

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
      router.push(safeNext as Route);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not sign you in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Local demo access is enabled. No email verification is required."
      footer={
        <>
          New to AgriShift?{" "}
          <Link href="/signup" className={linkClass}>
            Create an account
          </Link>
        </>
      }
    >
      {hasDemoCredentials ? (
        <div className="mb-5 rounded-xl border border-emerald-300/70 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100">
          <p className="font-semibold">Demo credentials</p>
          <p className="mt-1 font-mono text-xs">{LOCAL_DEMO_EMAIL}</p>
          <p className="font-mono text-xs">{LOCAL_DEMO_PASSWORD}</p>
          <button type="button" onClick={useDemoCredentials} className="mt-2 font-semibold underline">
            Use demo credentials
          </button>
        </div>
      ) : (
        <Alert tone="error">Demo credentials are not configured in this environment.</Alert>
      )}
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
