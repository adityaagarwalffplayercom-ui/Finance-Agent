import type { Metadata, Viewport } from "next";
import { PWARegister } from "@/components/PWARegister";
import "./globals.css";
export const metadata: Metadata = {
  title: "Actic Finance — AI Finance Workspace",
  description:
    "Actic Finance is an AI-powered finance workspace for smarter business decisions.",
  applicationName: "Actic Finance",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Actic Finance",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/aureli-icon.svg",
    apple: "/aureli-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b111b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
