import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  // Title template — sub-routes set their own; this composes them as
  // "Schedule · Rowan", "Gym · Rowan", etc. Root defaults to just "Rowan".
  title:    { default: "Rowan", template: "%s · Rowan" },
  description: "Sir's personal performance dashboard — schedule, training, goals, and Jarvis.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Rowan" },
  // Open Graph / share-card metadata for when the dashboard URL is pasted
  // into iMessage, Slack, etc. Makes link previews feel intentional.
  openGraph: {
    title:       "Rowan",
    description: "Personal performance dashboard. Schedule, training, goals, Jarvis.",
    type:        "website",
    siteName:    "Rowan",
  },
  icons: {
    icon:     [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple:    [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,   // prevent zoom-jank on input focus
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="text-[#FAFAFA] antialiased" style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
