import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

/** Common chrome for the three field forms. Mobile-first: one column, big targets. */
export function FormShell({
  title,
  titleHi,
  subtitle,
  children,
}: {
  title: string;
  titleHi: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col bg-bg">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            href="/"
            aria-label="Back to home"
            className="-ml-2 rounded-lg p-2 hover:bg-surface-2"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold leading-tight">{title}</h1>
            <p className="hi truncate text-xs text-muted">{titleHi}</p>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4 pb-28">
        {subtitle && <p className="mb-4 text-sm text-muted">{subtitle}</p>}
        {children}
      </main>
    </div>
  );
}

/** Sticky submit bar — the action stays reachable through a long form.
 *  min-w-0 on the row lets the status text truncate instead of forcing the
 *  bar wider than a small phone. */
export function SubmitBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 px-3 py-3 backdrop-blur sm:px-4">
      <div className="mx-auto flex min-w-0 max-w-3xl items-center gap-2 sm:gap-3">
        {children}
      </div>
    </div>
  );
}
