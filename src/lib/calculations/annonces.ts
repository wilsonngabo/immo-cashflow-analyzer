import { Property, InvestmentData } from '@/lib/types';
import type { UserProfile } from '@/hooks/useProfile';
import { calculateFinancials, calculateNotaryFees, calculateAllFiscalModes } from './financials';

/**
 * En colocation, le loyer total est souvent 25 à 35 % plus élevé (loyer par chambre).
 * On utilise un coefficient pour estimer le loyer coloc à partir du loyer "classique".
 */
const COLOC_RENT_FACTOR = 1.28;

/**
 * Indique si le bien peut raisonnablement être considéré comme coloc (2 chambres ou plus).
 */
function canBeColoc(p: Property): boolean {
    if (p.bedrooms != null && p.bedrooms >= 2) return true;
    if (p.rooms != null && p.rooms >= 3) return true; // 3 pièces = au moins 2 chambres en général
    return false;
}

/**
 * Loyer mensuel estimé en colocation (loué par chambre).
 */
export function getColocMonthlyRent(baseMonthlyRent: number, p: Property): number | null {
    if (!canBeColoc(p)) return null;
    return Math.round(baseMonthlyRent * COLOC_RENT_FACTOR);
}

const FISCAL_MODE_LABELS: Record<string, string> = {
    LMNP_MICRO: 'LMNP Micro',
    LMNP_REEL: 'LMNP Réel',
    FONCIER_MICRO: 'Nu Micro',
    FONCIER_REEL: 'Nu Réel',
    SCI_IS: 'SCI IS',
};

/**
 * Estimate gross yield from price/surface (same rule as API for consistency).
 */
function estimateBrutYield(price: number, pricePerSqm?: number): number {
    if (!price || !pricePerSqm || pricePerSqm <= 0) return 6;
    let y = 10.5 - pricePerSqm / 1000;
    y = Math.max(3.0, Math.min(10.0, y));
    return Math.round(y * 10) / 10;
}

/**
 * Build investment data for a listing using profile (salary, loan params, etc.)
 * and estimated rent from the property.
 */
export function buildInvestmentDataFromProperty(
    p: Property,
    profile: UserProfile
): InvestmentData {
    const price = p.price ?? 0;
    const surface = p.surface ?? 0;
    const pricePerSqm = p.pricePerSqm ?? (surface > 0 ? price / surface : undefined);
    const yieldBrutPct = estimateBrutYield(price, pricePerSqm);
    const estimatedAnnualRent = (price * yieldBrutPct) / 100;
    const monthlyRent = estimatedAnnualRent / 12;

    const notaryFees = calculateNotaryFees(price, 'OLD');
    const totalProject = price + notaryFees;
    const loanAmount = Math.max(0, totalProject - (profile.personalContribution ?? 0));

    return {
        price,
        surface,
        furniture: 0,
        works: 0,
        notaryFees,
        propertyType: 'OLD',
        loanAmount: loanAmount || price,
        personalContribution: profile.personalContribution ?? 0,
        interestRate: profile.defaultInterestRate ?? 3.8,
        loanDuration: profile.defaultLoanDuration ?? 20,
        insuranceRate: 0.34,
        monthlyRent: Math.round(monthlyRent),
        propertyTax: p.propertyTax ?? Math.round(price * 0.008),
        condoFees: p.charges ?? 100,
        pnoInsurance: 150,
        managementFees: 0,
        vacancyMonth: 1,
        gliRate: 0,
        annualSalary: profile.annualSalary ?? 0,
        includePTZ: false,
        includeActionLogement: false,
        revenueN2: profile.revenueN2,
        householdSize: profile.householdSize ?? 1,
    };
}

/**
 * Compute yield and cashflow for a property using the user's profile.
 * Uses the tax regime that gives the highest net cashflow (meilleur régime pour le CF net).
 */
export function getProfileBasedFinancials(
    p: Property,
    profile: UserProfile
): { yieldBrut: number; yieldNet: number; monthlyCashFlowNetNet: number } {
    const data = buildInvestmentDataFromProperty(p, profile);
    const results = calculateFinancials(data, 'LMNP_MICRO');
    return {
        yieldBrut: results.yieldBrut,
        yieldNet: results.yieldNet,
        monthlyCashFlowNetNet: results.monthlyCashFlowNetNet,
    };
}

/**
 * Same as getProfileBasedFinancials but chooses the tax regime that maximizes net cashflow.
 * Returns the best regime key and its label for display.
 * Optionally returns coloc cashflow when the property has 2+ chambres.
 */
export function getBestTaxRegimeFinancials(
    p: Property,
    profile: UserProfile
): {
    yieldBrut: number;
    yieldNet: number;
    monthlyCashFlowNetNet: number;
    bestMode: string;
    bestModeLabel: string;
    /** Cashflow net en colocation (si 2+ chambres), avec le même meilleur régime */
    monthlyCashFlowNetNetColoc: number | null;
    bestModeLabelColoc: string | null;
} {
    const data = buildInvestmentDataFromProperty(p, profile);
    const allResults = calculateAllFiscalModes(data);
    let bestMode = 'LMNP_MICRO';
    let bestNetNet = allResults[bestMode]!.monthlyCashFlowNetNet;
    for (const [mode, res] of Object.entries(allResults)) {
        if (res.monthlyCashFlowNetNet > bestNetNet) {
            bestNetNet = res.monthlyCashFlowNetNet;
            bestMode = mode;
        }
    }
    const results = allResults[bestMode]!;

    let monthlyCashFlowNetNetColoc: number | null = null;
    if (canBeColoc(p)) {
        const colocRent = getColocMonthlyRent(data.monthlyRent, p);
        if (colocRent != null) {
            const dataColoc = { ...data, monthlyRent: colocRent };
            const resColoc = calculateFinancials(dataColoc, bestMode);
            monthlyCashFlowNetNetColoc = resColoc.monthlyCashFlowNetNet;
        }
    }

    return {
        yieldBrut: results.yieldBrut,
        yieldNet: results.yieldNet,
        monthlyCashFlowNetNet: results.monthlyCashFlowNetNet,
        bestMode,
        bestModeLabel: FISCAL_MODE_LABELS[bestMode] ?? bestMode,
        monthlyCashFlowNetNetColoc,
        bestModeLabelColoc: monthlyCashFlowNetNetColoc != null ? (FISCAL_MODE_LABELS[bestMode] ?? bestMode) : null,
    };
}
