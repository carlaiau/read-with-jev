import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone',
  outputFileTracingIncludes: {
    '/api/book': ['./data/processed/mentions.json', './data/processed/speaking.json'],
    '/api/emotions': ['./data/processed/mentions.json', './data/processed/speaking.json', './data/processed/affect.json'],
  },
};
export default config;
