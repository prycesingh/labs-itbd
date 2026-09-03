import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // uploads-storage lives one level above the project root;
  // expand the tracing root so Turbopack doesn't treat ".." as out-of-scope.
  outputFileTracingRoot: path.join(/*turbopackIgnore: true*/ __dirname, ".."),
  // ffmpeg-static exports a filesystem path to its bundled binary
  // (node_modules/ffmpeg-static/ffmpeg.exe) computed from its own
  // __dirname. Left un-externalized, Turpoback/webpack bundles that module
  // into a server chunk under .next/server/chunks/, which changes what
  // __dirname resolves to at runtime and silently breaks the path the
  // delivery-scoring pipeline (lib/interview/deliveryScoring.ts) passes to
  // execFile — every acoustic (pitch/loudness) decode then throws and gets
  // swallowed by that file's try/catch, degrading every Interview Coach
  // answer to pace-only delivery metrics with no visible error. Marking it
  // external keeps its own module resolution (and __dirname) intact.
  serverExternalPackages: ["ffmpeg-static"],
};

export default nextConfig;
