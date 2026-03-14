import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chronos",
  description: "Intent-driven personal AI harness MVP"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
