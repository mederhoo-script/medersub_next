import type { Metadata } from "next";
import "./globals.css";

// Removed Google Fonts to prevent network timeouts/warnings in restricted environments.
// Using system font checks in CSS/Tailwind instead.

export const metadata: Metadata = {
  title: "VTU Platform",
  description: "Secure Instant Top-up Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
