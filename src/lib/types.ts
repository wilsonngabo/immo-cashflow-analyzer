export type TaxationMode = 'LMNP_REEL' | 'LMNP_MICRO' | 'FONCIER_REEL' | 'FONCIER_MICRO' | 'SCI_IS';

export type PropertyType = 'OLD' | 'NEW' | 'HLM';

export interface InvestmentData {
    // Acquisition
    price: number;
    surface: number;
    furniture: number; // Meubles
    works: number; // Travaux

    // Frais
    notaryFees: number; // Auto-calculated or manual override
    propertyType: PropertyType; // Determines notary rate

    // Financing
    loanAmount: number;
    personalContribution: number; // Apport
    interestRate: number; // %
    loanDuration: number; // Years
    insuranceRate: number; // %

    // Exploitation (Monthly)
    monthlyRent: number;
    propertyTax: number; // Taxe foncière (Annual)
    condoFees: number; // Charges copro (Monthly)
    pnoInsurance: number; // Assurance PNO (Annual)
    managementFees: number; // % of rent
    vacancyMonth: number; // Number of months vacancy/year (default 1)

    // New Fields
    annualSalary: number;
    includePTZ: boolean;
    includeActionLogement: boolean;
    revenueN2?: number; // Revenu Fiscal N-2
    householdSize?: number; // Nombre de parts / personnes
    manualNotaryFees?: boolean; // If true, do not auto-calc notary fees
    reducedNotaryFees?: boolean; // If true (for HLM), use 3% instead of 8%
    zone?: 'A' | 'B1' | 'B2' | 'C'; // Geographic zone for PTZ
    heatingType?: 'INDIVIDUAL' | 'COLLECTIVE'; // Chauffage individuel vs collectif
}

export interface FinancialResults {
    totalProjectCost: number;
    monthlyMortgage: number;
    monthlyCashFlowBrut: number;
    monthlyCashFlowNet: number; // Net de charges
    monthlyCashFlowNetNet: number; // Net d'impots
    yieldBrut: number;
    yieldNet: number; // Net de charges
    taxes: number; // Annual estimated tax
    debtRatio?: number; // Taux d'endettement
}
