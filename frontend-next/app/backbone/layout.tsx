import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Backbone Viewer",
};

export default function BackboneLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
