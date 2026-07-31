import type { Metadata, Viewport } from "next";
import { Geist_Mono, Encode_Sans, Encode_Sans_Semi_Expanded, Noto_Serif, Nothing_You_Could_Do } from "next/font/google";
import { AuthProvider } from "@/lib/AuthContext";
import "./globals.css";

// Tier 1 — Hero / brand moments (marketing landing only)
const nothingYouCouldDo = Nothing_You_Could_Do({
  variable: "--font-permanent-marker",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

// Tier 2 — Wordmark, navigation, UI labels, buttons
const encodeSansSemiExpanded = Encode_Sans_Semi_Expanded({
  variable: "--font-encode-semi",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// Tier 3 — Body copy, card descriptions, form fields
const encodeSans = Encode_Sans({
  variable: "--font-encode",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

// Tier 4 — Editorial headings, judgment lines, card titles
const notoSerif = Noto_Serif({
  variable: "--font-noto-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "viyaway — Your true path to travel",
  description: "Travel recommendations matched to your personality. No more endless scrolling or relying on reviews that aren't right for you.",
};

// Explicit viewport config — without this, mobile browsers may fall back to
// rendering at a virtual desktop width and scaling down, which breaks every
// responsive Tailwind breakpoint in the app.
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
      className={`${nothingYouCouldDo.variable} ${encodeSansSemiExpanded.variable} ${encodeSans.variable} ${notoSerif.variable} ${geistMono.variable} h-full antialiased`}
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
