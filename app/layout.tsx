import { Providers } from "@/components/themes/sessionProvider";
import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Labs ITBD",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The app is permanently dark (ITBD brand foundation), so the `dark` class
    // is rendered statically. next-themes was previously used with
    // forcedTheme="dark", which did nothing but inject an inline anti-flash
    // <script> — React 19 logs a console error for scripts rendered by
    // components. Reintroduce a theme provider only if light mode returns.
    <html lang="en" className="dark" style={{ colorScheme: "dark" }} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <Toaster position="bottom-right" theme="dark" />
          {children}
        </Providers>
      </body>
    </html>
  );
}
