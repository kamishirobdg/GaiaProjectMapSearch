import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Required for SharedArrayBuffer (WebWorker stop via Atomics):
   * COOP/COEP enables crossOriginIsolated=true.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
