export type PlanTier = "A" | "B" | "C";
export type UserTier = "free" | PlanTier;

export type CommitmentPlan = {
  tier: PlanTier;
  name: string;
  fullName: string;
  priceEuros: number;
  currencySymbol: string;
  tone: string;
  message: string;
  quickDifference: string;
  summary: string;
  secondarySummary?: string;
  cta: string;
  previewTitle?: string;
  preview: string;
  featured?: boolean;
  purchaseNote?: string;
  minPlayers?: number;
  maxPlayers?: number;
  unlockLabel?: string;
};

const PLAN_MAP: Record<PlanTier, CommitmentPlan> = {
  A: {
    tier: "A",
    name: "Friendly",
    fullName: "Friendly League",
    priceEuros: 5,
    currencySymbol: "$",
    tone: "Social accountability",
    message: "Commit together. Give together.",
    quickDifference: "No winner. All to charity. Up to 20 players.",
    summary: "100% of net league revenue goes to charity.",
    secondarySummary: "Friendly is the charity-first option.",
    cta: "Easy start",
    preview: "",
    purchaseNote: "Store purchase required on iOS and Android before the league starts.",
    maxPlayers: 20,
  },
  B: {
    tier: "B",
    name: "Competitive",
    fullName: "Competitive League",
    priceEuros: 10,
    currencySymbol: "$",
    tone: "Balanced competition",
    message: "Show up. Or pay up.",
    quickDifference: "Minimum 2 players. Maximum 20 players.",
    summary: "Reward ladder: 2-3 players USD10, 4-6 USD22, 7-10 USD40, 11-15 USD65, 16-20 USD95.",
    secondarySummary: "A symbolic portion also supports charity. Bigger leagues unlock bigger rewards.",
    cta: "Most popular",
    previewTitle: "Competitive reward ladder",
    preview: "Invite more friends to unlock the next reward band.",
    featured: true,
    purchaseNote: "Store purchase required on iOS and Android before you can participate.",
    minPlayers: 2,
    maxPlayers: 20,
    unlockLabel: "Reward unlocks once 2 paid players join.",
  },
  C: {
    tier: "C",
    name: "Elite",
    fullName: "Elite League",
    priceEuros: 20,
    currencySymbol: "$",
    tone: "Serious commitment",
    message: "Highest stakes. Biggest reward.",
    quickDifference: "Minimum 3 players. Maximum 20 players. Elite requires 20 active days to qualify.",
    summary: "Reward ladder: 3-4 players USD28, 5-7 USD55, 8-10 USD95, 11-15 USD145, 16-20 USD200.",
    secondarySummary: "A symbolic portion also supports charity. Bigger leagues unlock bigger rewards.",
    cta: "Highest commitment",
    previewTitle: "Elite reward ladder",
    preview: "Bigger leagues unlock bigger rewards.",
    purchaseNote: "Store purchase required on iOS and Android before you can participate.",
    minPlayers: 3,
    maxPlayers: 20,
    unlockLabel: "Reward unlocks once 3 paid players join.",
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
