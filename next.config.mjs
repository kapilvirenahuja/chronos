/** @type {import('next').NextConfig} */
const nextConfig = {
  typedRoutes: true,
  outputFileTracingIncludes: {
    "/*": ["./config/**/*", "./system/**/*", "./db/**/*"]
  }
};

export default nextConfig;
