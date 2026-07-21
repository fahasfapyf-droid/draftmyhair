import type { Metadata } from "next";
import { StyleSelectionPage } from "@/components/style-selection";
import { createPageMetadata } from "../metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Choose Your Hairstyle",
  description:
    "Explore hairstyle options and choose the look you want to preview on your own photo.",
  path: "/style-selection",
});

export default function Page() {
  return <StyleSelectionPage />;
}
