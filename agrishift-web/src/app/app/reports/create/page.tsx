import { ReportBuilder } from "@/components/reports/report-builder";

export const metadata = { title: "Create report | AgriShift" };

export default async function CreateReportPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; lat?: string; lon?: string }>;
}) {
  const { type, lat, lon } = await searchParams;
  const reportType = type === "risk" ? "risk" : "environmental";
  return <ReportBuilder type={reportType} lat={lat ?? ""} lon={lon ?? ""} />;
}
