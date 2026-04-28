"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ScanLine, History, Building2, Settings, Activity,
  Sun, Moon, LogIn, LogOut, Eye,
} from "lucide-react";
import clsx from "clsx";
import { api, type UserOut } from "@/lib/api";

/* Nav links are role-gated:
 *   admin     → Scan, History, Administration, Settings
 *   inspector → Scan, History, Administration, Settings
 *   viewer    → History, Administration, Settings  (no Scan)
 *   anonymous → Scan, History, Administration, Settings (scan page shows sign-in prompt)
 */
const ALL_LINKS = [
  { href: "/",         label: "Scan",           icon: ScanLine,   viewerHidden: true  },
  { href: "/history",  label: "History",        icon: History,    viewerHidden: false },
  { href: "/members",  label: "Administration", icon: Building2,  viewerHidden: false },
  { href: "/settings", label: "Settings",       icon: Settings,   viewerHidden: false },
  { href: "/status",   label: "Status",         icon: Activity,   viewerHidden: false },
];

const ROLE_STYLE: Record<string, string> = {
  admin:     "chip chip-gold",
  inspector: "chip chip-brand",
  viewer:    "chip",
};

const ROLE_LABEL: Record<string, string> = {
  admin:     "Admin",
  inspector: "Inspector",
  viewer:    "Viewer",
};

export default function Nav() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [me, setMe] = useState<UserOut | null>(null);

  useEffect(() => {
    setTheme((document.documentElement.getAttribute("data-theme") as any) || "light");
    api.me().then(setMe).catch(() => setMe(null));
    const onAuth = () => api.me().then(setMe).catch(() => setMe(null));
    window.addEventListener("vc-auth-changed", onAuth);
    return () => window.removeEventListener("vc-auth-changed", onAuth);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("vc_theme", next); } catch {}
    setTheme(next);
  }
  function signOut() {
    api.logout();
    setMe(null);
    window.dispatchEvent(new Event("vc-auth-changed"));
  }

  const isViewer = me?.role === "viewer";
  const visibleLinks = ALL_LINKS.filter((l) => !(isViewer && l.viewerHidden));

  return (
    <header className="bg-canvas border-b border-token">
      <div className="mx-auto max-w-container px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-6 justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 sm:gap-3 no-underline shrink-0" aria-label="VeriCash home">
          <SealMark className="h-9 w-9 sm:h-12 sm:w-12" />
          <div className="leading-tight">
            <div className="t-display text-base sm:text-xl text-fg-primary">VeriCash</div>
            <div className="text-[10px] sm:text-xs text-fg-secondary">Office of Currency Authentication</div>
          </div>
        </Link>

        {/* Right side: user info + theme */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {me ? (
            <div className="hidden md:flex items-center gap-2 mr-2">
              <span className="text-sm text-fg-secondary truncate max-w-[160px]">{me.full_name}</span>
              <span className={ROLE_STYLE[me.role] ?? "chip"}>
                {me.role === "viewer" && <Eye className="h-3 w-3 inline mr-1" />}
                {ROLE_LABEL[me.role] ?? me.role}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={signOut} aria-label="Sign out">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          ) : (
            <Link href="/settings" className="btn btn-secondary btn-sm hidden sm:inline-flex">
              <LogIn className="h-4 w-4" /> Sign in
            </Link>
          )}
          {/* Mobile: show user initial or sign-in */}
          {me ? (
            <button
              className="btn btn-ghost btn-sm md:hidden flex items-center gap-1"
              onClick={signOut}
              aria-label="Sign out"
            >
              <span className="h-5 w-5 rounded-full text-[10px] font-bold grid place-items-center text-white"
                    style={{ background: "var(--gov-navy)" }}>
                {me.full_name?.charAt(0)?.toUpperCase() || "U"}
              </span>
              <LogOut className="h-3.5 w-3.5" />
            </button>
          ) : (
            <Link href="/settings" className="btn btn-ghost btn-sm sm:hidden">
              <LogIn className="h-4 w-4" />
            </Link>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="btn btn-ghost btn-icon btn-sm"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Nav bar */}
      <nav className="bg-strip text-white overflow-x-auto" aria-label="Primary navigation">
        <div className="mx-auto max-w-container px-4 sm:px-6 flex">
          {visibleLinks.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold no-underline border-b-4 transition-colors duration-quick ease-std whitespace-nowrap",
                  active
                    ? "border-gov-gold bg-white/5 text-white"
                    : "border-transparent text-white/85 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {label}
              </Link>
            );
          })}

          {/* Viewer badge in nav */}
          {isViewer && (
            <div className="ml-auto flex items-center px-4 py-3 gap-1.5 text-xs text-white/60 whitespace-nowrap">
              <Eye className="h-3.5 w-3.5" />
              Read-only
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}

function SealMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="#162e51" />
      <circle cx="32" cy="32" r="30" fill="none" stroke="#ffbc78" strokeWidth="2" />
      <circle cx="32" cy="32" r="22" fill="none" stroke="#ffbc78" strokeWidth="1" />
      <path d="M32 14 L36 28 L50 28 L39 36 L43 50 L32 41 L21 50 L25 36 L14 28 L28 28 Z" fill="#ffbc78" />
    </svg>
  );
}
