import { InvestmentData, FinancialResults } from '../types';

export const NOTARY_RATE_OLD = 0.08;
export const NOTARY_RATE_NEW = 0.025;
export const NOTARY_RATE_HLM = 0.03; // ~3% for social housing sales
export const AGENCY_FEES_RATE = 0.05;

export function calculateNotaryFees(price: number, type: string): number {
    switch (type) {
        case 'NEW': return price * NOTARY_RATE_NEW;
        case 'HLM': return price * NOTARY_RATE_HLM;
        default: return price * NOTARY_RATE_OLD;
    }
}

export function calculateMonthlyMortgage(amount: number, rate: number, years: number): number {
    if (amount === 0) return 0;
    // Formula: M = P [ i(1 + i)^n ] / [ (1 + i)^n – 1 ]
    const monthlyRate = rate / 100 / 12;
    const numberOfPayments = years * 12;

    if (monthlyRate === 0) return amount / numberOfPayments;

    return (
        (amount * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
        (Math.pow(1 + monthlyRate, numberOfPayments) - 1)
    );
}

// TMI Assumption for simplification: 30% + 17.2% CSG = 47.2% global pressure on rent
const TMI = 0.30;
const CSG = 0.172;

export function calculateFinancials(data: InvestmentData, taxationMode: string): FinancialResults {
    // 1. Costs
    const notaryFees = data.notaryFees > 0
        ? data.notaryFees
        : calculateNotaryFees(data.price, data.propertyType);

    const totalProjectCost = data.price + notaryFees + data.works + data.furniture;

    // 2. Revenues (Annual)
    const vacancyMonths = data.vacancyMonth || 1;
    const annualGrossRent = data.monthlyRent * (12 - vacancyMonths);

    // 3. Charges (Annual)
    const annualCondoFees = data.condoFees * 12;
    const annualManagementFees = (annualGrossRent * data.managementFees) / 100;
    const annualLoanInsurance = data.loanAmount * (data.insuranceRate / 100);
    const annualCharges =
        data.propertyTax +
        annualCondoFees +
        data.pnoInsurance +
        annualManagementFees +
        annualLoanInsurance;

    // 4. Mortgage
    const monthlyMortgage = calculateMonthlyMortgage(data.loanAmount, data.interestRate, data.loanDuration);
    const annualMortgage = monthlyMortgage * 12;

    // 5. Cashflow Types
    const annualCashFlowBrut = annualGrossRent - annualCharges;
    const annualCashFlowNet = annualCashFlowBrut - annualMortgage;

    // 6. Tax Calculation
    let estimateTax = 0;

    // Mortgage interest estimation (First year approx for tax)
    const annualInterest = data.loanAmount * (data.interestRate / 100);

    switch (taxationMode) {
        case 'LMNP_MICRO':
            // Abattement 50%
            estimateTax = (annualGrossRent * 0.5) * (TMI + CSG);
            break;

        case 'LMNP_REEL':
            // Recettes - Charges Deductibles - Amortissement
            // Charges deductibles: Taxe Foncier + Copro + Assurance + Interets + Gestion
            const deductibleCharges = data.propertyTax + annualCondoFees + data.pnoInsurance + annualManagementFees + annualLoanInsurance + annualInterest;

            // Simplified Amortization:
            // Immobilier (90% of price) / 30 years
            // Furniture / 10 years
            // Works / 15 years
            // Notary fees (can be amortized or deducted, let's deduct)
            const amortConstruction = (data.price * 0.9) / 30;
            const amortFurniture = (data.furniture) / 10;
            const amortWorks = (data.works) / 15;
            const totalAmort = amortConstruction + amortFurniture + amortWorks;

            const taxableResult = Math.max(0, annualGrossRent - deductibleCharges - totalAmort - notaryFees);
            estimateTax = taxableResult * (TMI + CSG);
            break;

        case 'FONCIER_MICRO':
            // Nu Propriété: Abattement 30%
            if (annualGrossRent > 15000) {
                // Force Reel if > 15k, but here strict micro logic
                estimateTax = (annualGrossRent * 0.7) * (TMI + CSG);
            } else {
                estimateTax = (annualGrossRent * 0.7) * (TMI + CSG);
            }
            break;

        case 'SCI_IS':
            // 15% up to 38120€, 25% beyond. No CSG.
            // Deduct everything + amort.
            // Amortization (Building only, usually)
            const sciAmort = (data.price * 0.9) / 30; // Simplying
            const sciDeductibles = annualCharges + annualInterest; // + Notary amort?
            const sciResult = Math.max(0, annualGrossRent - sciDeductibles - sciAmort);

            if (sciResult < 38120) {
                estimateTax = sciResult * 0.15;
            } else {
                estimateTax = (38120 * 0.15) + ((sciResult - 38120) * 0.25);
            }
            break;

        default:
            estimateTax = 0;
    }

    const annualCashFlowNetNet = annualCashFlowNet - estimateTax;

    return {
        totalProjectCost,
        monthlyMortgage,
        monthlyCashFlowBrut: annualCashFlowBrut / 12,
        monthlyCashFlowNet: annualCashFlowNet / 12,
        monthlyCashFlowNetNet: annualCashFlowNetNet / 12,
        yieldBrut: (annualGrossRent / totalProjectCost) * 100,
        yieldNet: ((annualGrossRent - annualCharges) / totalProjectCost) * 100,
        taxes: estimateTax
    };
}

export function calculateAllFiscalModes(data: InvestmentData): Record<string, FinancialResults> {
    const modes = ['LMNP_MICRO', 'LMNP_REEL', 'FONCIER_MICRO', 'SCI_IS'];
    const results: Record<string, FinancialResults> = {};

    modes.forEach(mode => {
        results[mode] = calculateFinancials(data, mode);
    });

    return results;
}
