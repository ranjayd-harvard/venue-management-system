import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import NavigationLayout from '@/components/NavigationLayout';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Venue Management System',
  description: 'Manage customers, locations, and venues',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <NavigationLayout>
          {children}
        </NavigationLayout>
      </body>
    </html>
  );
}
