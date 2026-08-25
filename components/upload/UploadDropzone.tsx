"use client";

import React, { useRef, useState } from "react";
import { Camera, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface UploadDropzoneProps {
  onFileSelect: (file: File) => void;
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  onFileSelect,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const validateAndSelectFile = (file: File) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    const maxSize = 10 * 1024 * 1024;

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

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraOpen(false);
  };

  const openCamera = async () => {
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera capture is not supported by this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
        },
        audio: false,
      });

      streamRef.current = stream;
      setIsCameraOpen(true);

      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      });
    } catch {
      setError(
        "Camera access was blocked. Please allow camera permission and try again."
      );
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;

    if (!video || !video.videoWidth || !video.videoHeight) {
      setError("Camera is not ready yet. Please try again.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      setError("Unable to capture the photo. Please try again.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Unable to capture the photo. Please try again.");
          return;
        }

        validateAndSelectFile(
          new File([blob], `draft-my-hair-${Date.now()}.jpg`, {
            type: "image/jpeg",
          })
        );
        stopCamera();
      },
      "image/jpeg",
      0.95
    );
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
    <>
      <div
        className="relative min-h-[280px] md:min-h-[300px] w-full cursor-pointer rounded-editorial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-4 focus-visible:ring-offset-brand-canvas group"
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

        <div className="relative min-h-[280px] md:min-h-[300px] py-10 md:py-12 px-6 flex flex-col items-center justify-center text-center border border-dashed border-transparent rounded-editorial m-2 transition-colors duration-300">
          <div className="w-12 h-12 mb-4 rounded-full bg-brand-canvas flex items-center justify-center border border-brand-border shadow-sm">
            <UploadCloud className="w-5 h-5 text-brand-ink opacity-70" />
          </div>

          <h3 className="text-lg md:text-xl font-medium tracking-tight text-brand-ink mb-1.5">
            Drag and drop your photo here
          </h3>

          <p className="text-sm md:text-base text-brand-muted mb-5">
            or click to browse your files
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button asChild variant="secondary">
              <span>Browse Files</span>
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                void openCamera();
              }}
              aria-label="Capture photo with camera"
            >
              <Camera className="mr-2 h-4 w-4" />
              Capture Photo
            </Button>
          </div>

          {error && (
            <p id="upload-error" className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="mt-5 flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-brand-muted">
            <span>JPG, JPEG, PNG</span>
            <span className="w-1 h-1 rounded-full bg-brand-border" />
            <span>Max 10 MB</span>
          </div>
        </div>
      </div>

      {isCameraOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Capture photo"
        >
          <div className="w-full max-w-2xl rounded-editorial bg-brand-surface p-5 shadow-editorial">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-brand-ink">
                  Capture Your Photo
                </h2>
                <p className="text-sm text-brand-muted">
                  Use a front-facing camera and keep your face fully visible.
                </p>
              </div>

              <button
                type="button"
                onClick={stopCamera}
                className="rounded-full p-2 text-brand-muted transition-colors hover:bg-brand-ink/5 hover:text-brand-ink"
                aria-label="Close camera"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-hidden rounded-editorial bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="aspect-[4/3] h-auto w-full object-cover"
              />
            </div>

            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                variant="primary"
                size="lg"
                onClick={capturePhoto}
              >
                <Camera className="mr-2 h-4 w-4" />
                Take Photo
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
