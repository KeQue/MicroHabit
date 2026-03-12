export type PlanTier = "A" | "B" | "C";
export type UserTier = "free" | PlanTier;

export type CommitmentPlan = {
  tier: PlanTier;
  name: string;
  fullName: string;
  priceEuros: number;
  tone: string;
  message: string;
  quickDifference: string;
  summary: string;
  secondarySummary?: string;
  cta: string;
  previewTitle?: string;
  preview: string;
  featured?: boolean;
};

const PLAN_MAP: Record<PlanTier, CommitmentPlan> = {
  A: {
    tier: "A",
    name: "Friendly",
    fullName: "Friendly League",
    priceEuros: 5,
    tone: "Social accountability",
    message: "Commit together. Give together.",
    quickDifference: "No winner. All to charity.",
    summary: "All contributions go to charity.",
    cta: "Easy start",
    preview: "",
  },
  B: {
    tier: "B",
    name: "Competitive",
    fullName: "Competitive League",
    priceEuros: 10,
    tone: "Balanced competition",
    message: "Show up. Or pay up.",
    quickDifference: "Winner takes most of the pot.",
    summary: "70% to winner · 30% to charity",
    cta: "Most popular",
    previewTitle: "Example with 4 players",
    preview: "Winner ≈ \u20AC25",
    featured: true,
  },
  C: {
    tier: "C",
    name: "Elite",
    fullName: "Elite League",
    priceEuros: 20,
    tone: "Serious commitment",
    message: "Highest stakes. Biggest reward.",
    quickDifference: "Highest stakes. Biggest reward.",
    summary: "80% to winner · 20% to charity",
    cta: "Highest commitment",
    preview: "",
  },
};

export const PLAN_ORDER: PlanTier[] = ["A", "B", "C"];

export function getCommitmentPlan(tier: PlanTier): CommitmentPlan {
  return PLAN_MAP[tier];
}

export function getPlanName(tier: PlanTier | null | undefined) {
  if (!tier) return "Choose a commitment level";
  return PLAN_MAP[tier].name;
}

export function getPlanFullName(tier: PlanTier | null | undefined) {
  if (!tier) return "Choose a commitment level";
  return PLAN_MAP[tier].fullName;
}

export function getUserTierLabel(tier: UserTier) {
  if (tier === "free") return "Free trial";
  return PLAN_MAP[tier].fullName;
}
