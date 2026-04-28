import type { Metadata, Viewport } from "next";
import { Public_Sans, Source_Serif_4 } from "next/font/google";
import Nav from "@/components/Nav";
import "./globals.css";

const sans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});
const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
  weight: ["400", "600", "700", "900"],
});

const SITE_URL = "https://vericash.duckdns.org";
const SITE_NAME = "VeriCash";
const TITLE = "VeriCash — Fake Currency Detection";
const DESCRIPTION =
  "Scan any banknote and get an instant authenticity verdict. " +
  "Powered by 7 image-processing techniques including CIE Lab colour fingerprints, " +
  "FFT micro-print analysis, and a TFLite classifier. Free to use — no sign-up needed.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  keywords: [
    "fake currency detection",
    "counterfeit banknote",
    "currency authentication",
    "image processing",
    "INR USD EUR",
    "VeriCash",
  ],
  authors: [{ name: "VeriCash Project Team" }],
  creator: "VeriCash",

  /* ── Open Graph (WhatsApp, Facebook, LinkedIn, Telegram) ── */
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: `${SITE_URL}/og-preview.png?v=3`,
        width: 1200,
        height: 630,
        alt: "VeriCash — Fake Currency Detection",
        type: "image/png",
      },
    ],
    locale: "en_US",
  },

  /* ── Twitter / X card ──────────────────────────────────── */
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [`${SITE_URL}/og-preview.png?v=3`],
    creator: "@vericash",
  },

  /* ── Icons ─────────────────────────────────────────────── */
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },

  /* ── Robots ────────────────────────────────────────────── */
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },

  /* ── Canonical ─────────────────────────────────────────── */
  alternates: {
    canonical: SITE_URL,
  },
};

export const viewport: Viewport = {
  themeColor: "#162e51",
};

const themeBootstrap = `
(function () {
  try {
    var stored = localStorage.getItem('vc_theme');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={`${sans.variable} ${serif.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="bg-page text-fg-primary min-h-screen flex flex-col">
        {/* Top "official" strip — mirrors federal-site convention */}
        <div className="gov-strip">
          <div className="mx-auto max-w-container px-4 sm:px-6 py-1.5 flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs">
            <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
              <path
                fill="#ffbc78"
                d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3z"
              />
            </svg>
            <span className="truncate">An academic project · VeriCash · Office of Currency Authentication</span>
            <span className="opacity-60">·</span>
            <a href="/status" className="hover:underline shrink-0 inline-flex items-center gap-1">
              <span className="status-dot" aria-hidden="true" />
              System status
            </a>
          </div>
        </div>

        <Nav />
        <hr className="gov-rule" />

        <main className="flex-1">{children}</main>

        <footer className="mt-16 border-t border-token bg-sunken">
          <div className="mx-auto max-w-container px-4 sm:px-6 py-10 grid gap-8 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Seal className="h-9 w-9" />
                <div>
                  <div className="t-display text-lg leading-tight">VeriCash</div>
                  <div className="text-xs text-fg-tertiary">
                    Office of Currency Authentication
                  </div>
                </div>
              </div>
              <p className="text-sm text-fg-secondary max-w-prose">
                A teaching project demonstrating image-processing techniques for
                counterfeit-banknote detection. Not an official government service.
              </p>
            </div>
            <div>
              <div className="t-eyebrow mb-3">Inspector tools</div>
              <ul className="space-y-1 text-sm">
                <li><a href="/">Scan</a></li>
                <li><a href="/history">History</a></li>
                <li><a href="/members">Administration</a></li>
                <li><a href="/settings">Settings</a></li>
              </ul>
            </div>
            <div>
              <div className="t-eyebrow mb-3">Project</div>
              <ul className="space-y-1 text-sm">
                <li><a href={`${SITE_URL}/api/docs`} target="_blank" rel="noreferrer">API documentation</a></li>
                <li><a href="/status">System health</a></li>
                <li><a href="/settings?s=About">About the project</a></li>
                <li>
                  <span className="text-fg-tertiary">Version</span>{" "}
                  <span className="t-mono">v0.3.0</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-token">
            <div className="mx-auto max-w-container px-4 sm:px-6 py-4 text-xs text-fg-tertiary flex justify-between">
              <span>© {new Date().getFullYear()} VeriCash project team</span>
              <span>Built with FastAPI · Next.js · Expo · OpenCV</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

function Seal({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="#162e51" />
      <circle cx="32" cy="32" r="30" fill="none" stroke="#ffbc78" strokeWidth="2" />
      <circle cx="32" cy="32" r="22" fill="none" stroke="#ffbc78" strokeWidth="1" />
      <path d="M32 14 L36 28 L50 28 L39 36 L43 50 L32 41 L21 50 L25 36 L14 28 L28 28 Z"
            fill="#ffbc78" />
      <text x="32" y="58" textAnchor="middle" fontSize="6" fontFamily="serif"
            fill="#ffbc78" letterSpacing="0.5">VERICASH</text>
    </svg>
  );
}
