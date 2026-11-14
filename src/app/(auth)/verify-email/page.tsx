"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Alert } from "@/components/alert";
import { authApi, ApiError } from "@/lib/auth-api";
import { btnPrimary, linkClass } from "@/lib/styles";

type State = "waiting" | "verifying" | "verified" | "failed";

export default function VerifyEmailPage() {
  const [state, setState] = useState<State>("waiting");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    setEmail(params.get("email") ?? "");

    if (!token) return; // Arrived after signup: show "check your inbox"

    setState("verifying");
    authApi
      .verifyEmail(token)
      .then(() => setState("verified"))
      .catch((err) => {
        setMessage(err instanceof ApiError ? err.message : "This verification link is invalid or has expired.");
        setState("failed");
      });
  }, []);

  if (state === "verifying") {
    return (
      <AuthShell title="Verifying your email" subtitle="This will only take a moment.">
        <p className="text-brand-600 dark:text-brand-300">Please wait…</p>
      </AuthShell>
    );
  }

  if (state === "verified") {
    return (
      <AuthShell title="Email verified" subtitle="Your account is ready."
        footer={<Link href="/login" className={linkClass}>Continue to sign in</Link>}>
        <Alert tone="success">Thanks for confirming. You can now sign in to AgriShift.</Alert>
        <Link href="/login" className={`${btnPrimary} mt-6`}>Sign in</Link>
      </AuthShell>
    );
  }

  if (state === "failed") {
    return (
      <AuthShell title="Link expired" subtitle="We couldn't verify this link."
        footer={<Link href="/login" className={linkClass}>Back to sign in</Link>}>
        <Alert tone="error">{message}</Alert>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Check your inbox"
      subtitle={email ? `We sent a verification link to ${email}.` : "We sent you a verification link."}
      footer={<Link href="/login" className={linkClass}>Back to sign in</Link>}
    >
      <Alert tone="info">
        Click the link in the email to activate your account. The link expires in 24 hours.
      </Alert>
    </AuthShell>
  );
}
