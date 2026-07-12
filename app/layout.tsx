import "./globals.css";

import type { Metadata } from "next";
import { GenerationSessionProvider } from "@/lib/session";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.draftmyhair.com"),

  title: {
    default: "Draft My Hair | Photorealistic AI Hairstyle Previews",
    template: "%s | Draft My Hair",
  },

  description:
    "See your next hairstyle before you cut it. Photorealistic AI hairstyle, beard, bald and hair colour previews with exact identity preservation.",

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
    "Draft My Hair",
  ],

  authors: [
    {
      name: "Draft My Hair",
    },
  ],

  creator: "Draft My Hair",
  publisher: "Draft My Hair",

  alternates: {
    canonical: "https://www.draftmyhair.com",
  },

  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.draftmyhair.com",
    siteName: "Draft My Hair",
    title: "Draft My Hair | Photorealistic AI Hairstyle Previews",
    description:
      "Preview hairstyles, beard styles, bald looks and hair colours before making a permanent change.",
    
  },

  twitter: {
    card: "summary_large_image",
    title: "Draft My Hair | Photorealistic AI Hairstyle Previews",
    description:
      "See yourself with a new hairstyle before you commit.",
    
  },

  robots: {
    index: true,
    follow: true,
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