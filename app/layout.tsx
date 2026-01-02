import type { Metadata, Viewport } from "next";
import "./globals.css";

// Removed Google Fonts to prevent network timeouts/warnings in restricted environments.
// Using system font checks in CSS/Tailwind instead.

export const viewport: Viewport = {
  themeColor: "#059669",
};

export const metadata: Metadata = {
  title: "MEDERSUB VTU",
  description: "Secure Instant Top-up Platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MEDERSUB VTU",
  },
  formatDetection: {
    telephone: false,
  },
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
