import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import PreviewContent from "./PreviewContent";
import { createPageMetadata } from "../metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Preview Your New Hairstyle",
  description:
    "Review your selected hairstyle and prepare your personalised Draft My Hair preview.",
  path: "/preview",
});

export default async function PreviewPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/preview");

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PreviewContent />
    </Suspense>
  );
}
