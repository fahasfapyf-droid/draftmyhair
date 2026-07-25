"use client";

import { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { GenerationSessionProvider } from "@/lib/context/GenerationSession";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({
  children,
}: ProvidersProps) {
  return (
    <SessionProvider>
      <GenerationSessionProvider>
        {children}
      </GenerationSessionProvider>
    </SessionProvider>
  );
}