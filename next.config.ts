import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // uploads-storage lives one level above the project root;
  // expand the tracing root so Turbopack doesn't treat ".." as out-of-scope.
  outputFileTracingRoot: path.join(/*turbopackIgnore: true*/ __dirname, ".."),
};

export default nextConfig;
