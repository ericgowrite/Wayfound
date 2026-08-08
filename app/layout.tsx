import type { Metadata, Viewport } from "next";
import { Karla, Geist_Mono, Nothing_You_Could_Do, Lexend_Giga } from "next/font/google";
import { AuthProvider } from "@/lib/AuthContext";
import "./globals.css";

// Hero / brand moments (marketing landing only)
const nothingYouCouldDo = Nothing_You_Could_Do({
  variable: "--font-permanent-marker",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

// Wordmark — logo only
const lexendGiga = Lexend_Giga({
  variable: "--font-lexend-giga",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

// Headings + body — replaces Nunito Sans and Noto Serif
const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wayfound — Travel that fits who you are",
  description: "Travel recommendations matched to your personality. No more endless scrolling or relying on reviews that aren't right for you.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nothingYouCouldDo.variable} ${lexendGiga.variable} ${karla.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
