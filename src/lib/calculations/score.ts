import { FinancialResults } from "@/lib/types";

export function calculateInvestmentScore(results: FinancialResults): number {
    let score = 0;

    // 1. Cashflow (Max 50 pts)
    // If positive, great. 
    // +100€ cashflow -> +10 pts? 
    // Let's say target is +200€ for max score?
    if (results.monthlyCashFlowNetNet > 0) {
        score += 30; // Base points for being positive
        score += Math.min(20, results.monthlyCashFlowNetNet / 10); // +1 pt per 10€, max 20
    } else {
        // Penalty for negative
        score -= Math.min(20, Math.abs(results.monthlyCashFlowNetNet) / 10);
    }

    // 2. Yield (Max 50 pts)
    // 5% -> 20pts
    // 8% -> 40pts
    // 10% -> 50pts
    score += Math.min(50, results.yieldNet * 5);

    // Clamp 0-100
    return Math.max(0, Math.min(100, Math.round(score)));
}
