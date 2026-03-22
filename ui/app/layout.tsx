import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SaaS UI",
  description: "Next.js 16 frontend for the monorepo demo",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
