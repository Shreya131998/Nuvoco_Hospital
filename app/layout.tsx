import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

const sans = Inter({
  variable: "--font-latin",
  subsets: ["latin"],
  display: "swap",
});

// The ambulance checklist is entirely in Hindi; without a Devanagari face
// the labels fall back to a system font and render inconsistently.
const devanagari = Noto_Sans_Devanagari({
  variable: "--font-deva",
  subsets: ["devanagari"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nuvoco Sonadih OHC — Checklists",
  description:
    "Paperless first aid, ambulance and medicine checklists for Nuvoco Sonadih Cement Plant Hospital.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${devanagari.variable} h-full antialiased`}
      style={
        {
          "--font-app-sans": `var(--font-latin), var(--font-deva), system-ui, sans-serif`,
        } as React.CSSProperties
      }
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
