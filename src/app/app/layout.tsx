import { AppNav } from "@/components/app/app-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-clip bg-brand-50 text-brand-900 dark:bg-brand-950 dark:text-brand-100">
      <AppNav userName="Local workspace" />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
