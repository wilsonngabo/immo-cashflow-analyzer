'use client';

import { useState, useEffect } from 'react';
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

interface CalculatorFormProps {
    data: InvestmentData;
    mode: string;
    onDataChange: (newData: InvestmentData) => void;
    onModeChange: (newMode: string) => void;
}

export function CalculatorForm({ data, mode, onDataChange, onModeChange }: CalculatorFormProps) {
    const handleChange = (field: keyof InvestmentData, val: string | number | boolean) => {
        onDataChange({ ...data, [field]: val });
    };

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

    // Auto-calculate Interest Rate based on Duration
    useEffect(() => {
        const marketRate = getMarketRate(data.loanDuration);
        if (data.interestRate !== marketRate) {
            handleChange('interestRate', marketRate);
        }
    }, [data.loanDuration, data.interestRate, handleChange]);

    // Check Eligibility automatically if HLM params change
    useEffect(() => {
        if (data.propertyType === 'HLM' && data.revenueN2 && data.householdSize) {
            const isEligible = checkEligibility(data.revenueN2, data.householdSize);
            if (isEligible && !data.includePTZ) {
                // Optional auto-check
            }
        }
    }, [data.revenueN2, data.householdSize, data.propertyType, data.includePTZ]);

    // Handler for manual eligibility check
    const handleCheckEligibility = () => {
        if (data.revenueN2 === undefined || data.revenueN2 === null || !data.householdSize) {
            alert("Veuillez renseigner le Revenu Fiscal N-2 et le nombre de Personnes Fiscales.");
            return;
        }

        // Calculate Cost Basis
        const notary = data.manualNotaryFees ? data.notaryFees : calculateNotaryFees(data.price, data.propertyType, data.reducedNotaryFees);
        const totalProject = data.price + data.works + data.furniture + notary;

        const zone = data.zone || 'B1';
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

            <Separator />

            {/* Financement */}
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Financement</h3>
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
                                <Label htmlFor="ptz" className="text-xs cursor-pointer">PTZ (30k)</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="action"
                                    checked={data.includeActionLogement}
                                    onChange={(e) => handleChange('includeActionLogement', e.target.checked)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <Label htmlFor="action" className="text-xs cursor-pointer">Action Logement (15k)</Label>
                            </div>
                        </div>
                    </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="flex justify-between">
                            <span>Montant Crédit (€)</span>
                            <span className="text-[10px] bg-slate-100 px-1 rounded text-slate-500 font-normal">Calculé</span>
                        </Label>
                        <Input
                            type="number"
                            value={Math.round(data.loanAmount)}
                            readOnly
                            className="bg-slate-50 text-slate-500"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="flex justify-between">
                            <span>Taux (%)</span>
                            <span className="text-[10px] bg-slate-100 px-1 rounded text-slate-500 font-normal">Moyen</span>
                        </Label>
                        <Input
                            type="number"
                            step="0.1"
                            value={data.interestRate}
                            readOnly
                            className="bg-slate-50 text-slate-500"
                            onChange={(e) => handleChange('interestRate', parseFloat(e.target.value) || 0)}
                        />
                    </div>
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
                                {Array.from({ length: 30 }, (_, i) => i + 1).map((year) => (
                                    <SelectItem key={year} value={String(year)}>
                                        {year} ans
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <Separator />

            {/* Charges & Loyer */}
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Exploitation</h3>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Loyer Mensuel CC (€)</Label>
                    <Input
                        type="number"
                        value={data.monthlyRent ?? ''}
                        onChange={(e) => handleChange('monthlyRent', parseFloat(e.target.value) || 0)}
                    />
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
            </div>
        </div>
    );
}
