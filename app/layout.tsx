import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
import { SafeArea } from "@/components/layout/SafeArea";
import { Background } from "@/components/layout/Background";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Toaster } from "sonner";
import "./globals.css";
import { farcasterConfig } from "../farcaster.config";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Case",
    description: "Open premium cases on Base.",
    other: {
      "fc:frame": JSON.stringify({
        version: farcasterConfig.miniapp.version,
        imageUrl: farcasterConfig.miniapp.imageUrl || farcasterConfig.miniapp.heroImageUrl,
        button: {
          title: farcasterConfig.miniapp.buttonTitle || "Open a Case",
          action: {
            name: "Launch Case",
            type: "launch_frame",
          },
        },
      }),
    },
  };
}

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetBrainsMono.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/@coinbase/onchainkit@1.1.2/dist/assets/style.css"
        />
      </head>
      <body>
        <Providers>
          <SafeArea className="min-h-screen">
            <Background />
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
          </SafeArea>
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}

