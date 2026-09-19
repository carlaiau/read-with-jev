import type { Metadata } from 'next';
import './globals.css';

const description = 'A research reader for classic novels: a whole-book character map and adjustable JEV sentence-emotion highlights you can tune as you read.';

/** Absolute social image URLs need an origin. Netlify supplies one at build time. */
function siteUrl(): URL {
  for (const candidate of [process.env.NEXT_PUBLIC_SITE_URL, process.env.URL, process.env.DEPLOY_PRIME_URL]) {
    if (!candidate) continue;
    try { return new URL(candidate); } catch { /* An unusable value must not fail the build. */ }
  }
  return new URL('http://127.0.0.1:3000');
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: 'readwithjev',
  description,
  applicationName: 'readwithjev',
  openGraph: { type: 'website', siteName: 'readwithjev', title: 'readwithjev', description },
  twitter: { card: 'summary_large_image', title: 'readwithjev', description },
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
