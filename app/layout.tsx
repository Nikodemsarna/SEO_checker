import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Uni SEO+GEO Tracker",
  description: "Track SEO and generative-engine optimization across university content.",
};

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/plan", label: "Content Planning" },
  { href: "/checker", label: "Checker" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center gap-6">
            <span className="font-semibold tracking-tight text-slate-900 dark:text-white">
              Uni SEO<span className="text-indigo-500">+</span>GEO Tracker
            </span>
            <nav className="flex gap-1 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 py-6">{children}</main>
        <footer className="border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-400">
          Local tool — data stored in a SQLite file on this machine.
        </footer>
      </body>
    </html>
  );
}
