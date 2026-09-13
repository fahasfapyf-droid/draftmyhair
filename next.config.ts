import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["argon2", "sharp"],
  images: {
    qualities: [75, 100],

    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "**.private.blob.vercel-storage.com",
      },
    ],
  },
  // Phase 2: exclude Prisma WASM engine/compiler assets that are never loaded
  // at runtime. engineType is hardcoded "library" (see .prisma/client/index.js),
  // and the WASM loaders require a driver adapter this app does not configure.
  outputFileTracingExcludes: {
    "*": [
      "./node_modules/@prisma/client/runtime/query_engine_bg.*",
      "./node_modules/@prisma/client/runtime/query_compiler_bg.*",
      "./node_modules/.prisma/client/query_engine_bg.wasm",
      // Phase 4: exclude musl libc variants of sharp/libvips. Vercel runtimes
      // (IAD1, Node.js 24.x) are glibc; sharp/lib/sharp.js resolves
      // @img/sharp-${runtimePlatform} -> "linux-x64" on glibc. The musl
      // variants are packaged only because the tracer cannot evaluate the
      // dynamic platform template string.
      "./node_modules/@img/sharp-libvips-linuxmusl-x64/**",
      "./node_modules/@img/sharp-linuxmusl-x64/**",
    ],
  },

};

export default nextConfig;
