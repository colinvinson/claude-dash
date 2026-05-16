import type { Metadata } from "next";
export const metadata: Metadata = { title: "Data" };
export default function DataLayout({ children }: { children: React.ReactNode }) { return children; }
