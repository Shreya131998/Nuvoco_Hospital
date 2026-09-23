import { PageHeader } from "@/components/dashboard/PageHeader";
import ExportForm from "./ExportForm";

export const dynamic = "force-dynamic";

export default function ExportPage() {
  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6">
      <PageHeader
        title="Export to Excel"
        subtitle="Download the records in the same layout as the paper registers, so existing audit habits keep working."
      />
      <ExportForm />
    </div>
  );
}
