import { redirect } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { SetupNotice } from "@/components/SetupNotice";
import { isAdmin } from "@/lib/auth";
import { backendName, isBackendConfigured } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  if (!isBackendConfigured()) return <SetupNotice />;

  return (
    <div className="flex min-h-full flex-col bg-bg lg:flex-row">
      <Sidebar backend={backendName()} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
