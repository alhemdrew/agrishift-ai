"use client";

import { useRouter } from "next/navigation";
import { authApi } from "@/lib/auth-api";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    try {
      await authApi.logout();
    } finally {
      router.push("/login");
    }
  }
  return (
    <button onClick={logout} className="rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100 dark:text-brand-200 dark:hover:bg-brand-800">
      Sign out
    </button>
  );
}
