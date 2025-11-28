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
      if (stored) return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    const theme = getTheme();
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  })();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
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