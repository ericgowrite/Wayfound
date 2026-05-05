export interface FitTier {
  min: number;
  label: string;
  emoji: string;
  text: string;
  border: string;
  bg: string;
  hex: string;
}

export const FIT_TIERS: FitTier[] = [
  {
    min: 80,
    label: "Strong fit",
    emoji: "✅",
    text: "text-green-600 dark:text-green-400",
    border: "border-green-400 dark:border-green-800",
    bg: "bg-green-50 dark:bg-green-950/30",
    hex: "#16a34a",
  },
  {
    min: 65,
    label: "Good with tradeoffs",
    emoji: "⚠️",
    text: "text-yellow-600 dark:text-yellow-400",
    border: "border-yellow-400 dark:border-yellow-800",
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    hex: "#ca8a04",
  },
  {
    min: 50,
    label: "Marginal fit",
    emoji: "🟠",
    text: "text-orange-600 dark:text-orange-400",
    border: "border-orange-400 dark:border-orange-800",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    hex: "#ea580c",
  },
  {
    min: 0,
    label: "Poor fit",
    emoji: "❌",
    text: "text-red-600 dark:text-red-400",
    border: "border-red-400 dark:border-red-700",
    bg: "bg-red-50 dark:bg-red-950/30",
    hex: "#dc2626",
  },
];

export function fitTier(score: number): FitTier {
  return FIT_TIERS.find((t) => score >= t.min) ?? FIT_TIERS[FIT_TIERS.length - 1];
}
