import { AssistantClient } from "@/components/assistant/assistant-client";

export const metadata = {
  title: "AI Assistant | AgriShift",
};

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ lat?: string; lon?: string }>;
}) {
  const { lat, lon } = await searchParams;
  return <AssistantClient lat={lat ?? ""} lon={lon ?? ""} />;
}
