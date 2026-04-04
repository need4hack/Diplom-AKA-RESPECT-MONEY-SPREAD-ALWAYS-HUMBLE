import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bulk Search",
};

export default function BulkSearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
