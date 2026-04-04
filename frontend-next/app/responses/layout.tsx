import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Responses",
};

export default function ResponsesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
