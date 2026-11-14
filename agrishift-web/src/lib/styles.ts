export const inputClass = (hasError: boolean) =>
  [
    "w-full rounded-xl border bg-white px-4 py-3 text-sm text-brand-900 placeholder:text-brand-400 outline-none transition",
    "focus:ring-2 focus:ring-brand-400/40 focus:border-brand-500",
    "dark:bg-brand-900/60 dark:text-brand-50 dark:placeholder:text-brand-600 dark:focus:border-brand-400",
    hasError ? "border-red-400 focus:border-red-500" : "border-brand-200 dark:border-brand-800",
  ].join(" ");

export const btnPrimary =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-400 dark:text-brand-950 dark:hover:bg-brand-300";

export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-brand-300 bg-white px-5 py-3 text-sm font-semibold text-brand-800 transition hover:bg-brand-50 dark:border-brand-700 dark:bg-transparent dark:text-brand-100 dark:hover:bg-brand-900";

export const linkClass =
  "font-medium text-brand-700 hover:text-brand-900 hover:underline dark:text-brand-300 dark:hover:text-brand-100";
