import type { NextConfig } from "next";
import pkg from './package.json';

const now = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
const buildTime = `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())} ${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_TIME: buildTime,
  },
};

export default nextConfig;
