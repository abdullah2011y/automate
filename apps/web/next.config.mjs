const isExport = process.env.CAPACITOR_BUILD === 'true' || process.env.NEXT_EXPORT === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: isExport ? 'export' : undefined,
  trailingSlash: isExport,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
