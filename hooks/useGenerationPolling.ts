"use client";

import { useEffect, useRef, useState } from "react";

export type PolledGenerationStatus =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

type GenerationStatusResponse = {
  status: PolledGenerationStatus;
  completedAt: string | null;
  error: string | null;
  imageUrl: string | null;
};

type UseGenerationPollingOptions = {
  generationId: string | null;
  onCompleted: (generationId: string) => void;
  onFailed: (error: string) => void;
};

const POLL_INTERVAL_MS = 1_500;
const INITIAL_RECORD_WAIT_MS = 30_000;
const MAX_POLL_DURATION_MS = 3 * 60 * 1000;

export function useGenerationPolling({
  generationId,
  onCompleted,
  onFailed,
}: UseGenerationPollingOptions) {
  const [status, setStatus] =
    useState<PolledGenerationStatus | null>(null);

  const callbacks = useRef({
    onCompleted,
    onFailed,
  });

  useEffect(() => {
    callbacks.current = {
      onCompleted,
      onFailed,
    };
  }, [onCompleted, onFailed]);

  useEffect(() => {
    if (!generationId) {
      return;
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const startedAt = Date.now();

    const controller = new AbortController();

    const stopWithFailure = (error: string) => {
      if (!cancelled) {
        callbacks.current.onFailed(error);
      }
    };

    const scheduleNextPoll = () => {
      timeout = setTimeout(poll, POLL_INTERVAL_MS);
    };

    const poll = async () => {
      try {
        if (
          Date.now() - startedAt >=
          MAX_POLL_DURATION_MS
        ) {
          stopWithFailure(
            "Your generation is taking longer than expected. Please check your Generation History in a few minutes."
          );
          return;
        }

        const response = await fetch(
          `/api/generations/${generationId}/status`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (cancelled) {
          return;
        }

        if (
          response.status === 404 &&
          Date.now() - startedAt <
            INITIAL_RECORD_WAIT_MS
        ) {
          scheduleNextPoll();
          return;
        }

        const data = (await response
          .json()
          .catch(() => null)) as
          | GenerationStatusResponse
          | { error?: string }
          | null;

        if (
          !response.ok ||
          !data ||
          !("status" in data)
        ) {
          stopWithFailure(
            data &&
              "error" in data &&
              data.error
              ? data.error
              : "Unable to check generation status."
          );
          return;
        }

        setStatus(data.status);

        if (data.status === "COMPLETED") {
          if (!data.imageUrl) {
            stopWithFailure(
              "Generation completed without a preview image."
            );
            return;
          }

          callbacks.current.onCompleted(
            generationId
          );
          return;
        }

        if (
          data.status === "FAILED" ||
          data.status === "CANCELLED"
        ) {
          stopWithFailure(
            data.error ??
              (data.status === "CANCELLED"
                ? "Generation was cancelled."
                : "Generation failed.")
          );
          return;
        }

        scheduleNextPoll();
      } catch (error) {
        if (
          cancelled ||
          (error instanceof DOMException &&
            error.name === "AbortError")
        ) {
          return;
        }

        stopWithFailure(
          "Unable to check generation status."
        );
      }
    };

    void poll();

    return () => {
      cancelled = true;

      controller.abort();

      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [generationId]);

  return generationId ? status : null;
}