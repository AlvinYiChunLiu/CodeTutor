/** @type {import('next').NextConfig} */
const nextConfig = {
  // Files read from disk at runtime. Hosts like Vercel only upload files they can see the code import,
  // so list the demo lessons explicitly or "What is recursion?" and /lesson/<slug> break when deployed.
  outputFileTracingIncludes: {
    "/api/lesson": ["./mocks/demo/**/*.json", "./mocks/demo-voiced/**/*.json"],
    "/lesson/[slug]": ["./mocks/demo/**/*.json", "./mocks/demo-voiced/**/*.json"],
  },
};

export default nextConfig;
