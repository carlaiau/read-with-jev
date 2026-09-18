import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Read with JEV · Character atlas', description: 'Explore annotated character mentions and dialogue in Pride and Prejudice.' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
