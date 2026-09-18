import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: { '/api/book': ['./data/processed/mentions.json', './data/processed/speaking.json'] },
};
export default config;
