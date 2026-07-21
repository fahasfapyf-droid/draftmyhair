import "./globals.css";

import type { Metadata } from "next";
import { GenerationSessionProvider } from "@/lib/context/GenerationSession";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { siteName, siteUrl } from "./metadata";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "Draft My Hair | See Your Next Hairstyle Before You Cut It.",
    template: "%s | Draft My Hair",
  },

  description:
    "See Your Next Hairstyle Before You Cut It. Same Face. New Hair. Create realistic hairstyle previews while preserving your identity.",

  keywords: [
    "AI hairstyle",
    "hairstyle preview",
    "hair simulation",
    "virtual hairstyle",
    "AI haircut",
    "hair colour preview",
    "buzz cut preview",
    "bald preview",
    "beard preview",
    "identity-preserving AI",
    siteName,
  ],

  authors: [
    {
      name: siteName,
    },
  ],

  creator: siteName,
  publisher: siteName,

  alternates: {
    canonical: "/",
  },

  icons: {
    icon: [{ url: "/icon", type: "image/png" }],
    apple: [{ url: "/icon", type: "image/png" }],
    shortcut: [{ url: "/icon", type: "image/png" }],
  },

  manifest: "/manifest.webmanifest",

  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName,
    title: "Draft My Hair | See Your Next Hairstyle Before You Cut It.",
    description:
      "See Your Next Hairstyle Before You Cut It. Same Face. New Hair.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Draft My Hair - See Your Next Hairstyle Before You Cut It.",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Draft My Hair | See Your Next Hairstyle Before You Cut It.",
    description:
      "See Your Next Hairstyle Before You Cut It. Same Face. New Hair.",
    images: ["/opengraph-image"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <GenerationSessionProvider>
          <Navbar />

          {children}

          <Footer />
        </GenerationSessionProvider>
      </body>
    </html>
  );
}
