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
    gliRate: number; // % of rent for GLI insurance (default 0)

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
    /** Si true, la simulation utilise un loyer colocation (loyer × 1,28) pour les revenus */
    simulationColoc?: boolean;
    /** Nombre de pièces de l'annonce (pour calcul loyer/chambre en coloc) */
    rooms?: number;
    /** Nombre de chambres de l'annonce (pour calcul loyer/chambre en coloc) */
    bedrooms?: number;
    /** URL de l'image principale de l'annonce */
    imageUrl?: string;
    /** URL de l'annonce source */
    listingUrl?: string;
    /** Code postal (pour estimation loyer marché depuis annonces LBC location) */
    postalCode?: string;
}

export interface SavedSimulation {
    id: string;
    date: string;
    name: string;
    data: InvestmentData;
    results: FinancialResults;
    score: number;
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
    debtRatio: number; // Taux d'endettement en %
}

// ─── Property Database ────────────────────────────────────────────────────────

export type PropertyListingType = 'buy' | 'rent';
export type PropertySource = 'leboncoin' | 'seloger';
export type PropertyKind = 'apartment' | 'house' | 'other';

export interface Property {
    id: string;                    // e.g. 'lbc_123456' or 'sl_789012'
    source: PropertySource;
    title: string;
    price: number;
    surface?: number;              // m²
    rooms?: number;
    city?: string;
    postalCode?: string;
    propertyKind?: PropertyKind;
    listingType: PropertyListingType;
    url: string;
    imageUrl?: string;
    description?: string;
    scrapedAt: string;             // ISO timestamp
    pricePerSqm?: number;         // computed: price / surface

    // Extended fields (Rich data)
    dpe?: string;                  // e.g. 'A', 'B', 'C'
    ges?: string;                  // e.g. 'A', 'B', 'C'
    charges?: number;              // Monthly HOA charges
    propertyTax?: number;          // Taxe foncière (if available)
    floor?: number;                // Etage
    hasElevator?: boolean;         // Ascenseur
    hasBalcony?: boolean;          // Balcon / Terrasse
    hasParking?: boolean;          // Parking / Garage
    builtYear?: number;            // Année de construction
    isNew?: boolean;               // Neuf ou Ancien
    energyHeating?: string;        // ex: 'Électrique', 'Gaz'
    heatingType?: string;          // ex: 'Individuel', 'Collectif'
    bedrooms?: number;             // Nombre de chambres
    isFurnished?: boolean;         // Meublé
    hasCellar?: boolean;           // Cave
    hasGarage?: boolean;           // Garage
    terrain?: number;              // Surface terrain m² (maisons)
    nbPhotos?: number;             // Nb de photos dans l'annonce
    ownerType?: 'private' | 'professional';  // Pro ou particulier (LBC)

    // Computed fields (for filtering)
    department?: string;           // e.g. '75'
    region?: string;               // e.g. 'Île-de-France'
    estimatedYield?: number;       // Rentabilité brute estimée (%)
    estimatedCashflow?: number;    // Cashflow net estimé (€/mois)
}
