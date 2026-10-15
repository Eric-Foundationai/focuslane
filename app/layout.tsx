import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Focuslane',
  description: 'A simple learning planner and focus timer for new employees.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
