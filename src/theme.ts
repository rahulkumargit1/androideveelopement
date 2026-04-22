/**
 * VeriCash mobile theme — government / USWDS-inspired palette.
 * Mirrors web/app/globals.css so the APK matches the inspector console.
 */

const gov = {
  navy:        "#1a4480",
  navyDark:    "#162e51",
  navyDeep:    "#0b1b3b",
  blue:        "#2378c3",
  blueLight:   "#d9e8f6",
  blue50:      "#eff6fb",
  red:         "#b50909",
  redMid:      "#d83933",
  gold:        "#ffbc78",
  goldDark:    "#c2850c",
};

export const semantic = {
  authentic:   { value: "#2e8540", bg: "#ecf3ec", fg: "#19381f", ring: "#94bfa2" },
  suspicious:  { value: "#e5a000", bg: "#faf3d1", fg: "#5c410a", ring: "#ddaa01" },
  counterfeit: { value: "#b50909", bg: "#f4e3db", fg: "#5b1212", ring: "#d83933" },
};

const sand = {
  5: "#f9f8f6", 10: "#f0efee", 20: "#dcdee0", 30: "#c9c9c9",
  40: "#adadad", 50: "#8d8d8d", 60: "#71767a", 70: "#565c65",
  80: "#3d4551", 90: "#1b1b1b",
};

const light = {
  page:    "#ffffff",
  canvas:  "#ffffff",
  raised:  "#ffffff",
  sunken:  sand[5],
  strip:   gov.navyDark,
  border:  sand[20],
  borderStrong: sand[30],
  divider: sand[10],
  fgPrimary:   sand[90],
  fgSecondary: sand[70],
  fgTertiary:  sand[60],
  fgDisabled:  sand[40],
  fgInverse:   "#ffffff",
  fgBrand:     gov.navy,
  accentBg:    gov.blue50,
  accentFg:    gov.navy,
};

const dark = {
  page:    "#0b1220",
  canvas:  "#111a2e",
  raised:  "#15203a",
  sunken:  "#0e1626",
  strip:   "#0b1b3b",
  border:  "#243657",
  borderStrong: "#324a76",
  divider: "#1c2a47",
  fgPrimary:   "#f1f4fa",
  fgSecondary: "#c5cee0",
  fgTertiary:  "#8a96b2",
  fgDisabled:  "#4d5b78",
  fgInverse:   "#0b1220",
  fgBrand:     "#8fc1ff",
  accentBg:    "rgba(35, 120, 195, 0.15)",
  accentFg:    "#d9e8f6",
};

export type ColorScheme = typeof light;
export const palette = { light, dark };
export { gov, sand };

// Default exported colors object kept for backwards-compat with screens that
// already imported `colors`. New screens should prefer `palette.light/dark`
// via a theme context that watches `useColorScheme()`.
export const colors = {
  brand:        gov.navy,
  brandDark:    gov.navyDark,
  brandTint:    gov.gold,
  amber:        semantic.suspicious.value,
  danger:       semantic.counterfeit.value,
  success:      semantic.authentic.value,

  bg:           light.page,
  bgDark:       dark.page,
  card:         light.raised,
  cardDark:     dark.raised,
  sunken:       light.sunken,

  text:         light.fgPrimary,
  textDark:     dark.fgPrimary,
  muted:        light.fgTertiary,
  border:       light.border,
  borderStrong: light.borderStrong,
};

export const radius = { sm: 2, md: 3, lg: 4, xl: 6, "2xl": 8, full: 9999 };
export const spacing = (n: number) => n * 4;

export const typography = {
  family: { sans: "System", serif: "Georgia", mono: "Menlo" },
  weight: { regular: "400" as const, medium: "500" as const, semibold: "600" as const, bold: "700" as const },
};

export const components = {
  button: { heightSm: 32, heightMd: 40, heightLg: 48, radius: 3 },
  input:  { height: 40, radius: 3, paddingX: 12 },
  card:   { radius: 4, padding: 20 },
  chip:   { height: 26, radius: 9999, paddingX: 10 },
};
