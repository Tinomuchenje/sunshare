import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { ModeNote } from "@/components/ui/ModeNote";
import "./globals.css";

export const metadata: Metadata = {
  title: "SunShare: own solar that powers African clinics and farms",
  description:
    "Buy solar cells with PayPal. They power a clinic or a farm, and you earn a share of the electricity income.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:py-14">
          {children}
        </main>
        <footer className="border-t border-line">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-muted">
            <p>
              Prototype with sample projects. Earnings are estimates and are not
              guaranteed.
            </p>
            <ModeNote />
          </div>
        </footer>
      </body>
    </html>
  );
}
