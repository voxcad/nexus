import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skyforge — Drone Data Processing",
  description: "Upload drone photos. Get orthomosaics, DSMs, and deliverables. No desktop software needed.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
