import type { Metadata, Viewport } from "next";
import { PWARegister } from "@/components/PWARegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aureli — AI Finance Workspace",
  description:
    "Aureli is an AI-powered finance workspace for smarter business decisions.",
  applicationName: "Aureli",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Aureli",
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
    <html lang="en">
      <body>
        <PWARegister />
        {children}
      </body>
    </html>
  );
}