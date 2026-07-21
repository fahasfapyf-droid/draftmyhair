import type { Metadata } from "next";
import { PortfolioGallery } from "@/components/gallery/PortfolioGallery";
import { createPageMetadata } from "../metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Hairstyle Preview Gallery",
  description:
    "Browse Draft My Hair transformations and explore realistic AI hairstyle, beard and hair colour previews.",
  path: "/gallery",
});

export default function GalleryPage() {
  return <PortfolioGallery />;
}
