import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { LocationContextProvider } from '@/components/providers/location-context';

export default function WorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <LocationContextProvider>
      <WorkspaceShell>{children}</WorkspaceShell>
    </LocationContextProvider>
  );
}
