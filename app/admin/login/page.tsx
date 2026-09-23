import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { isAdmin, isAuthConfigured } from "@/lib/auth";
import { SetupNotice } from "@/components/SetupNotice";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!isAuthConfigured()) {
    return (
      <SetupNotice
        title="Admin login is not configured"
        detail="Set ADMIN_PASSWORD and AUTH_SECRET in .env.local, then restart the server."
      />
    );
  }
  if (await isAdmin()) redirect("/admin");
  return <LoginForm />;
}
