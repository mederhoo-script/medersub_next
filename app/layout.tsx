import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MessageCircle } from 'lucide-react';

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
        {/* WhatsApp Contact Button - Available on all pages */}
        <a
          href="https://wa.me/2348034295030"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110 z-50 flex items-center gap-2"
          aria-label="Contact us on WhatsApp"
        >
          <MessageCircle className="h-6 w-6" />
        </a>
      </body>
    </html>
  );
}
