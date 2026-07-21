"use client";

import React, { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface UploadDropzoneProps {
  onFileSelect: (file: File) => void;
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  onFileSelect,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const validateAndSelectFile = (file: File) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    const maxSize = 10 * 1024 * 1024; // 10 MB

    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a JPG or PNG image.");
      return;
    }

    if (file.size > maxSize) {
      setError("Maximum file size is 10 MB.");
      return;
    }

    setError(null);
    onFileSelect(file);
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];

    if (file) {
      validateAndSelectFile(file);
    }

    e.target.value = "";
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (
    e: React.DragEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];

    if (file) {
      validateAndSelectFile(file);
    }
  };

  return (
    <div
      className="relative min-h-[420px] w-full cursor-pointer rounded-editorial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-4 focus-visible:ring-offset-brand-canvas group"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      aria-label="Upload your photo"
      aria-describedby={error ? "upload-error" : undefined}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/jpg,image/png"
        onChange={handleFileChange}
      />

      <div
        className={`absolute inset-0 rounded-editorial border transition-all duration-300 ${
          isDragging
            ? "bg-brand-canvas border-brand-ink shadow-editorial scale-[1.01]"
            : "bg-brand-surface border-brand-border group-hover:border-brand-ink/20 group-hover:shadow-editorial"
        }`}
      />

      <div className="relative min-h-[420px] py-20 px-6 flex flex-col items-center justify-center text-center border border-dashed border-transparent rounded-editorial m-2 transition-colors duration-300">
        <div className="w-16 h-16 mb-6 rounded-full bg-brand-canvas flex items-center justify-center border border-brand-border shadow-sm">
          <UploadCloud className="w-6 h-6 text-brand-ink opacity-70" />
        </div>

        <h3 className="text-xl md:text-2xl font-medium tracking-tight text-brand-ink mb-2">
          Drag and drop your photo here
        </h3>

        <p className="text-brand-muted mb-8">
          or click to browse your files
        </p>

        <Button asChild variant="secondary">
          <span>Browse Files</span>
        </Button>

        {error && (
          <p id="upload-error" className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-8 flex items-center gap-2 text-[11px] uppercase tracking-widest font-semibold text-brand-muted">
          <span>JPG, JPEG, PNG</span>
          <span className="w-1 h-1 rounded-full bg-brand-border" />
          <span>Max 10 MB</span>
        </div>
      </div>
    </div>
  );
};
