import type { NextConfig } from "next";
import pkg from './package.json';

const now = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const buildTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_TIME: buildTime,
  },
};

export default nextConfig;
