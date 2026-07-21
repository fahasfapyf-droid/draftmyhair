"use client";

import React from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

// ----------------------------------------------------------------------
// Data & Types
// ----------------------------------------------------------------------

interface StepData {
  id: string;
  number: string;
  title: string;
  description: string;
  imageUrl: string;
  badge?: string;
  showOptionsUI?: boolean;
  isPayoff?: boolean;
}

const steps: StepData[] = [
  {
    id: "upload",
    number: "01",
    title: "Upload Photo",
    description: "Upload a clear front-facing selfie.",
    imageUrl: "/images/process/step-1-upload.jpg",
  },
  {
    id: "choose",
    number: "02",
    title: "Choose Your Style",
    description: "Choose any hairstyle or hair colour.",
    imageUrl: "/images/process/step-2-choose.jpg",
    badge: "REFERENCE STYLE",
    showOptionsUI: true,
  },
  {
    id: "receive",
    number: "03",
    title: "See Your Preview",
    description: "See yourself with your new hairstyle before making the cut.",
    imageUrl: "/images/process/step-3-receive.jpg",
    isPayoff: true,
  },
];

// ----------------------------------------------------------------------
// Components
// ----------------------------------------------------------------------

const StepCard: React.FC<{ step: StepData }> = ({ step }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div 
      className="relative h-full z-10"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <article 
        className={`group flex flex-col h-full rounded-[24px] transition-all duration-500 ease-out relative overflow-hidden ${
          step.isPayoff 
            ? "bg-neutral-900 text-white shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-neutral-800 p-5 md:p-6 pb-4 md:pb-5" 
            : "bg-white text-neutral-900 border border-neutral-200/60 shadow-sm hover:shadow-md hover:border-neutral-300 p-5 md:p-6"
        }`}
      >
        {/* Step Number Badge */}
        <div className="text-[10px] font-mono tracking-widest uppercase mb-3 text-neutral-400">
          Step {step.number}
        </div>

        {/* Image Box 
          - Payoff card: w-full (larger presence)
          - Standard cards: w-[88%] (leaves margin, making the payoff 12% larger by contrast)
        */}
        <div className={`relative mx-auto mb-4 rounded-xl flex items-center justify-center overflow-hidden transition-transform duration-700 ease-[0.16,1,0.3,1] ${
          step.isPayoff 
            ? "w-full aspect-square md:aspect-[4/5] bg-neutral-800 border border-neutral-700/50" 
            : "w-[88%] aspect-[4/5] bg-neutral-50 border border-neutral-100 mt-1"
        }`}>
          <motion.div
            className="w-full h-full relative origin-center will-change-transform"
            animate={{ scale: isHovered ? 1.05 : 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* If it's the reference step, wrap the image in a subtle inner frame to look like a catalog card */}
            <div className={`w-full h-full relative ${step.id === "choose" ? "p-1.5" : ""}`}>
              <div className={`w-full h-full relative overflow-hidden ${step.id === "choose" ? "rounded-lg border-[3px] border-white shadow-sm" : "rounded-none"}`}>
                <Image
                  src={step.imageUrl}
                  alt={`Illustration for ${step.title}`}
                  fill
                  quality={75
                  }
                  className="object-cover object-top"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 25vw"
                />
              </div>
            </div>
            
            {/* Contextual badge for step 2 (Hairstyle Reference) */}
            {step.badge && (
              <div className="absolute top-4 right-4 z-20 px-2.5 py-1 bg-white/95 text-neutral-900 text-[9px] font-bold uppercase tracking-widest rounded shadow-md backdrop-blur-sm">
                {step.badge}
              </div>
            )}

            {/* Visual indicator of multiple options for step 2 */}
            {step.showOptionsUI && (
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex gap-2 p-1.5 bg-neutral-900/40 backdrop-blur-md rounded-full border border-white/20 shadow-lg">
                <div className="w-5 h-5 rounded-full bg-white/40 border border-white/20 transition-colors duration-300 group-hover:bg-white/60" />
                <div className="w-5 h-5 rounded-full bg-white border border-white shadow-sm ring-2 ring-white/30" />
                <div className="w-5 h-5 rounded-full bg-white/40 border border-white/20 transition-colors duration-300 group-hover:bg-white/60" />
              </div>
            )}

            {/* Subtle overlay for the payoff card to maintain contrast before hover */}
            {step.isPayoff && (
              <div 
                className={`absolute inset-0 bg-neutral-900/10 transition-opacity duration-700 ease-out ${
                  isHovered ? "opacity-0" : "opacity-100"
                }`} 
                aria-hidden="true" 
              />
            )}
          </motion.div>
        </div>
        
        {/* Subtle Divider (Spacing reduced to tighten layout) */}
        <hr className={`w-full border-t mb-3 transition-colors duration-500 ease-out ${
          step.isPayoff ? "border-neutral-800" : "border-neutral-100 group-hover:border-neutral-200"
        }`} />
        
        {/* Content (Reduced text area height on payoff card via reduced padding) */}
        <div className="mt-auto flex flex-col">
          <h3 className={`text-lg md:text-xl font-medium tracking-tight mb-1.5 ${step.isPayoff ? "text-white" : "text-neutral-900"}`}>
            {step.title}
          </h3>
          <p className={`text-sm md:text-base leading-snug ${step.isPayoff ? "text-neutral-300" : "text-neutral-500"}`}>
            {step.description}
          </p>
        </div>
      </article>
    </div>
  );
};

export const HowItWorks: React.FC = () => {
  const prefersReducedMotion = useReducedMotion();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
  };

  return (
    <section 
      className="w-full py-24 md:py-32 bg-[#FAFAFA]"
      aria-labelledby="process-heading"
    >
      <div className="w-full max-w-7xl mx-auto px-6 md:px-8">
        <motion.div 
          className="flex flex-col w-full"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {/* Section Header */}
          <motion.header 
            variants={itemVariants} 
            className="w-full max-w-2xl mx-auto text-center mb-16 md:mb-24"
          >
            <h2 
              id="process-heading"
              className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight text-neutral-900 mb-6"
            >
              How It Works
            </h2>
            <p className="text-lg md:text-xl text-neutral-500 leading-relaxed max-w-xl mx-auto">
              Three simple steps from photo to preview.
            </p>
          </motion.header>

          {/* Cards Grid with Connecting Line */}
          <div className="relative w-full max-w-6xl mx-auto mb-16 md:mb-20">
            
            {/* Connecting Track (Desktop Only) - Made more prominent to guide the eye left-to-right */}
            <div className="absolute top-[170px] left-[15%] right-[15%] h-[2px] bg-[linear-gradient(to_right,transparent,theme(colors.neutral.300)_20%,theme(colors.neutral.300)_80%,transparent)] hidden lg:block z-0" aria-hidden="true" />
            
            {/* Larger Arrow indicators on the line */}
            <div className="absolute top-[161px] left-[33%] hidden lg:block z-0 text-neutral-400 bg-[#FAFAFA] px-2" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="absolute top-[161px] right-[33%] hidden lg:block z-0 text-neutral-400 bg-[#FAFAFA] px-2" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 relative z-10">
              {steps.map((step) => (
                <motion.div key={step.id} variants={itemVariants} className="h-full">
                  <StepCard step={step} />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Footer Reassurance */}
          <motion.div 
            variants={itemVariants}
            className="w-full text-center border-t border-neutral-200 pt-10 md:pt-12"
          >
            <p className="text-xs md:text-sm font-semibold tracking-widest text-neutral-400 uppercase">
              Same Face. Only Your Hair Changes.
            </p>
          </motion.div>

        </motion.div>
      </div>
    </section>
  );
};