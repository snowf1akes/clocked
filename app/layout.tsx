import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clocked",
  description: "Scan a UGC contract for red flags and see if the pay is a lowball.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
