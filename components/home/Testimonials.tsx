"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

// Future CMS Support Structure
export interface Review {
  id: string;
  name: string;
  country: string;
  category: string;
  rating: number;
  review: string;
  image?: string;
  featured: boolean;
}

const reviews: Review[] = [
  {
    id: "rev-01",
    name: "Sarah J.",
    country: "United Kingdom",
    category: "Hairstyle Preview",
    rating: 5,
    review: "I finally booked my haircut because I already knew what it would look like. Seeing the exact length on my actual face took all the anxiety away.",
    image: "/images/reviews/thumb-hairstyle.jpg",
    featured: true,
  },
  {
    id: "rev-02",
    name: "Marcus T.",
    country: "United States",
    category: "Buzz Cut Preview",
    rating: 5,
    review: "I appreciated that my face still looked like me. The head shape mapping was incredibly accurate. It gave me the confidence to finally use the clippers without wondering 'what if'.",
    featured: true,
  },
  {
    id: "rev-03",
    name: "Elena M.",
    country: "Spain",
    category: "Hair Colour Preview",
    rating: 5,
    review: "The preview looked surprisingly natural. The lighting, shadows, and my skin tone stayed exactly the same—only the hair colour changed. It helped me avoid a costly salon mistake.",
    image: "/images/reviews/thumb-colour.jpg",
    featured: true,
  },
  {
    id: "rev-04",
    name: "James R.",
    country: "Australia",
    category: "Beard Style Preview",
    rating: 5,
    review: "I changed my beard style with much more confidence. The preview matched my actual jawline and natural growth patterns perfectly. It didn't look like a filter.",
    featured: true,
  },
  {
    id: "rev-05",
    name: "David K.",
    country: "Canada",
    category: "Bald Preview",
    rating: 5,
    review: "Seeing myself completely bald before shaving my head was surreal but incredibly helpful. It looked totally authentic, with no weird AI distortions on my forehead.",
    featured: true,
  },
  {
    id: "rev-06",
    name: "Thomas H.",
    country: "Germany",
    category: "Beard Removal Preview",
    rating: 5,
    review: "I hadn't seen my chin in 8 years. The clean-shaven preview reconstructed my jawline seamlessly. It looked exactly like a real photograph of me.",
    image: "/images/reviews/thumb-removal.jpg",
    featured: true,
  },
];

const trustMetrics = [
  { label: "Customer Satisfaction", value: "4.9/5" },
  { label: "Identity Preservation", value: "100%" },
  { label: "Average Delivery", value: "< 24h" },
  { label: "Repeat Customers", value: "34%" },
];

export const Testimonials = () => {
  // Editorial motion timings
  const ease = [0.16, 1, 0.3, 1];

  const headerVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 1, ease },
    },
  };

  const metricVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 1, ease },
    },
  };

  // Split reviews for controlled masonry layout columns
  const leftColumn = reviews.filter((_, i) => i % 2 === 0);
  const rightColumn = reviews.filter((_, i) => i % 2 === 1);

  const ReviewCard = ({ review }: { review: Review }) => (
    <motion.div
      variants={cardVariants}
      className="flex flex-col p-8 rounded-editorial bg-brand-surface border border-brand-border/60 shadow-sm transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-brand-border hover:shadow-editorial hover:-translate-y-1"
    >
      <div className="flex items-start justify-between mb-6">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-brand-ink">
            {review.name}
          </span>
          <span className="text-xs text-brand-muted">
            {review.country}
          </span>
        </div>
        <div className="flex items-center gap-0.5 text-brand-ink">
          {[...Array(review.rating)].map((_, i) => (
            <Star key={i} className="w-3.5 h-3.5 fill-current" />
          ))}
        </div>
      </div>

      <p className="text-base leading-relaxed text-brand-muted mb-8">
        &quot;{review.review}&quot;
      </p>

      <div className="mt-auto pt-6 border-t border-brand-border/50 flex items-center justify-between gap-4">
        <span className="text-[10px] uppercase tracking-widest font-semibold text-brand-ink">
          {review.category}
        </span>
        {review.image && (
          <div className="relative w-10 h-10 rounded-full overflow-hidden border border-brand-border/50 shrink-0">
            <Image
              src={review.image}
              alt={`${review.category} preview thumbnail`}
              fill
              sizes="40px"
              className="object-cover"
            />
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <section className="py-24 md:py-32 bg-brand-canvas">
      <Container>
        {/* Section Header */}
        <motion.div
          className="mb-16 md:mb-24 max-w-2xl"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={headerVariants}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-editorial text-brand-ink mb-4 text-balance">
            Trusted By People Before They Changed Their Hair
          </h2>
          <p className="text-lg text-brand-muted leading-relaxed">
            Real feedback from customers who wanted confidence before making a permanent change.
          </p>
        </motion.div>

        {/* Trust Metrics Row */}
        <motion.div
          className="mb-16 md:mb-24 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 border-y border-brand-border/50 py-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          transition={{ staggerChildren: 0.1 }}
        >
          {trustMetrics.map((metric, index) => (
            <motion.div key={index} variants={metricVariants} className="flex flex-col gap-2">
              <span className="text-2xl md:text-3xl font-semibold tracking-tight text-brand-ink">
                {metric.value}
              </span>
              <span className="text-xs uppercase tracking-widest font-medium text-brand-muted">
                {metric.label}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* Masonry Review Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          transition={{ staggerChildren: 0.15 }}
        >
          {/* Left Column */}
          <div className="flex flex-col gap-6 lg:gap-8">
            {leftColumn.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
          
          {/* Right Column */}
          <div className="flex flex-col gap-6 lg:gap-8 pt-0 md:pt-12">
            {rightColumn.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          className="mt-16 pt-8 flex justify-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={headerVariants}
        >
          <Button asChild variant="secondary" size="lg">
  <Link href="/gallery">
    View More Reviews
  </Link>
</Button>
        </motion.div>
      </Container>
    </section>
  );
};
