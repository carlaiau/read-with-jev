import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Read with JEV · Document library', description: 'Explore character name matches across a library of novels, stories, and drama.' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
