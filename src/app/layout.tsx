import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { LocationContextProvider } from '@/components/providers/location-context';

export const metadata: Metadata = {
  title: 'AgriShif AI | Agricultural intelligence',
  description: 'Understand your farm and local environmental observations with AgriShif AI.',
  icons: {
    icon: '/brand-mark.webp',
    apple: '/brand-mark.webp',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          storageKey="agrishif-theme"
        >
          <LocationContextProvider>{children}</LocationContextProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
