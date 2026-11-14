/** @type {import('next').NextConfig} */
export default {
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
    // keep pages already opened for a short time so moving between tabs feels instant; saving anything refreshes them
    staleTimes: { dynamic: 30, static: 180 },
    optimizePackageImports: ["lucide-react"],
  },
};
