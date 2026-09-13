import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "System Center Management Pack Catalog",
  description:
    "Private searchable reference site for SCOM and SCSM management packs.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
