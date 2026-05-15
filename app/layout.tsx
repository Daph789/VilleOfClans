import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VilleOfClans",
  description: "Le running communautaire qui fait s'affronter les quartiers de Lille."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
