export type StatusTheme = {
  cor: string;
  bg: string;
  dot: string;
};

const THEMES: Record<string, StatusTheme> = {
  "Forte":           { cor: "text-emerald-400", bg: "bg-emerald-500/10", dot: "bg-emerald-400" },
  "Sólido":          { cor: "text-amber-400",   bg: "bg-amber-500/10",   dot: "bg-amber-400"   },
  "Em Consolidação": { cor: "text-orange-400",  bg: "bg-orange-500/10",  dot: "bg-orange-400"  },
  "Em Risco":        { cor: "text-red-400",     bg: "bg-red-500/10",     dot: "bg-red-400"     },
  "Abandonado":      { cor: "text-white/30",    bg: "bg-white/5",        dot: "bg-white/20"    },
};

const DEFAULT_THEME: StatusTheme = { cor: "text-white/40", bg: "bg-white/5", dot: "bg-white/20" };

export function getStatusTheme(label: string): StatusTheme {
  return THEMES[label] ?? DEFAULT_THEME;
}
