import { Property, InvestmentData, PropertyType } from '@/lib/types';
import type { UserProfile } from '@/hooks/useProfile';
import { calculateFinancials, calculateNotaryFees, calculateAllFiscalModes } from './financials';
import { getZoneFromPostalCode } from '@/lib/geography';

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

    // Bienveo listings are always HLM (logements sociaux) → notary rate 3%
    const propertyType: PropertyType = p.source === 'bienveo' ? 'HLM' : 'OLD';
    const notaryFees = calculateNotaryFees(price, propertyType);
    const totalProject = price + notaryFees;
    const loanAmount = Math.max(0, totalProject - (profile.personalContribution ?? 0));

    // Auto-compute PTZ zone from postal code
    const zone = getZoneFromPostalCode(p.postalCode);

    return {
        price,
        surface,
        furniture: 0,
        works: 0,
        notaryFees,
        propertyType,
        zone,
        postalCode: p.postalCode,
        loanAmount: loanAmount || price,
        personalContribution: profile.personalContribution ?? 0,
        interestRate: profile.defaultInterestRate ?? 3.8,
        loanDuration: profile.defaultLoanDuration ?? 25,
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

export interface BestCaseFinancials {
    yieldBrut: number;
    yieldNet: number;
    /** Standard location cashflow (best tax regime) */
    monthlyCashFlowNetNet: number;
    bestMode: string;
    bestModeLabel: string;
    /** Colocation cashflow (if 2+ bedrooms), best tax regime */
    monthlyCashFlowNetNetColoc: number | null;
    bestModeLabelColoc: string | null;
    /** Best-case = max(location, coloc) with 0 vacancy */
    bestCaseCashflow: number;
    bestCaseLabel: string;
    /** Standard location cashflow with 0 vacancy */
    cfLocation0Vac: number;
    /** Coloc cashflow with 0 vacancy (null if < 2 bedrooms) */
    cfColoc0Vac: number | null;
}

/**
 * Computes financials across all tax regimes and picks the best.
 * Returns standard CF, coloc CF, and best-case (0 vacancy, best of coloc/location).
 */
export function getBestTaxRegimeFinancials(
    p: Property,
    profile: UserProfile
): BestCaseFinancials {
    const data = buildInvestmentDataFromProperty(p, profile);
    const allResults = calculateAllFiscalModes(data);

    // Find best tax regime for standard location
    let bestMode = 'LMNP_MICRO';
    let bestNetNet = allResults[bestMode]!.monthlyCashFlowNetNet;
    for (const [mode, res] of Object.entries(allResults)) {
        if (res.monthlyCashFlowNetNet > bestNetNet) {
            bestNetNet = res.monthlyCashFlowNetNet;
            bestMode = mode;
        }
    }
    const results = allResults[bestMode]!;

    // 0 vacancy location
    const data0Vac = { ...data, vacancyMonth: 0 };
    const res0Vac = calculateFinancials(data0Vac, bestMode);
    const cfLocation0Vac = res0Vac.monthlyCashFlowNetNet;

    // Colocation
    let monthlyCashFlowNetNetColoc: number | null = null;
    let cfColoc0Vac: number | null = null;
    if (canBeColoc(p)) {
        const colocRent = getColocMonthlyRent(data.monthlyRent, p);
        if (colocRent != null) {
            const dataColoc = { ...data, monthlyRent: colocRent };
            const resColoc = calculateFinancials(dataColoc, bestMode);
            monthlyCashFlowNetNetColoc = resColoc.monthlyCashFlowNetNet;
            const dataColoc0Vac = { ...dataColoc, vacancyMonth: 0 };
            const resColoc0Vac = calculateFinancials(dataColoc0Vac, bestMode);
            cfColoc0Vac = resColoc0Vac.monthlyCashFlowNetNet;
        }
    }

    // Best case = max of all 0-vacancy scenarios
    const candidates = [cfLocation0Vac];
    if (cfColoc0Vac != null) candidates.push(cfColoc0Vac);
    const bestCaseCashflow = Math.max(...candidates);
    const bestCaseLabel = cfColoc0Vac != null && cfColoc0Vac >= cfLocation0Vac ? 'Coloc' : 'Location';

    return {
        yieldBrut: results.yieldBrut,
        yieldNet: results.yieldNet,
        monthlyCashFlowNetNet: results.monthlyCashFlowNetNet,
        bestMode,
        bestModeLabel: FISCAL_MODE_LABELS[bestMode] ?? bestMode,
        monthlyCashFlowNetNetColoc,
        bestModeLabelColoc: monthlyCashFlowNetNetColoc != null ? (FISCAL_MODE_LABELS[bestMode] ?? bestMode) : null,
        bestCaseCashflow: Math.round(bestCaseCashflow),
        bestCaseLabel,
        cfLocation0Vac: Math.round(cfLocation0Vac),
        cfColoc0Vac: cfColoc0Vac != null ? Math.round(cfColoc0Vac) : null,
    };
}
