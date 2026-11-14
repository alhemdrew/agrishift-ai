import { IntelligenceClient } from "@/components/intelligence/intelligence-client";

export const metadata = {
  title: "Intelligence | AgriShift",
};

export default async function IntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ lat?: string; lon?: string }>;
}) {
  const { lat, lon } = await searchParams;
  return <IntelligenceClient lat={lat ?? ""} lon={lon ?? ""} />;
}
