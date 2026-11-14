import { EarthExplorer } from '../(workspace)/explorer/earth-explorer';
import { LocationContextProvider } from '@/components/providers/location-context';

export default function ExplorerRoutePage() {
  return (
    <LocationContextProvider>
      <EarthExplorer />
    </LocationContextProvider>
  );
}
