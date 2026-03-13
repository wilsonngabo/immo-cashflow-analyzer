'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { InvestmentData, FinancialResults } from '@/lib/types';
import { calculateFinancials, calculateNotaryFees, getMarketRate, checkEligibility, getPTZDetails, getActionLogementDetails } from '@/lib/calculations/financials';
import { getDepartmentCode, getRegionForDepartment } from '@/lib/geography';
import { useRates, getLiveRate } from '@/hooks/useRates';

export interface RentMarketData {
    median: number;
    count: number;
    colocPerRoom?: number | null;
    colocCount?: number;
    colocSource?: string | null;
    furnished?: { count: number; median: number } | null;
    unfurnished?: { count: number; median: number } | null;
}

interface CalculatorFormProps {
    data: InvestmentData;
    mode: string;
    onDataChange: (newData: InvestmentData) => void;
    onModeChange: (newMode: string) => void;
    /** Estimation de loyer marché depuis les annonces LBC location en base */
    rentMarket?: RentMarketData | null;
    /** Navigate to Annonces with rent filters to show the comparable listings */
    onShowRentListings?: (postalCode: string, surface?: number) => void;
}

export function CalculatorForm({ data, mode, onDataChange, onModeChange, rentMarket, onShowRentListings }: CalculatorFormProps) {
    const [isOpenAcq, setIsOpenAcq] = useState(true);
    const [isOpenFin, setIsOpenFin] = useState(true);
    const [isOpenExp, setIsOpenExp] = useState(true);
    const { rates: liveRates } = useRates();
    const [colocMarket, setColocMarket] = useState<{ perRoom: number; count: number; source: string } | null>(null);
    const [localRentMarket, setLocalRentMarket] = useState<RentMarketData | null>(null);

    const handleChange = useCallback((field: keyof InvestmentData, val: string | number | boolean) => {
        onDataChange({ ...data, [field]: val });
    }, [data, onDataChange]);

    // Auto-calculate Notary Fees & Loan Amount
    useEffect(() => {
        // Notary Logic
        let notary = data.notaryFees;
        if (!data.manualNotaryFees) {
            notary = calculateNotaryFees(data.price, data.propertyType, data.reducedNotaryFees);
            if (notary !== data.notaryFees) {
                // Defer update
            }
        }

        // We combine the logic: 
        // 1. Determine correct Notary Fees (Auto or Manual)
        const currentNotary = data.manualNotaryFees ? data.notaryFees : calculateNotaryFees(data.price, data.propertyType, data.reducedNotaryFees);

        // 2. Determine Loan
        const totalProject = data.price + data.works + data.furniture + currentNotary;
        const calculatedLoan = Math.max(0, totalProject - (data.personalContribution || 0));

        // 3. Apply changes if different
        const updates: Partial<InvestmentData> = {};
        if (currentNotary !== data.notaryFees) updates.notaryFees = currentNotary;
        if (Math.abs((data.loanAmount || 0) - calculatedLoan) > 1) updates.loanAmount = calculatedLoan;

        if (Object.keys(updates).length > 0) {
            onDataChange({ ...data, ...updates });
        }
    }, [data.price, data.works, data.furniture, data.personalContribution, data.propertyType, data.reducedNotaryFees, data.manualNotaryFees, data.notaryFees, data.loanAmount]);

    // Auto-calculate Interest Rate based on Duration + Region (live API or fallback)
    useEffect(() => {
        const dept = data.postalCode ? getDepartmentCode(data.postalCode) : undefined;
        const region = dept ? getRegionForDepartment(dept) : undefined;
        const marketRate = liveRates
            ? getLiveRate(liveRates, data.loanDuration, region ?? undefined)
            : getMarketRate(data.loanDuration, region ?? undefined);
        onDataChange({ ...data, interestRate: marketRate });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.loanDuration, data.postalCode, liveRates]);

    // Fetch rent market (and coloc) when postalCode/surface/rooms change
    useEffect(() => {
        if (!data.postalCode || data.postalCode.length < 2) {
            setLocalRentMarket(null);
            setColocMarket(null);
            return;
        }
        const params = new URLSearchParams({ postalCode: data.postalCode });
        if (data.surface && data.surface > 0) params.set('surface', String(data.surface));
        if (data.rooms && data.rooms > 0) params.set('rooms', String(data.rooms));
        if (data.bedrooms && data.bedrooms > 0) params.set('bedrooms', String(data.bedrooms));
        let cancelled = false;
        fetch(`/api/rent-estimate?${params}`)
            .then(r => r.json())
            .then(json => {
                if (cancelled) return;
                if (json.count >= 3 && json.medianRent) {
                    setLocalRentMarket({
                        median: json.medianRent,
                        count: json.count,
                        furnished: json.furnished ?? null,
                        unfurnished: json.unfurnished ?? null,
                        colocPerRoom: json.colocPerRoom ?? null,
                        colocCount: json.colocCount ?? 0,
                        colocSource: json.colocSource ?? null,
                    });
                } else {
                    setLocalRentMarket(null);
                }
                if (json.colocPerRoom) {
                    setColocMarket({
                        perRoom: json.colocPerRoom,
                        count: json.colocCount ?? 0,
                        source: json.colocSource ?? 'rent_estimate',
                    });
                } else {
                    setColocMarket(null);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setLocalRentMarket(null);
                    setColocMarket(null);
                }
            });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.postalCode, data.surface, data.rooms, data.bedrooms]);


    const effectiveRentMarket = localRentMarket ?? rentMarket;

    // Apply default market rent (meublé/nu) — always use the median from market
    useEffect(() => {
        if (!effectiveRentMarket || effectiveRentMarket.count < 3) return;
        const isMeuble = mode.startsWith('LMNP') || mode === 'SCI_IS';
        const isNu = mode.startsWith('FONCIER');
        const median = isMeuble
            ? effectiveRentMarket.furnished?.median
            : isNu
                ? effectiveRentMarket.unfurnished?.median
                : effectiveRentMarket.median;
        if (median != null) {
            onDataChange({ ...data, monthlyRent: median });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveRentMarket, mode]);

    // Check Eligibility automatically if HLM params change
    useEffect(() => {
        if (data.propertyType === 'HLM' && data.revenueN2 && data.householdSize) {
            const isEligible = checkEligibility(data.revenueN2, data.householdSize);
            if (isEligible && !data.includePTZ) {
                // Optional auto-check
            }
        }
    }, [data.revenueN2, data.householdSize, data.propertyType, data.includePTZ]);

    // Dynamic calculation for UI display
    const aidDetails = (() => {
        if (data.propertyType !== 'HLM' || data.revenueN2 === undefined || !data.householdSize) return { ptz: null, action: null };

        const notary = data.manualNotaryFees ? data.notaryFees : calculateNotaryFees(data.price, data.propertyType, data.reducedNotaryFees);
        const totalProject = data.price + data.works + data.furniture + notary;
        const zone = data.zone || 'B1';

        return {
            ptz: getPTZDetails(totalProject, data.revenueN2, data.householdSize, zone),
            action: getActionLogementDetails(totalProject, data.revenueN2, data.householdSize)
        };
    })();

    const ptzAmount = aidDetails.ptz?.eligible ? aidDetails.ptz.amount : 0;
    const actionAmount = aidDetails.action?.eligible ? aidDetails.action.amount : 0;
    const mainLoan = Math.max(0, data.loanAmount - (data.includePTZ ? ptzAmount : 0) - (data.includeActionLogement ? actionAmount : 0));


    // Handler for manual eligibility check
    const handleCheckEligibility = () => {
        if (data.revenueN2 === undefined || data.revenueN2 === null || !data.householdSize) {
            alert("Veuillez renseigner le Revenu Fiscal N-2 et le nombre de Personnes Fiscales.");
            return;
        }

        const zone = data.zone || 'B1';

        // Use the memoized/dynamic values which are fresh
        // Rethink: aidDetails is fresh render-time. 
        // We can just rely on it or re-call to be explicit? 
        // Let's reuse logic for updates.

        // Re-calc to be sure inside handler
        const notary = data.manualNotaryFees ? data.notaryFees : calculateNotaryFees(data.price, data.propertyType, data.reducedNotaryFees);
        const totalProject = data.price + data.works + data.furniture + notary;
        const ptz = getPTZDetails(totalProject, data.revenueN2, data.householdSize, zone);
        const action = getActionLogementDetails(totalProject, data.revenueN2, data.householdSize);

        if (ptz.eligible || action.eligible) {
            const updates: Partial<InvestmentData> = {};
            if (ptz.eligible) updates.includePTZ = true;
            if (action.eligible) updates.includeActionLogement = true;
            onDataChange({ ...data, ...updates });

            let msg = `Résultats (Zone ${zone}) :\n`;
            if (ptz.eligible) msg += `✅ Éligible PTZ: ${ptz.amount.toLocaleString()} € (Cap Opération: ${ptz.cap.toLocaleString()} €)\n`;
            else msg += "❌ Non éligible PTZ (Revenus trop élevés)\n";

            if (action.eligible) msg += `✅ Éligible Action Logement: ${action.amount.toLocaleString()} €`;
            else msg += "❌ Non éligible Action Logement";

            alert(msg);
        } else {
            onDataChange({ ...data, includePTZ: false, includeActionLogement: false });
            alert(`Basé sur les revenus déclarés en Zone ${zone}, vous ne semblez pas éligible.`);
        }
    };


    return (
        <div className="space-y-6">

            {/* Acquisition */}
            <div
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => setIsOpenAcq(!isOpenAcq)}
            >
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider group-hover:text-slate-800 transition-colors">Acquisition</h3>
                {isOpenAcq ? <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600" /> : <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />}
            </div>
            {isOpenAcq && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Prix d'achat (€)</Label>
                            <Input
                                type="number"
                                value={data.price ?? ''}
                                onChange={(e) => handleChange('price', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Surface (m²)</Label>
                            <Input
                                type="number"
                                value={data.surface ?? ''}
                                onChange={(e) => handleChange('surface', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Travaux (€)</Label>
                            <Input
                                type="number"
                                value={data.works ?? ''}
                                onChange={(e) => handleChange('works', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Meubles (€)</Label>
                            <Input
                                type="number"
                                value={data.furniture ?? ''}
                                onChange={(e) => handleChange('furniture', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notary">Frais de Notaire (€)</Label>
                        <div className="relative">
                            <Input
                                id="notary"
                                type="number"
                                value={data.notaryFees || 0} // Allow 0
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    onDataChange({
                                        ...data,
                                        notaryFees: isNaN(val) ? 0 : val,
                                        manualNotaryFees: true
                                    });
                                }}
                                className={data.manualNotaryFees ? "border-yellow-400 bg-yellow-50" : ""}
                            />
                        </div>
                        {data.manualNotaryFees && (
                            <p className="text-[10px] text-yellow-600 mt-1 cursor-pointer hover:underline" onClick={() => onDataChange({ ...data, manualNotaryFees: false })}>
                                Rétablir calcul auto
                            </p>
                        )}
                    </div>

                    {data.propertyType === 'HLM' && (
                        <div className="col-span-2 p-3 bg-blue-50/50 rounded-lg border border-blue-100 space-y-3">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Switch
                                        id="reduced-fees"
                                        checked={data.reducedNotaryFees}
                                        onCheckedChange={(checked) => onDataChange({ ...data, reducedNotaryFees: checked, manualNotaryFees: false })}
                                    />
                                    <Label htmlFor="reduced-fees" className="text-xs">Frais de notaire réduits (3%)</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label className="text-xs font-semibold">Zone :</Label>
                                    <Select
                                        value={data.zone || 'B1'}
                                        onValueChange={(val: any) => onDataChange({ ...data, zone: val })}
                                    >
                                        <SelectTrigger className="h-7 text-xs w-[70px]">
                                            <SelectValue placeholder="Zone" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="A">A</SelectItem>
                                            <SelectItem value="B1">B1</SelectItem>
                                            <SelectItem value="B2">B2</SelectItem>
                                            <SelectItem value="C">C</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2 pt-2">
                        <Label>Type de Bien (Notaire)</Label>
                        <Select
                            value={data.propertyType}
                            onValueChange={(val: any) => handleChange('propertyType', val)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Sélectionner le type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="OLD">Ancien (8%)</SelectItem>
                                <SelectItem value="NEW">Neuf (2.5%)</SelectItem>
                                <SelectItem value="HLM">Vente HLM (3%)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>)}

            <Separator />

            {/* Financement */}
            <div
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => setIsOpenFin(!isOpenFin)}
            >
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider group-hover:text-slate-800 transition-colors">Financement</h3>
                {isOpenFin ? <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600" /> : <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />}
            </div>
            {isOpenFin && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="salary">Salaire Brut Annuel</Label>
                            <div className="relative">
                                <Input
                                    id="salary"
                                    type="number"
                                    value={data.annualSalary ?? ''}
                                    onChange={(e) => handleChange('annualSalary', parseFloat(e.target.value) || 0)}
                                    className="pl-8"
                                    placeholder="ex: 40000"
                                />
                                <span className="absolute left-3 top-2.5 text-slate-500">€</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="apport">Apport Personnel</Label>
                            <div className="relative">
                                <Input
                                    id="apport"
                                    type="number"
                                    value={data.personalContribution ?? ''}
                                    onChange={(e) => handleChange('personalContribution', parseFloat(e.target.value) || 0)}
                                    className="pl-8"
                                    placeholder="ex: 15000"
                                />
                                <span className="absolute left-3 top-2.5 text-slate-500">€</span>
                            </div>
                        </div>
                    </div>

                    {data.propertyType === 'HLM' && (
                        <div className="col-span-2 p-3 bg-blue-50/50 rounded-lg border border-blue-100 space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <Label className="text-xs">Revenu Fiscal N-2</Label>
                                    <Input
                                        type="number"
                                        className="h-8 text-xs bg-white"
                                        placeholder="ex: 28000"
                                        value={data.revenueN2 ?? ''}
                                        onChange={(e) => handleChange('revenueN2', parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Personnes Fiscales</Label>
                                    <Input
                                        type="number"
                                        className="h-8 text-xs bg-white"
                                        placeholder="ex: 1"
                                        value={data.householdSize ?? ''}
                                        onChange={(e) => handleChange('householdSize', parseFloat(e.target.value) || 1)}
                                    />
                                </div>
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCheckEligibility}
                                className="w-full text-blue-700 border-blue-200 hover:bg-blue-100 h-8 text-xs"
                            >
                                Vérifier Éligibilité Aides & Remplir
                            </Button>

                            <div className="flex gap-4 pt-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="ptz"
                                        checked={data.includePTZ}
                                        onChange={(e) => handleChange('includePTZ', e.target.checked)}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <Label htmlFor="ptz" className="text-xs cursor-pointer">
                                        PTZ {aidDetails.ptz?.eligible ? `(${ptzAmount.toLocaleString()} €)` : ''}
                                    </Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="action"
                                        checked={data.includeActionLogement}
                                        onChange={(e) => handleChange('includeActionLogement', e.target.checked)}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <Label htmlFor="action" className="text-xs cursor-pointer">
                                        Action Logement {aidDetails.action?.eligible ? `(${actionAmount.toLocaleString()} €)` : ''}
                                    </Label>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="flex justify-between">
                                <span>Montant Crédit Total (€)</span>
                                <span className="text-[10px] bg-slate-100 px-1 rounded text-slate-500 font-normal">Calculé</span>
                            </Label>
                            <Input
                                type="number"
                                value={Math.round(data.loanAmount)}
                                readOnly
                                className="bg-slate-50 text-slate-500 font-semibold"
                            />
                            {(data.includePTZ || data.includeActionLogement) && (
                                <div className="text-[10px] text-slate-500 space-y-0.5">
                                    <div className="flex justify-between">
                                        <span>Prêt Bancaire:</span>
                                        <span>{Math.round(mainLoan).toLocaleString()} €</span>
                                    </div>
                                    {data.includePTZ && (
                                        <div className="flex justify-between text-blue-600">
                                            <span>Dont PTZ:</span>
                                            <span>{ptzAmount.toLocaleString()} €</span>
                                        </div>
                                    )}
                                    {data.includeActionLogement && (
                                        <div className="flex justify-between text-blue-600">
                                            <span>Dont Action Log.:</span>
                                            <span>{actionAmount.toLocaleString()} €</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Durée (Années)</Label>
                            <Select
                                value={String(data.loanDuration)}
                                onValueChange={(val) => handleChange('loanDuration', parseInt(val))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Durée" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px]">
                                    {[5, 7, 10, 12, 15, 17, 20, 25].map((year) => {
                                        const dept = data.postalCode ? getDepartmentCode(data.postalCode) : undefined;
                                        const region = dept ? getRegionForDepartment(dept) : undefined;
                                        const rateForYear = liveRates
                                            ? getLiveRate(liveRates, year, region ?? undefined)
                                            : getMarketRate(year, region ?? undefined);
                                        return (
                                            <SelectItem key={year} value={String(year)}>
                                                {year} ans — {rateForYear}%
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="flex justify-between">
                                <span>Taux Emprunt (%)</span>
                                {liveRates ? (
                                    <a
                                        href={liveRates.sourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] bg-blue-50 text-blue-600 px-1 rounded font-normal hover:bg-blue-100 transition-colors"
                                    >
                                        {liveRates.source} {liveRates.date}
                                    </a>
                                ) : (
                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1 rounded font-normal">CAFPI (fallback)</span>
                                )}
                            </Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={data.interestRate}
                                onChange={(e) => handleChange('interestRate', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="flex justify-between">
                                <span>Taux Assurance (%)</span>
                                <span className="text-[10px] bg-slate-100 px-1 rounded text-slate-500 font-normal">Annuel/Capital</span>
                            </Label>
                            <Input
                                type="number"
                                step="0.01"
                                value={data.insuranceRate}
                                onChange={(e) => handleChange('insuranceRate', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>
                </div>
            )}

            <Separator />

            {/* Charges & Loyer */}
            <div
                className="flex items-center justify-between cursor-pointer group"
                onClick={() => setIsOpenExp(!isOpenExp)}
            >
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider group-hover:text-slate-800 transition-colors">Exploitation</h3>
                {isOpenExp ? <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600" /> : <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />}
            </div>
            {isOpenExp && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Loyer Mensuel CC (€)</Label>
                            <Input
                                type="number"
                                value={data.monthlyRent ?? ''}
                                onChange={(e) => handleChange('monthlyRent', parseFloat(e.target.value) || 0)}
                            />
                            {effectiveRentMarket && effectiveRentMarket.count >= 3 && (() => {
                                const isMeuble = mode.startsWith('LMNP') || mode === 'SCI_IS';
                                const isNu = mode.startsWith('FONCIER');
                                const hasSplit = effectiveRentMarket.furnished || effectiveRentMarket.unfurnished;
                                const relevantData = isMeuble ? effectiveRentMarket.furnished : isNu ? effectiveRentMarket.unfurnished : null;
                                const relevantLabel = isMeuble ? 'Meublé' : isNu ? 'Nu' : 'Tous';
                                const relevantMedian = relevantData?.median ?? effectiveRentMarket.median;
                                const relevantCount = relevantData?.count ?? effectiveRentMarket.count;

                                return (
                                    <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5 mt-1 space-y-1">
                                        <div className="flex items-center gap-1 flex-wrap">
                                            <span>📊</span>
                                            <span>Marché locatif LBC — <strong>{relevantLabel}</strong> (</span>
                                            {onShowRentListings && data.postalCode ? (
                                                <button
                                                    type="button"
                                                    className="underline font-semibold text-emerald-700 hover:text-emerald-900"
                                                    onClick={() => onShowRentListings(data.postalCode!, data.surface)}
                                                >
                                                    {relevantCount} annonces
                                                </button>
                                            ) : (
                                                <span>{relevantCount} annonces</span>
                                            )}
                                            <span>) : <strong>{relevantMedian} €/mois</strong></span>
                                            {data.monthlyRent !== relevantMedian && (
                                                <button type="button" className="ml-1 text-[10px] underline text-emerald-600 hover:text-emerald-800 whitespace-nowrap"
                                                    onClick={() => onDataChange({ ...data, monthlyRent: relevantMedian })}>
                                                    Appliquer
                                                </button>
                                            )}
                                        </div>
                                        {hasSplit && (
                                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 pl-5 text-[10px] text-emerald-600">
                                                {effectiveRentMarket.unfurnished && (
                                                    <span className={isNu ? 'font-bold text-emerald-800' : ''}>
                                                        Nu : {effectiveRentMarket.unfurnished.median} € ({effectiveRentMarket.unfurnished.count})
                                                    </span>
                                                )}
                                                {effectiveRentMarket.furnished && (
                                                    <span className={isMeuble ? 'font-bold text-emerald-800' : ''}>
                                                        Meublé : {effectiveRentMarket.furnished.median} € ({effectiveRentMarket.furnished.count})
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                        <div className="space-y-2">
                            <Label>Taxe Foncière /an (€)</Label>
                            <Input
                                type="number"
                                value={data.propertyTax ?? ''}
                                onChange={(e) => handleChange('propertyTax', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Charges Copro /mois (€)</Label>
                            <Input
                                type="number"
                                value={data.condoFees ?? ''}
                                onChange={(e) => handleChange('condoFees', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Mode de Chauffage</Label>
                            <Select
                                value={data.heatingType || 'INDIVIDUAL'}
                                onValueChange={(val: any) => handleChange('heatingType', val)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="INDIVIDUAL">Individuel (Elec/Gaz)</SelectItem>
                                    <SelectItem value="COLLECTIVE">Collectif (Inclus Charges)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {(() => {
                        const nbChambres = data.bedrooms && data.bedrooms > 0 ? data.bedrooms : (data.rooms && data.rooms > 1 ? data.rooms - 1 : 0);
                        return (
                            <>
                                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
                                    <div>
                                        <Label className="text-sm font-medium">Mode Colocation (tout inclus)</Label>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {data.simulationColoc
                                                ? 'Loyer par chambre — énergie & internet à votre charge'
                                                : 'Location classique (charges locataires non incluses)'}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={!!data.simulationColoc}
                                        onCheckedChange={(checked) => handleChange('simulationColoc', checked)}
                                    />
                                </div>
                                {data.simulationColoc && nbChambres > 0 && (
                                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 px-4 py-3 space-y-2">
                                        <Label className="text-xs font-medium text-emerald-700">
                                            Loyer par chambre — {nbChambres} chambre{nbChambres > 1 ? 's' : ''}
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                type="number"
                                                className="w-28 h-8 text-sm"
                                                value={Math.round(data.monthlyRent / nbChambres)}
                                                onChange={(e) => {
                                                    const perRoom = parseFloat(e.target.value) || 0;
                                                    onDataChange({ ...data, monthlyRent: perRoom * nbChambres });
                                                }}
                                            />
                                            <span className="text-xs text-slate-500">
                                                €/ch × {nbChambres} = <span className="font-semibold text-emerald-700">{data.monthlyRent} €/mois</span>
                                            </span>
                                        </div>
                                        {colocMarket && (
                                            <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1 mt-1 flex items-center gap-1 flex-wrap">
                                                <span>📊</span>
                                                <span>Marché coloc LBC : <strong>{colocMarket.perRoom} €/chambre</strong> médiane ({colocMarket.count} annonces{colocMarket.source === 'rent_estimate' ? ', estimé' : ''})</span>
                                                {Math.round(data.monthlyRent / nbChambres) !== colocMarket.perRoom && (
                                                    <button
                                                        type="button"
                                                        className="ml-auto text-[10px] underline text-emerald-600 hover:text-emerald-800 whitespace-nowrap"
                                                        onClick={() => onDataChange({ ...data, monthlyRent: colocMarket.perRoom * nbChambres })}
                                                    >
                                                        Appliquer
                                                    </button>
                                                )}
                                            </p>
                                        )}
                                        <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                            Charges incluses dans le calcul : énergie (~{Math.round(
                                                (data.surface ?? 50) * (data.heatingType === 'COLLECTIVE' ? 1.0 : 2.5)
                                            )} €) + internet (~30 €)
                                        </div>
                                    </div>
                                )}
                                {data.simulationColoc && nbChambres === 0 && (
                                    <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                        Renseignez le nombre de pièces ou chambres pour activer le calcul par chambre
                                    </div>
                                )}
                            </>
                        );
                    })()}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Assurance PNO /an (€)</Label>
                            <Input
                                type="number"
                                value={data.pnoInsurance ?? ''}
                                onChange={(e) => handleChange('pnoInsurance', parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Vacance Locative (mois/an)</Label>
                            <Select
                                value={String(data.vacancyMonth ?? 1)}
                                onValueChange={(val) => handleChange('vacancyMonth', parseInt(val))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[0, 1, 2, 3].map(m => (
                                        <SelectItem key={m} value={String(m)}>{m} mois</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Frais de Gestion (% loyer)</Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    step="0.5"
                                    value={data.managementFees ?? ''}
                                    onChange={(e) => handleChange('managementFees', parseFloat(e.target.value) || 0)}
                                    className="pr-6"
                                    placeholder="ex: 8"
                                />
                                <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="flex gap-1 items-center">GLI (% loyer)
                                <span className="text-[9px] text-slate-400 font-normal">(Garantie Loyers Impayés)</span>
                            </Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    step="0.5"
                                    value={data.gliRate ?? ''}
                                    onChange={(e) => handleChange('gliRate', parseFloat(e.target.value) || 0)}
                                    className="pr-6"
                                    placeholder="ex: 3.5"
                                />
                                <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Récapitulatif Investisseur */}
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Récapitulatif Investisseur (Mensuel)</h3>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm space-y-2">
                        {(() => {
                            const vacancyMonths = data.vacancyMonth ?? 1;
                            const annualGrossRent = data.monthlyRent * (12 - vacancyMonths);
                            const monthlyEffectiveRent = Math.round(annualGrossRent / 12);

                            const r = data.interestRate / 100 / 12;
                            const n = data.loanDuration * 12;
                            const mainPayment = mainLoan > 0 ? (r === 0 ? mainLoan / n : (mainLoan * r) / (1 - Math.pow(1 + r, -n))) : 0;
                            const ptzPayment = data.includePTZ ? ptzAmount / (20 * 12) : 0;
                            const actionPayment = data.includeActionLogement ? actionAmount / (20 * 12) : 0;
                            const totalMortgage = mainPayment + ptzPayment + actionPayment;

                            const propertyTaxMonthly = Math.round((data.propertyTax || 0) / 12);
                            const pnoMonthly = Math.round((data.pnoInsurance || 0) / 12);
                            const loanInsuranceMonthly = Math.round(data.loanAmount * (data.insuranceRate / 100) / 12);
                            const managementMonthly = Math.round(annualGrossRent * ((data.managementFees || 0) / 100) / 12);
                            const gliMonthly = Math.round(annualGrossRent * ((data.gliRate || 0) / 100) / 12);

                            const energyMonthly = data.simulationColoc ? Math.round((data.surface ?? 50) * (data.heatingType === 'COLLECTIVE' ? 1.0 : 2.5)) : 0;
                            const internetMonthly = data.simulationColoc ? 30 : 0;

                            const totalCharges = propertyTaxMonthly + (data.condoFees || 0) + pnoMonthly + loanInsuranceMonthly + managementMonthly + gliMonthly + energyMonthly + internetMonthly;
                            const totalSorties = Math.round(totalMortgage) + totalCharges;
                            const cashflowAvantImpot = monthlyEffectiveRent - totalSorties;

                            return (
                                <>
                                    {/* Entrées */}
                                    <div className="flex justify-between font-semibold text-emerald-700 border-b pb-2 mb-2">
                                        <span>Loyer Effectif{vacancyMonths > 0 ? ` (${12 - vacancyMonths} mois)` : ''}{data.simulationColoc ? ' (coloc tout inclus)' : ''}</span>
                                        <span>+{monthlyEffectiveRent.toLocaleString()} €/mois</span>
                                    </div>

                                    {/* Sorties */}
                                    <div className="flex justify-between font-semibold text-red-600 border-b pb-2 mb-1">
                                        <span>Total Sorties</span>
                                        <span>-{totalSorties.toLocaleString()} €/mois</span>
                                    </div>
                                    <div className="space-y-0.5 text-slate-600 pb-2">
                                        <div className="flex justify-between"><span>Crédit ({data.loanDuration}a @ {data.interestRate}%)</span><span>{Math.round(totalMortgage)} €</span></div>
                                        <div className="flex justify-between"><span>Charges Copro</span><span>{data.condoFees || 0} €</span></div>
                                        <div className="flex justify-between"><span>Taxe Foncière</span><span>{propertyTaxMonthly} €</span></div>
                                        <div className="flex justify-between"><span>Assurance PNO</span><span>{pnoMonthly} €</span></div>
                                        <div className="flex justify-between"><span>Assurance Emprunteur</span><span>{loanInsuranceMonthly} €</span></div>
                                        {managementMonthly > 0 && <div className="flex justify-between"><span>Gestion ({data.managementFees}%)</span><span>{managementMonthly} €</span></div>}
                                        {gliMonthly > 0 && <div className="flex justify-between"><span>GLI ({data.gliRate}%)</span><span>{gliMonthly} €</span></div>}
                                        {data.simulationColoc && energyMonthly > 0 && <div className="flex justify-between text-amber-700"><span>Énergie (coloc)</span><span>{energyMonthly} €</span></div>}
                                        {data.simulationColoc && internetMonthly > 0 && <div className="flex justify-between text-amber-700"><span>Internet (coloc)</span><span>{internetMonthly} €</span></div>}
                                    </div>

                                    {/* Cashflow */}
                                    <div className={`flex justify-between font-bold text-base pt-2 border-t ${cashflowAvantImpot >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                        <span>Cashflow (avant impôt)</span>
                                        <span>{cashflowAvantImpot >= 0 ? '+' : ''}{cashflowAvantImpot} €/mois</span>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}
