import { Suspense } from "react";
import PreviewContent from "./PreviewContent";

export default function PreviewPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PreviewContent />
    </Suspense>
  );
}