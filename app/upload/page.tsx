import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { UploadPage } from "@/components/upload";
import { createPageMetadata } from "../metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Upload Your Photo",
  description:
    "Upload a clear photo to start creating a realistic AI hairstyle preview with Draft My Hair.",
  path: "/upload",
});

export default async function Upload() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/upload");

  return (
    <Suspense fallback={null}>
      <UploadPage />
    </Suspense>
  );
}
