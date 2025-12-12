import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "./ConvexClientProvider";
import { ClerkProvider } from '@clerk/nextjs'

const nunito = Nunito({ 
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-nunito"
});

export const metadata: Metadata = {
  title: "Kayra - the Game Creator",
  description: "Create 3D mobile games with AI",
}

// Script to prevent flash of wrong theme
const themeScript = `
  (function() {
    function getTheme() {
      const stored = localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark') return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    const theme = getTheme();
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  })();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning className="dark:dark">
        <head>
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
          <style dangerouslySetInnerHTML={{ __html: ':root { color-scheme: light dark; }' }} />
        </head>
        <body className={`${nunito.className} ${nunito.variable}`} suppressHydrationWarning>
          <ConvexClientProvider>
            {children}
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}