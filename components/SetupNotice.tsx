import { TriangleAlert } from "lucide-react";

export function SetupNotice({
  title = "Backend not connected yet",
  detail,
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="mx-auto max-w-lg p-6">
      <div className="rounded-card border border-border bg-surface p-5">
        <TriangleAlert className="mb-3 text-warn" size={28} />
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted">
          Fill in <code className="rounded bg-surface-2 px-1">.env.local</code> and
          restart. For Google Sheets you need{" "}
          <code className="rounded bg-surface-2 px-1">GOOGLE_SHEETS_ID</code>,{" "}
          <code className="rounded bg-surface-2 px-1">GOOGLE_SERVICE_ACCOUNT_EMAIL</code> and{" "}
          <code className="rounded bg-surface-2 px-1">GOOGLE_PRIVATE_KEY</code>, then run{" "}
          <code className="rounded bg-surface-2 px-1">npm run sheet:init</code>. See the README.
        </p>
        {detail && (
          <p className="mt-3 rounded bg-surface-2 p-2 font-mono text-xs text-muted">{detail}</p>
        )}
      </div>
    </div>
  );
}
