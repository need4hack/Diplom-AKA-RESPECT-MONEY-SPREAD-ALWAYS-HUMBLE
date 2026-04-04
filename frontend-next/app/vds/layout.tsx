import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VDS Explorer",
};

export default function VdsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
