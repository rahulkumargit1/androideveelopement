import type { Config } from "tailwindcss";

/**
 * Tailwind config for the VeriCash government / USWDS-inspired theme.
 * The design tokens live in `app/globals.css` as CSS custom properties so
 * they auto-flip per [data-theme]; here we just expose the palette as
 * Tailwind utilities for ergonomic class-name composition.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // USWDS-style government palette
        gov: {
          navy:        "#1a4480",
          "navy-dark": "#162e51",
          "navy-deep": "#0b1b3b",
          blue:        "#2378c3",
          "blue-light":"#d9e8f6",
          "blue-50":   "#eff6fb",
          red:         "#b50909",
          "red-mid":   "#d83933",
          "red-light": "#f8dfe2",
          gold:        "#ffbc78",
          "gold-dark": "#c2850c",
        },
        sand: {
          5:  "#f9f8f6",
          10: "#f0efee",
          20: "#dcdee0",
          30: "#c9c9c9",
          40: "#adadad",
          50: "#8d8d8d",
          60: "#71767a",
          70: "#565c65",
          80: "#3d4551",
          90: "#1b1b1b",
        },
        // Verdict semantics
        authentic:   { DEFAULT: "#2e8540", bg: "#ecf3ec", fg: "#19381f", ring: "#94bfa2" },
        suspicious:  { DEFAULT: "#e5a000", bg: "#faf3d1", fg: "#5c410a", ring: "#ddaa01" },
        counterfeit: { DEFAULT: "#b50909", bg: "#f4e3db", fg: "#5b1212", ring: "#d83933" },
        // CSS-var bound surfaces & foregrounds (auto-flip per theme)
        page:    "var(--bg-page)",
        canvas:  "var(--bg-canvas)",
        raised:  "var(--bg-raised)",
        sunken:  "var(--bg-sunken)",
        strip:   "var(--bg-strip)",
        fg: {
          primary:   "var(--fg-primary)",
          secondary: "var(--fg-secondary)",
          tertiary:  "var(--fg-tertiary)",
          disabled:  "var(--fg-disabled)",
          link:      "var(--fg-link)",
          brand:     "var(--fg-brand)",
          inverse:   "var(--fg-inverse)",
        },
      },
      borderColor: {
        DEFAULT: "var(--border)",
        strong:  "var(--border-strong)",
      },
      borderRadius: {
        none: "0",
        sm: "2px",
        md: "3px",
        lg: "4px",
        xl: "6px",
        "2xl": "8px",
        full: "9999px",
      },
      boxShadow: {
        xs: "var(--sh-xs)",
        sm: "var(--sh-sm)",
        md: "var(--sh-md)",
        lg: "var(--sh-lg)",
        xl: "var(--sh-xl)",
        focus: "var(--sh-focus)",
      },
      fontFamily: {
        sans:  ["var(--font-public-sans)", "Public Sans", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        serif: ["var(--font-source-serif)", "Source Serif 4", "Source Serif Pro", "Georgia", "serif"],
        mono:  ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        xs:   ["12px", { lineHeight: "16px" }],
        sm:   ["13px", { lineHeight: "20px" }],
        base: ["15px", { lineHeight: "24px" }],
        md:   ["16px", { lineHeight: "26px" }],
        lg:   ["18px", { lineHeight: "28px" }],
        xl:   ["22px", { lineHeight: "30px", letterSpacing: "-0.005em" }],
        "2xl":["28px", { lineHeight: "36px", letterSpacing: "-0.01em" }],
        "3xl":["36px", { lineHeight: "44px", letterSpacing: "-0.015em" }],
        "4xl":["44px", { lineHeight: "52px", letterSpacing: "-0.02em" }],
      },
      transitionTimingFunction: {
        std: "cubic-bezier(0.2, 0, 0, 1)",
      },
      maxWidth: {
        container: "1200px",
        prose: "72ch",
      },
      zIndex: {
        nav: "30",
        modal: "50",
        toast: "60",
      },
    },
  },
  plugins: [],
};
export default config;
