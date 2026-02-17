/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['avatars.githubusercontent.com', 'github.com'],
  },
  output: 'standalone',
  experimental: {
    serverActions: {
      allowedOrigins: ['https://unreefed-noncustomarily-marielle.ngrok-free.dev'],
    },
  },
}

module.exports = nextConfig
