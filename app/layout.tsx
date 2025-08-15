import './globals.css';
import { ReactNode } from 'react';
import Header from '@/components/Header';

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en">
            <body className="min-h-screen">
                <Header />
                <main className="mx-auto max-w-6xl p-4">{children}</main>
            </body>
        </html>
    );
}
