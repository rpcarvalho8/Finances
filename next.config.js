/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 14 name for this option (`serverExternalPackages` only exists in Next 15+).
  experimental: {
    serverComponentsExternalPackages: ['@libsql/client', 'pdfjs-dist'],
  },
}
module.exports = nextConfig
