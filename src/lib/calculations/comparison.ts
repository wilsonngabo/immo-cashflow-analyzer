import { SavedSimulation } from "@/lib/types";

export interface SimulationVerdict {
    badge: string;
    badgeColor: string;
    description: string;
}

export function getSimulationVerdict(sim: SavedSimulation, allSims: SavedSimulation[]): SimulationVerdict | null {
    if (allSims.length < 2) return null;

    // 1. Find Best Cashflow
    const sortedByCashflow = [...allSims].sort((a, b) => b.results.monthlyCashFlowNetNet - a.results.monthlyCashFlowNetNet);
    const bestCashflow = sortedByCashflow[0];

    // 2. Find Best Yield
    const sortedByYield = [...allSims].sort((a, b) => b.results.yieldBrut - a.results.yieldBrut);
    const bestYield = sortedByYield[0];

    // 3. Find Lowest Price (Entry Ticket)
    const sortedByPrice = [...allSims].sort((a, b) => a.data.price - b.data.price);
    const lowestPrice = sortedByPrice[0];

    // Verdict Logic
    if (sim.id === bestCashflow.id) {
        return {
            badge: "🏆 Cashflow King",
            badgeColor: "bg-green-100 text-green-700 border-green-200",
            description: `Meilleur cash-flow du comparatif (+${Math.round(sim.results.monthlyCashFlowNetNet)}€).`
        };
    }

    if (sim.id === bestYield.id) {
        return {
            badge: "🚀 Top Rentabilité",
            badgeColor: "bg-purple-100 text-purple-700 border-purple-200",
            description: `La plus forte rentabilité brute (${sim.results.yieldBrut.toFixed(1)}%).`
        };
    }

    if (sim.id === lowestPrice.id) {
        return {
            badge: "💰 Ticket d'Entrée",
            badgeColor: "bg-blue-100 text-blue-700 border-blue-200",
            description: `Le projet le plus accessible financièrement.`
        };
    }

    // Secondary Logic (if not #1)
    if (sim.results.monthlyCashFlowNetNet > 0) {
        return {
            badge: "✅ Autofinancé",
            badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
            description: "Génère du cash-flow positif."
        };
    }

    return {
        badge: "⚠️ Effort d'Épargne",
        badgeColor: "bg-orange-100 text-orange-700 border-orange-200",
        description: `Nécessite ${Math.abs(Math.round(sim.results.monthlyCashFlowNetNet))}€ d'effort mensuel.`
    };
}
