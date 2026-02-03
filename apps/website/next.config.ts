/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import '@repo/env';

/** @type {import("next").NextConfig} */
const config = {
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: require('node:path').join(__dirname, '../../'),
  },
};

export default config;
