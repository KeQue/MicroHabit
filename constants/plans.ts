export type PlanTier = "A" | "B" | "C";
export type UserTier = "free" | PlanTier;

export const PLAN_COPY: Record<
  PlanTier,
  {
    name: string;
    price: string;
    shortLabel: string;
    subtitle: string;
    example: string;
  }
> = {
  A: {
    name: "Friendly League",
    price: "EUR 5 per person",
    shortLabel: "Friendly",
    subtitle: "Commit together. Give together. All rewards go to charity.",
    example: "No winner reward.",
  },
  B: {
    name: "Competitive League",
    price: "EUR 10 per person",
    shortLabel: "Competitive",
    subtitle: "Show up. Or pay up. Winner reward grows with league size.",
    example: "3 players -> winner about EUR 15.",
  },
  C: {
    name: "Elite League",
    price: "EUR 20 per person",
    shortLabel: "Elite",
    subtitle: "Highest stakes. Biggest reward. For serious commitment leagues.",
    example: "3 players -> winner about EUR 31.",
  },
};

export function planLabel(isFreeSelected: boolean, selectedPlanTier: PlanTier | null) {
  if (isFreeSelected) return "Free";
  if (selectedPlanTier) return PLAN_COPY[selectedPlanTier].shortLabel;
  return "Choose a plan";
}

export function planName(tier: PlanTier | null | undefined) {
  return tier ? PLAN_COPY[tier].name : "Free league";
}
