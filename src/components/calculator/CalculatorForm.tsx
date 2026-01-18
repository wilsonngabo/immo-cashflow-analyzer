'use client';

import { useState } from 'react';
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
import { calculateFinancials, calculateNotaryFees } from '@/lib/calculations/financials'; // Added calculateNotaryFees

interface CalculatorFormProps {
    data: InvestmentData;
    mode: string;
    onDataChange: (newData: InvestmentData) => void;
    onModeChange: (newMode: string) => void;
}

export function CalculatorForm({ data, mode, onDataChange, onModeChange }: CalculatorFormProps) {
    // Trigger calculation when data or mode changes - handled by parent if parent has logic, 
    // OR we keep mode internal and notify parent of results?
    // Let's keep mode internal for now, but we need to notify parent about results if parent is displaying them.
    // Actually, if parent holds data, parent can calculate results too.
    // Let's expose mode to parent as well so parent can do full calculation.

    // To keep it simple: Parent holds Data. Parent does Calculation. 
    // CalculatorForm just renders Inputs.
    // But we need to lift 'mode' too or pass it up.

    const handleChange = (field: keyof InvestmentData, val: string | number | boolean) => {
        onDataChange({ ...data, [field]: val });
    };

    // We also need to notify about taxation mode change if we want parent to calculate correctly
    // Let's add onModeChange prop or just include mode in InvestmentData? 
    // InvestmentData is "Data", mode is "Settings".
    // Let's add onModeChange to props.

    return (
        <div className="space-y-6">

            {/* Acquisition */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Prix d'achat (€)</Label>
                    <Input
                        type="number"
                        value={data.price}
                        onChange={(e) => handleChange('price', parseFloat(e.target.value) || 0)}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Surface (m²)</Label>
                    <Input
                        type="number"
                        value={data.surface}
                        onChange={(e) => handleChange('surface', parseFloat(e.target.value) || 0)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Travaux (€)</Label>
                    <Input
                        type="number"
                        value={data.works}
                        onChange={(e) => handleChange('works', parseFloat(e.target.value) || 0)}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Meubles (€)</Label>
                    <Input
                        type="number"
                        value={data.furniture}
                        onChange={(e) => handleChange('furniture', parseFloat(e.target.value) || 0)}
                    />
                </div>
            </div>

            <div className="space-y-2">
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
                        <Label>Apport Personnel (€)</Label>
                        <Input
                            type="number"
                            value={data.personalContribution}
                            onChange={(e) => {
                                const apport = parseFloat(e.target.value) || 0;
                                // Recalculate Loan Amount automatically
                                const notary = data.notaryFees > 0 ? data.notaryFees : calculateNotaryFees(data.price, data.propertyType);
                                const total = data.price + data.works + data.furniture + notary;
                                const newLoan = Math.max(0, total - apport);

                                onDataChange({
                                    ...data,
                                    personalContribution: apport,
                                    loanAmount: newLoan
                                });
                            }}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Montant Crédit (€)</Label>
                        <Input
                            type="number"
                            value={Math.round(data.loanAmount)}
                            onChange={(e) => handleChange('loanAmount', parseFloat(e.target.value) || 0)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Taux (%)</Label>
                        <Input
                            type="number"
                            step="0.1"
                            value={data.interestRate}
                            onChange={(e) => handleChange('interestRate', parseFloat(e.target.value) || 0)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Durée (Années)</Label>
                        <Input
                            type="number"
                            value={data.loanDuration}
                            onChange={(e) => handleChange('loanDuration', parseFloat(e.target.value) || 0)}
                        />
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
                        value={data.monthlyRent}
                        onChange={(e) => handleChange('monthlyRent', parseFloat(e.target.value) || 0)}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Taxe Foncière /an (€)</Label>
                    <Input
                        type="number"
                        value={data.propertyTax}
                        onChange={(e) => handleChange('propertyTax', parseFloat(e.target.value) || 0)}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Charges Copro /mois (€)</Label>
                    <Input
                        type="number"
                        value={data.condoFees}
                        onChange={(e) => handleChange('condoFees', parseFloat(e.target.value) || 0)}
                    />
                </div>
            </div>
        </div>
    );
}
