import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/os/Providers";
import { BootSequence } from "@/components/os/BootSequence";
import { TopBar } from "@/components/os/TopBar";
import { Sidebar } from "@/components/os/Sidebar";
import { CommandPalette } from "@/components/os/CommandPalette";
import { ParticleField } from "@/components/os/ParticleField";

const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "AgenticOS — Mission Control",
  description: "Local mission control for your AI agent fleet.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${display.variable} ${sans.variable} ${mono.variable} antialiased`}>
        <Providers>
          <BootSequence />
          <div className="relative min-h-dvh">
            {/* ambient background */}
            <div className="pointer-events-none fixed inset-0 -z-10">
              <div className="absolute inset-0 bg-[#05060f] dark:block hidden" />
              <div className="absolute inset-0 bg-[#f4f5fb] dark:hidden" />
              <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-[#ff6b1a]/14 blur-[120px]" />
              <div className="absolute top-1/3 -right-20 h-96 w-96 rounded-full bg-[#8b5cf6]/16 blur-[120px]" />
              <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-[#22e6c8]/10 blur-[120px]" />
              <ParticleField />
            </div>
            <TopBar />
            <main className="mx-auto w-full max-w-6xl px-4 pt-5 pb-28 md:pr-20">{children}</main>
            <Sidebar />
            <CommandPalette />
          </div>
        </Providers>
      </body>
    </html>
  );
}
