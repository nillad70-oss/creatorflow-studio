/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'creatorflowstudio.app',
          },
        ],
        destination: 'https://nillaflowstudio.app/:path*',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.creatorflowstudio.app',
          },
        ],
        destination: 'https://nillaflowstudio.app/:path*',
        permanent: true,
      },
    ]
  },
}
module.exports = nextConfig
