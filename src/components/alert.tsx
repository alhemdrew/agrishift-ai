import { AlertTriangle, CheckCircle2 } from "lucide-react";

export function Alert({ tone, children }: { tone: "error" | "success" | "info"; children: React.ReactNode }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
    success: "border-brand-200 bg-brand-100/60 text-brand-800 dark:border-brand-800 dark:bg-brand-900/60 dark:text-brand-200",
    info: "border-brand-200 bg-white text-brand-800 dark:border-brand-800 dark:bg-brand-900/60 dark:text-brand-200",
  };
  const Icon = tone === "error" ? AlertTriangle : CheckCircle2;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${styles[tone]}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
