import type { Metadata } from "next";
import { Geist, Geist_Mono, DM_Mono} from "next/font/google";
import "./globals.css";
import { Providers } from "../components/Providers";

// Force dynamic rendering for the entire app
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-dm-mono",
});


export const metadata: Metadata = {
  title: "Miden Multisig",
  description: "Miden Multisig Wallet",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${dmMono.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
