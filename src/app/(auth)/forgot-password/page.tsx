"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { TextField } from "@/components/form-field";
import { Alert } from "@/components/alert";
import { authApi, ApiError } from "@/lib/auth-api";
import { btnPrimary, linkClass } from "@/lib/styles";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [serverError, setServerError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const emailError = email.trim() ? "" : "Enter your local username.";
    setError(emailError);
    if (emailError) return;

    setLoading(true);
    setServerError("");
    try {
      await authApi.forgotPassword(email.trim());
      setSubmitted(true);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <AuthShell title="Check your inbox" subtitle={`If an account exists for ${email.trim()}, we\u0027ve sent a reset link.`}
        footer={<Link href="/login" className={linkClass}>Back to sign in</Link>}>
        <Alert tone="success">
          The link expires in 30 minutes. If you don&apos;t see the email, check your spam folder.
        </Alert>
        <button type="button" onClick={() => setSubmitted(false)} className={`${btnPrimary} mt-6`}>
          Try a different email
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter the email linked to your account and we'll send you a reset link."
      footer={<Link href="/login" className={linkClass}>Back to sign in</Link>}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {serverError && <Alert tone="error">{serverError}</Alert>}
        <TextField label="Email address" name="email" type="email" autoComplete="email" placeholder="you@farm.ng"
          value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
        <button type="submit" disabled={loading} className={btnPrimary}>
          {loading ? "Sending link…" : "Send reset link"}
        </button>
      </form>
    </AuthShell>
  );
}
