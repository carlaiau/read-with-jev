import type { NextConfig } from 'next';
const config: NextConfig = {
 output: 'standalone',
 async rewrites() { return [{ source: '/.netlify/functions/library', destination: '/api/library' }]; },
 outputFileTracingIncludes: {
  '/api/library': ['./data/library/*.json'],
  '/api/book': ['./data/processed/mentions.json', './data/processed/speaking.json'],
  '/api/emotions': ['./data/library/*.json', './data/processed/mentions.json', './data/processed/speaking.json', './data/processed/affect.json'],
 },
};
export default config;
