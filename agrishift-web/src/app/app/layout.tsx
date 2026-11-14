import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app/app-nav";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type User = { id: string; email: string; name: string };

// Ask the backend whether this session cookie is still valid. A cookie alone is not proof of sign-in.
async function getSignedInUser(): Promise<User | null> {
  const session = (await cookies()).get("as_session")?.value;
  if (!session) return null;
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Cookie: `as_session=${session}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user: User };
    return data.user;
  } catch {
    return null;
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSignedInUser();
  if (!user) redirect("/login?next=/app");

  // Light by default, dark on the toggle. Both follow the same theme setting as the rest of the site.
  return (
    <div className="min-h-screen overflow-x-clip bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100">
      <AppNav userName={user.name} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
