import type { NextConfig } from "next";

// Site 100% estático: `next build` gera a pasta `out/`, publicada pela Netlify.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
