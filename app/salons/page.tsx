import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { createPageMetadata } from "../metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Draft My Hair for Salons",
  description: "Give salon clients realistic hairstyle previews before the first cut and make consultations more confident.",
  path: "/salons",
});

export default function SalonsPage() {
  return (
    <main className="bg-brand-canvas">
      <section className="py-20 lg:py-28 border-b border-brand-border">
        <Container>
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-brand-muted">Draft My Hair for Salons</p>
              <h1 className="mt-6 text-5xl lg:text-6xl font-semibold tracking-editorial leading-tight text-brand-ink">Show clients their new hairstyle before the first cut.</h1>
              <p className="mt-8 text-xl leading-9 text-brand-muted max-w-xl">Photorealistic hairstyle previews help clients visualise their new look before the consultation becomes a commitment, increasing confidence and reducing uncertainty.</p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Button asChild size="lg"><Link href="/salon/signup">Create Salon Workspace</Link></Button>
                <Button asChild variant="secondary" size="lg"><Link href="/login">Salon Login</Link></Button>
              </div>
              <div className="mt-14 space-y-8">
                <div className="border-l-2 border-brand-border pl-6"><h3 className="font-semibold text-xl">Improve Consultation Confidence</h3><p className="mt-2 text-brand-muted">Clients can visualise their haircut before making a decision.</p></div>
                <div className="border-l-2 border-brand-border pl-6"><h3 className="font-semibold text-xl">Reduce Consultation Regret</h3><p className="mt-2 text-brand-muted">Realistic previews reduce hesitation before the haircut begins.</p></div>
                <div className="border-l-2 border-brand-border pl-6"><h3 className="font-semibold text-xl">Deliver a Premium Experience</h3><p className="mt-2 text-brand-muted">Differentiate your salon with modern visual consultations.</p></div>
              </div>
            </div>
            <div><div className="overflow-hidden rounded-3xl border border-brand-border shadow-xl"><Image src="/images/salons/consultation.jpg" alt="Salon consultation using Draft My Hair" width={900} height={1200} className="w-full h-auto object-cover" priority /></div></div>
          </div>
        </Container>
      </section>

      <section className="py-24 border-t border-brand-border">
        <Container>
          <div className="max-w-3xl"><p className="text-sm uppercase tracking-[0.25em] text-brand-muted">WHY DRAFT MY HAIR</p><h2 className="mt-6 text-4xl md:text-5xl font-semibold tracking-editorial leading-tight">Every consultation starts with uncertainty.</h2><p className="mt-8 text-xl leading-9 text-brand-muted">Clients often struggle to imagine how a new hairstyle will actually look on them. Draft My Hair replaces imagination with photorealistic previews, helping stylists and clients make confident decisions together.</p></div>
          <div className="grid lg:grid-cols-2 gap-10 mt-20">
            <Benefit title="Reduce Consultation Time" text="Instead of explaining hairstyles with reference photos, clients can immediately visualise the proposed result on their own face." />
            <Benefit title="Increase Client Confidence" text="Seeing a realistic preview helps clients commit with greater confidence before any permanent change is made." />
            <Benefit title="Deliver Premium Consultations" text="Modern visual consultations create a memorable experience and help position your salon as an innovative business." />
            <Benefit title="Preserve Client Identity" text="Every preview is designed to keep the client's facial identity unchanged while only the hairstyle is transformed." />
          </div>
        </Container>
      </section>

      <section className="py-24 border-t border-brand-border">
        <Container>
          <div className="max-w-3xl"><p className="text-sm uppercase tracking-[0.25em] text-brand-muted">CONSULTATION WORKFLOW</p><h2 className="mt-6 text-4xl md:text-5xl font-semibold tracking-editorial leading-tight">Three simple steps during every consultation.</h2></div>
          <div className="grid lg:grid-cols-3 gap-10 mt-20">
            <Step number="01" title="Capture a Client Photo" text="Take one clear front-facing photo using a phone or tablet before the consultation begins." />
            <Step number="02" title="Preview Hairstyles" text="Compare realistic hairstyle, beard or hair colour previews using the client's own photograph." />
            <Step number="03" title="Decide Together" text="Review the preview together and begin the appointment with greater confidence and clearer expectations." />
          </div>
        </Container>
      </section>

      <section className="py-24 border-t border-brand-border">
        <Container className="max-w-4xl text-center">
          <h2 className="text-4xl font-semibold">Ready to set up your salon workspace?</h2>
          <p className="mt-6 text-lg text-brand-muted">Create a salon account and start using Draft My Hair during client consultations.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4"><Button asChild size="lg"><Link href="/salon/signup">Create Salon Workspace</Link></Button><Button asChild variant="secondary" size="lg"><Link href="/login">Salon Login</Link></Button></div>
        </Container>
      </section>
    </main>
  );
}

function Benefit({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-brand-border p-10"><h3 className="text-2xl font-semibold">{title}</h3><p className="mt-5 text-brand-muted leading-8">{text}</p></div>;
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="rounded-2xl border border-brand-border p-10"><div className="text-5xl font-light text-brand-muted">{number}</div><h3 className="mt-8 text-2xl font-semibold">{title}</h3><p className="mt-5 leading-8 text-brand-muted">{text}</p></div>;
}
