import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import AppShell from "@/components/layout/AppShell";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    template: "%s | CarSpecs B2B",
    default: "Dashboard | CarSpecs B2B",
  },
  description: "B2B vehicle data, VIN decoding, and accurate valuation service by CarSpecs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full antialiased", inter.variable)}>
      <body className="min-h-full font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
