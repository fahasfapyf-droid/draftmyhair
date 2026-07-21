import { Suspense } from "react";
import type { Metadata } from "next";
import PreviewContent from "./PreviewContent";
import { createPageMetadata } from "../metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Preview Your New Hairstyle",
  description:
    "Review your selected hairstyle and prepare your personalised Draft My Hair preview.",
  path: "/preview",
});

export default function PreviewPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PreviewContent />
    </Suspense>
  );
}
