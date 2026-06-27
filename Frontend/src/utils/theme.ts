import {
  getSettingsFromCookies,
  saveSettingsToCookies,
  type AppearanceTheme,
} from "../services/api";

export type ResolvedTheme = Exclude<AppearanceTheme, "system">;

export interface ThemePalette {
  id: AppearanceTheme;
  name: string;
  description: string;
  colors: string[];
  preview: {
    background: string;
    inbound: string;
    outbound: string;
    text: string;
  };
}

export const THEME_PALETTES: ThemePalette[] = [
  {
    id: "system",
    name: "System",
    description: "White or black",
    colors: ["#f8fafc", "#111318", "#65758f"],
    preview: {
      background: "linear-gradient(135deg, #f8fafc 0 50%, #111318 50% 100%)",
      inbound: "#e5e7eb",
      outbound: "#65758f",
      text: "#111827",
    },
  },
  {
    id: "white",
    name: "White",
    description: "Clean light",
    colors: ["#f7f8fa", "#e8ebef", "#5f6878"],
    preview: {
      background: "#f7f8fa",
      inbound: "#e8ebef",
      outbound: "#5f6878",
      text: "#0f172a",
    },
  },
  {
    id: "black",
    name: "Black",
    description: "Deep dark",
    colors: ["#111318", "#20242c", "#65758f"],
    preview: {
      background: "#111318",
      inbound: "#20242c",
      outbound: "#65758f",
      text: "#eef2f7",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Orange & peach",
    colors: ["#ff6533", "#ffc5aa", "#faeee8"],
    preview: {
      background: "#fff0e8",
      inbound: "#ffd8c7",
      outbound: "#ff6533",
      text: "#431a08",
    },
  },
  {
    id: "lavender",
    name: "Lavender",
    description: "Purple & violet",
    colors: ["#7653e8", "#b9a8f4", "#f0ecf8"],
    preview: {
      background: "#f0ecf8",
      inbound: "#ded4fb",
      outbound: "#7653e8",
      text: "#2f1997",
    },
  },
  {
    id: "mint",
    name: "Mint",
    description: "Green & teal",
    colors: ["#1ba37a", "#9de0d0", "#e9f8f4"],
    preview: {
      background: "#e8f7f2",
      inbound: "#b7eadb",
      outbound: "#1ba37a",
      text: "#073c32",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Dark blue",
    colors: ["#4b8df7", "#252a47", "#17172a"],
    preview: {
      background: "#17172a",
      inbound: "#252a47",
      outbound: "#4b8df7",
      text: "#d8e7ff",
    },
  },
  {
    id: "blossom",
    name: "Blossom",
    description: "Pink & rose",
    colors: ["#e8438b", "#ffc0d8", "#fdeef4"],
    preview: {
      background: "#fff0f6",
      inbound: "#ffc5dc",
      outbound: "#e8438b",
      text: "#8a1548",
    },
  },
  {
    id: "gold",
    name: "Gold",
    description: "Amber & beige",
    colors: ["#c77712", "#ffc86d", "#f8ecd6"],
    preview: {
      background: "#fbf5e9",
      inbound: "#ffe2a2",
      outbound: "#c77712",
      text: "#693b08",
    },
  },
];

export const getSavedAppearanceTheme = (): AppearanceTheme => {
  const fromCookies = getSettingsFromCookies()?.appearanceTheme;
  if (fromCookies && THEME_PALETTES.some((palette) => palette.id === fromCookies)) {
    return fromCookies;
  }

  return "system";
};

export const resolveAppearanceTheme = (
  theme: AppearanceTheme,
): ResolvedTheme => {
  if (theme !== "system") return theme;

  if (typeof window === "undefined") return "black";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "black"
    : "white";
};

export const applyAppearanceTheme = (theme = getSavedAppearanceTheme()) => {
  const resolved = resolveAppearanceTheme(theme);
  const body = document.body;

  body.classList.remove(
    "light-theme",
    ...THEME_PALETTES.map((palette) => `theme-${palette.id}`),
    "theme-white",
    "theme-black",
    "theme-system",
  );

  body.classList.add(`theme-${resolved}`);
  if (theme === "system") body.classList.add("theme-system");
  if (resolved !== "black" && resolved !== "midnight") {
    body.classList.add("light-theme");
  }

  return resolved;
};

export const saveAndApplyAppearanceTheme = (theme: AppearanceTheme) => {
  saveSettingsToCookies({ appearanceTheme: theme });
  return applyAppearanceTheme(theme);
};
