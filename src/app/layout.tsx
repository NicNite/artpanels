import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { FluxStatus } from "@/components/flux-status";
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
  title: "ArtPanels",
  description: "Design translucent 3D-printed art panels for glass windows and doors",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="border-b px-6 py-3 flex gap-6 items-center bg-background">
          <Link href="/" className="font-semibold hover:underline">
            ArtPanels
          </Link>
          <Link href="/filaments" className="text-sm text-muted-foreground hover:underline">
            Filaments
          </Link>
          <div className="ml-auto">
            <FluxStatus />
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
