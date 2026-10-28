/**
 * Design tokens — the single place to restyle the product.
 * Screens consume theme values through useTheme(); they never hardcode colors.
 */

import { useColorScheme } from "react-native";

export const spacing = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;

export const radius = { s: 8, m: 12, l: 20, round: 999 } as const;

export const type = {
  title: { fontSize: 26, fontWeight: "700" as const },
  h2: { fontSize: 20, fontWeight: "700" as const },
  h3: { fontSize: 16, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  small: { fontSize: 13, fontWeight: "400" as const },
} as const;

export interface Palette {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  border: string;
  bubbleTutor: string;
  bubbleUser: string;
}

export const palettes: Record<"light" | "dark", Palette> = {
  light: {
    background: "#F6F8F5",
    surface: "#FFFFFF",
    surfaceAlt: "#EDF2EA",
    text: "#14201A",
    textMuted: "#5A6B60",
    primary: "#1B5E20",
    primaryText: "#FFFFFF",
    accent: "#00695C",
    success: "#2E7D32",
    warning: "#B26A00",
    danger: "#C62828",
    border: "#DDE5DD",
    bubbleTutor: "#E8F0E8",
    bubbleUser: "#DCE9F5",
  },
  dark: {
    background: "#0F1512",
    surface: "#1A231E",
    surfaceAlt: "#242F28",
    text: "#E6EDE8",
    textMuted: "#9BAFA3",
    primary: "#66BB6A",
    primaryText: "#0B120D",
    accent: "#4DB6AC",
    success: "#81C784",
    warning: "#FFB74D",
    danger: "#E57373",
    border: "#2C3830",
    bubbleTutor: "#223028",
    bubbleUser: "#1E3348",
  },
};

export function useTheme(): Palette {
  const scheme = useColorScheme();
  return palettes[scheme === "dark" ? "dark" : "light"];
}
