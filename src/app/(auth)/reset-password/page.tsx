"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { PasswordField } from "@/components/form-field";
import { Alert } from "@/components/alert";
import { authApi, ApiError } from "@/lib/auth-api";
import { validatePassword } from "@/lib/validation";
import { btnPrimary, linkClass } from "@/lib/styles";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({ password: "", confirm: "" });
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const passwordError = validatePassword(password);
    const confirmError = confirm === password ? "" : "Passwords do not match.";
    setErrors({ password: passwordError, confirm: confirmError });
    if (passwordError || confirmError || token === undefined) return;

    setLoading(true);
    setServerError("");
    try {
      await authApi.resetPassword(token ?? "local-demo", password);
      router.push("/login?reset=1");
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "This reset link is invalid or has expired.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Local demo mode: choose a new password without an email link."
      footer={<Link href="/login" className={linkClass}>Back to sign in</Link>}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {serverError && <Alert tone="error">{serverError}</Alert>}
        <PasswordField label="New password" name="password" autoComplete="new-password"
          placeholder="At least 8 characters, with a letter and a number" value={password}
          onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        <PasswordField label="Confirm new password" name="confirm" autoComplete="new-password"
          placeholder="Re-enter your new password" value={confirm}
          onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />
        <button type="submit" disabled={loading || token === undefined} className={btnPrimary}>
          {loading ? "Updating password…" : "Update password"}
        </button>
      </form>
    </AuthShell>
  );
}
