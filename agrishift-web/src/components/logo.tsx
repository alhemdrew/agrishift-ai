import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 ${className}`}>
      <img src="/assets/brand-mark.webp" alt="" className="h-9 w-9 shrink-0 object-contain" />
      <span className="text-lg font-semibold tracking-tight text-brand-900 dark:text-brand-50">
        Agri<span className="text-accent-500">Shift</span>
      </span>
    </Link>
  );
}
