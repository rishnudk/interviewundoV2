import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Providers } from '@/providers';
import { GoogleAnalytics } from '@next/third-parties/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://interviewundo.com'),
  title: {
    default: 'interviewUndo — Master Technical Interviews',
    template: '%s | interviewUndo',
  },
  description:
    'A premium coding prep platform with interactive workspace, real-time code executions, and AI-powered feedback.',
  keywords: [
    'coding preparation',
    'technical interview prep',
    'software engineering interviews',
    'interactive coding workspace',
    'real-time code execution',
    'AI code feedback',
    'interview simulator',
    'leetcode preparation',
    'system design prep',
  ],
  authors: [{ name: 'interviewUndo Team' }],
  creator: 'interviewUndo',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://interviewundo.com',
    title: 'interviewUndo — Master Technical Interviews',
    description:
      'A premium coding prep platform with interactive workspace, real-time code executions, and AI-powered feedback.',
    siteName: 'interviewUndo',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'interviewUndo — Master Technical Interviews',
    description:
      'A premium coding prep platform with interactive workspace, real-time code executions, and AI-powered feedback.',
    creator: '@interviewundo',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
      {process.env.NEXT_PUBLIC_GA_ID && <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />}
    </html>
  );
}
