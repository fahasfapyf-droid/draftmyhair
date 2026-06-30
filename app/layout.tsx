import "./globals.css";

import { GenerationSessionProvider } from "@/lib/session";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

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