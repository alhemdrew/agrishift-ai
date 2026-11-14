"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { TextField, PasswordField } from "@/components/form-field";
import { Alert } from "@/components/alert";
import { authApi, ApiError } from "@/lib/auth-api";
import { validateEmail, validateName, validatePassword } from "@/lib/validation";
import { btnPrimary, linkClass } from "@/lib/styles";

type Errors = { name: string; email: string; password: string; confirm: string; terms: string };
const empty: Errors = { name: "", email: "", password: "", confirm: "", terms: "" };

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Errors>(empty);
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next: Errors = {
      name: validateName(form.name),
      email: validateEmail(form.email),
      password: validatePassword(form.password),
      confirm: form.confirm === form.password ? "" : "Passwords do not match.",
      terms: agreed ? "" : "Please accept the terms to continue.",
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setLoading(true);
    setServerError("");
    try {
      await authApi.signup(form.name.trim(), form.email.trim(), form.password);
      router.push(`/verify-email?sent=1&email=${encodeURIComponent(form.email.trim())}`);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start exploring Earth observation data for your farm or region."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className={linkClass}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {serverError && <Alert tone="error">{serverError}</Alert>}

        <TextField label="Full name" name="name" autoComplete="name" placeholder="Ada Okafor"
          value={form.name} onChange={update("name")} error={errors.name} />

        <TextField label="Email address" name="email" type="email" autoComplete="email" placeholder="you@farm.ng"
          value={form.email} onChange={update("email")} error={errors.email} />

        <PasswordField label="Password" name="password" autoComplete="new-password"
          placeholder="At least 8 characters" value={form.password} onChange={update("password")} error={errors.password} />

        <PasswordField label="Confirm password" name="confirm" autoComplete="new-password"
          placeholder="Re-enter your password" value={form.confirm} onChange={update("confirm")} error={errors.confirm} />

        <div className="space-y-1.5">
          <label className="flex items-start gap-2.5 text-sm text-brand-700 dark:text-brand-300">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-brand-300 accent-brand-700" />
            <span>
              I agree to the <a href="#" className={linkClass}>Terms of Service</a> and{" "}
              <a href="#" className={linkClass}>Privacy Policy</a>.
            </span>
          </label>
          {errors.terms && <p className="text-sm text-red-600 dark:text-red-400">{errors.terms}</p>}
        </div>

        <button type="submit" disabled={loading} className={btnPrimary}>
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
