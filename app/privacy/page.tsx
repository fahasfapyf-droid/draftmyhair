import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { createPageMetadata } from "../metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Privacy Policy",
  description:
    "Read the Draft My Hair privacy policy and learn how uploaded photos and personal information are handled.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <section className="py-24 bg-brand-canvas">
      <Container className="max-w-4xl">
        <h1 className="text-5xl font-semibold tracking-editorial">
          Privacy Policy
        </h1>

        <div className="mt-10 space-y-8 text-brand-muted leading-8">

          <section>
            <h2 className="text-2xl font-semibold text-brand-ink">
              Information We Collect
            </h2>
            <p>
              We collect only the information necessary to provide hairstyle
              preview services and improve our platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-brand-ink">
              Uploaded Images
            </h2>
            <p>
              Images are used solely to create requested previews and are never
              sold to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-brand-ink">
              Contact
            </h2>
            <p>
              For privacy enquiries, contact:
              privacy@draftmyhair.com
            </p>
          </section>

        </div>
      </Container>
    </section>
  );
}
