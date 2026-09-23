import Link from "next/link";
import { Briefcase, Truck, Pill, ShieldCheck } from "lucide-react";

const MODULES = [
  {
    href: "/first-aid",
    icon: Briefcase,
    title: "First Aid Box",
    titleHi: "फर्स्ट ऐड बॉक्स",
    desc: "Record what you checked and what you refilled in a box.",
    descHi: "बॉक्स में जो सामान भरा है उसे दर्ज करें।",
  },
  {
    href: "/ambulance",
    icon: Truck,
    title: "Ambulance / Vehicle",
    titleHi: "वाहन चेक लिस्ट",
    desc: "Daily shift-wise vehicle check.",
    descHi: "प्रतिदिन शिफ्ट अनुसार वाहन जाँच।",
  },
  {
    href: "/medicine",
    icon: Pill,
    title: "OHC Medicines",
    titleHi: "दवा जाँच सूची",
    desc: "Monthly stock and expiry check.",
    descHi: "मासिक स्टॉक व एक्सपायरी जाँच।",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-col bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Nuvoco Sonadih Cement Plant
          </p>
          <h1 className="mt-1 text-2xl font-bold leading-tight">
            Occupational Health Centre
          </h1>
          <p className="hi mt-1 text-sm text-muted">
            चेक लिस्ट — कोई भी फॉर्म चुनें
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
        <ul className="grid gap-3">
          {MODULES.map((m) => (
            <li key={m.href}>
              <Link
                href={m.href}
                className="flex items-start gap-4 rounded-card border border-border bg-surface p-4 shadow-sm transition hover:border-primary hover:shadow-md active:scale-[0.995]"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                  <m.icon size={24} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold">{m.title}</span>
                  <span className="hi block text-sm font-medium text-muted">
                    {m.titleHi}
                  </span>
                  <span className="mt-1.5 block text-sm text-muted">{m.desc}</span>
                  <span className="hi block text-sm text-muted">{m.descHi}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="/admin"
          className="mt-6 flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-3 text-sm font-medium text-muted transition hover:bg-surface-2"
        >
          <ShieldCheck size={16} />
          Admin dashboard
        </Link>
      </main>

      <footer className="px-4 py-6 text-center text-xs text-muted">
        Nuvoco Sonadih OHC · Paperless checklist system
      </footer>
    </div>
  );
}
