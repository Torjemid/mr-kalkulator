// src/app/layout.tsx
import React from "react";

export const metadata = {
  title: "MR kalkulator",
  description: "Ca-pris kalkulator",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}

