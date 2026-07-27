import type { BudgetGroup } from "@prisma/client";

// Default bucketing of Plaid personal-finance categories into 50/30/20 groups.
// Users will be able to reassign categories later; this seeds the initial budget.
const NEEDS = new Set([
  "RENT_AND_UTILITIES",
  "FOOD_AND_DRINK",
  "TRANSPORTATION",
  "MEDICAL",
  "LOAN_PAYMENTS",
  "BANK_FEES",
  "GENERAL_SERVICES",
  "GOVERNMENT_AND_NON_PROFIT",
]);

const WANTS = new Set([
  "ENTERTAINMENT",
  "GENERAL_MERCHANDISE",
  "HOME_IMPROVEMENT",
  "PERSONAL_CARE",
  "TRAVEL",
]);

/** Transfers out (to savings, investments, CDs) count toward the savings group. */
const SAVINGS = new Set(["TRANSFER_OUT"]);

export const GROUP_SHARE: Record<BudgetGroup, number> = {
  NEEDS: 0.5,
  WANTS: 0.3,
  SAVINGS: 0.2,
};

export function groupForPlaidCategory(primary: string | null): BudgetGroup | null {
  if (!primary) return null;
  if (NEEDS.has(primary)) return "NEEDS";
  if (WANTS.has(primary)) return "WANTS";
  if (SAVINGS.has(primary)) return "SAVINGS";
  return null; // INCOME, TRANSFER_IN, unknown
}

export type CategoryLimit = {
  plaidPrimary: string;
  group: BudgetGroup;
  monthlyLimit: number;
};

/**
 * Distribute each group's share of income across its categories,
 * proportionally to historical monthly averages (even split when there
 * is no history for the group).
 */
export function buildCategoryLimits(
  monthlyIncome: number,
  averagesByPlaidPrimary: Map<string, number>
): CategoryLimit[] {
  const groups: Record<BudgetGroup, string[]> = {
    NEEDS: [...NEEDS],
    WANTS: [...WANTS],
    SAVINGS: [...SAVINGS],
  };

  const limits: CategoryLimit[] = [];
  for (const [group, categories] of Object.entries(groups) as [BudgetGroup, string[]][]) {
    const allocation = monthlyIncome * GROUP_SHARE[group];
    const avgSum = categories.reduce((s, c) => s + (averagesByPlaidPrimary.get(c) ?? 0), 0);
    for (const plaidPrimary of categories) {
      const share =
        avgSum > 0
          ? (averagesByPlaidPrimary.get(plaidPrimary) ?? 0) / avgSum
          : 1 / categories.length;
      limits.push({
        plaidPrimary,
        group,
        monthlyLimit: Math.round(allocation * share * 100) / 100,
      });
    }
  }
  return limits;
}
