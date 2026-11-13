/** @type {import('next').NextConfig} */
export default {
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};
