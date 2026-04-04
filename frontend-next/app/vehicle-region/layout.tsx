import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vehicle Region Assignment",
};

export default function VehicleRegionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
