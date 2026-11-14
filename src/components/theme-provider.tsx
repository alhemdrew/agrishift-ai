"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Light is the default everywhere, as in the design. The theme toggle switches to dark and remembers the choice.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      storageKey="as_theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
