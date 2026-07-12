import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

export default function ContactPage() {
  return (
    <section className="py-24 bg-brand-canvas">
      <Container className="max-w-3xl">
        <h1 className="text-5xl font-semibold tracking-editorial text-brand-ink">
          Contact Us
        </h1>

        <p className="mt-6 text-lg leading-8 text-brand-muted">
          Whether you have a question about a hairstyle preview, want to suggest
          a new feature, report an issue, or discuss a business partnership,
          we'd love to hear from you.
        </p>

        <div className="mt-16 rounded-editorial border border-brand-border bg-brand-surface shadow-editorial p-8 md:p-12">
          <form className="space-y-8">

            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-brand-ink mb-2"
              >
                Name *
              </label>

              <input
                id="name"
                type="text"
                placeholder="Your name"
                className="w-full rounded-editorial border border-brand-border bg-brand-surface px-4 py-3 outline-none focus:border-brand-ink transition-colors"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-brand-ink mb-2"
              >
                Email *
              </label>

              <input
                id="email"
                type="email"
                placeholder="your@email.com"
                className="w-full rounded-editorial border border-brand-border bg-brand-surface px-4 py-3 outline-none focus:border-brand-ink transition-colors"
              />
            </div>

            {/* Subject */}
            <div>
              <label
                htmlFor="subject"
                className="block text-sm font-medium text-brand-ink mb-2"
              >
                Subject *
              </label>

              <select
                id="subject"
                className="w-full rounded-editorial border border-brand-border bg-brand-surface px-4 py-3 outline-none focus:border-brand-ink transition-colors"
              >
                <option>General Question</option>
                <option>Preview Support</option>
                <option>Feature Request</option>
                <option>Report a Problem</option>
                <option>Salon Partnership</option>
                <option>Business Enquiry</option>
                <option>Media / Press</option>
                <option>Other</option>
              </select>

              <p className="mt-3 text-xs text-brand-muted/80">
                We typically respond within 1–2 business days. For urgent issues, please mention it in your message.
              </p>
            </div>

            {/* Message */}
            <div>
              <label
                htmlFor="message"
                className="block text-sm font-medium text-brand-ink mb-2"
              >
                Message *
              </label>

              <textarea
                id="message"
                rows={7}
                placeholder="Tell us how we can help. Include as much detail as you'd like."
                className="w-full rounded-editorial border border-brand-border bg-brand-surface px-4 py-3 outline-none focus:border-brand-ink transition-colors resize-none"
              />
            </div>

            <div className="flex justify-center">
              <Button size="lg">
                Send Enquiry
              </Button>
            </div>

            <p className="text-xs text-brand-muted text-center">
              We respect your privacy. Your information will only be used to
              respond to your enquiry.
            </p>

          </form>
        </div>
      </Container>
    </section>
  );
}