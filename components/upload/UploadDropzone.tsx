// components/upload/UploadDropzone.tsx
"use client";

import React, { useRef } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface UploadDropzoneProps {
  onFileSelect: (file: File) => void;
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({ onFileSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  const handleFileChange = (
  e: React.ChangeEvent<HTMLInputElement>
) => {
  const file = e.target.files?.[0];

  if (file) {
    onFileSelect(file);

    // Allow selecting the same file again
    e.target.value = "";
  }
};

  return (
    <div 
      className="relative w-full min-h-[420px] group cursor-pointer"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label="Upload your photo"
      onKeyDown={handleKeyDown}
    >
      <input
  type="file"
  aria-label="Choose a photo to upload"
        ref={fileInputRef} 
        className="hidden" 
        accept="image/jpeg, image/png, image/jpg" 
        onChange={handleFileChange}
      />

      <div className="absolute inset-0 bg-brand-surface rounded-editorial shadow-sm transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:shadow-editorial group-hover:border-brand-ink/20 border border-brand-border" />
      
      <div className="relative min-h-[420px] py-20 px-6 flex flex-col items-center justify-center text-center border border-dashed border-transparent transition-colors duration-700 group-hover:border-brand-border/80 rounded-editorial m-2">
        <div className="w-16 h-16 mb-6 rounded-full bg-brand-canvas flex items-center justify-center border border-brand-border shadow-sm transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 group-hover:bg-brand-surface">
          <UploadCloud className="w-6 h-6 text-brand-ink opacity-70" />
        </div>
        
        <h3 className="text-xl md:text-2xl font-medium tracking-tight text-brand-ink mb-2">
          Drag and drop your photo here
        </h3>
        <p className="text-brand-muted mb-8">
          or click to browse your files
        </p>

        <Button 
          variant="secondary" 
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
        >
          Browse Files
        </Button>

        <div className="mt-8 flex items-center gap-2 text-[11px] uppercase tracking-widest font-semibold text-brand-muted">
          <span>JPG, JPEG, PNG</span>
          <span className="w-1 h-1 rounded-full bg-brand-border" />
          <span>Max 10 MB</span>
        </div>
      </div>
    </div>
  );
};