import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel handles output mode automatically for serverless deployment

  // Mark pdfkit as external so its font metric .afm files are not
  // stripped during bundling — required for serverless deployments
  serverExternalPackages: ["pdfkit"],

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },

  // Compress responses
  compress: true,
};

export default nextConfig;
