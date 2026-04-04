import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Masters",
};

export default function MastersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
