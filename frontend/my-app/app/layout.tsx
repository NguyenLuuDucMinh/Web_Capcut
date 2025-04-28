import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Or choose a more 'tech' font like 'Roboto Mono'
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Podcast Video Generator",
  description: "Generate videos from podcast audio, short clips, and subtitles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* body already has flex flex-col min-h-screen from globals.css */}
      <body className={inter.className}>
        {/* You could add a Header component here */}
        <main className="flex-grow container mx-auto px-4 py-8">
          {children}
        </main>
        {/* You could add a Footer component here */}
        <footer className="text-center py-4 text-tech-text-secondary text-sm">
          Powered by Next.js & Python
        </footer>
      </body>
    </html>
  );
}