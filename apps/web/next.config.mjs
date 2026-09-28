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
  ...(isExport
    ? {}
    : {
        async rewrites() {
          return [
            {
              source: '/api/backend/:path*',
              destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/v1/:path*`,
            },
          ];
        },
      }),
};

export default nextConfig;
