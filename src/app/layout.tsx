// src/app/layout.tsx

import "./globals.css";
import React from "react";

export const metadata = {
  title: "Gaia Map Search",
  description: "Gaia Project map search tool",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}