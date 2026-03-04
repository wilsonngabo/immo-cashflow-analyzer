'use client';

import { useState, useEffect } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { User, Save, TrendingUp, Wallet, Home, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
    const { profile, updateProfile, isLoaded } = useProfile();
    const [formData, setFormData] = useState(profile);
    const [saved, setSaved] = useState(false);

    // Sync formData once profile is loaded from localStorage
    useEffect(() => {
        if (isLoaded) {
            setFormData(profile);
        }
    }, [isLoaded, profile]);

    const handleChange = (field: keyof typeof formData, value: number) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setSaved(false);
    };

    const handleSave = () => {
        updateProfile(formData);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    if (!isLoaded) return null;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
            <header className="border-b bg-white dark:bg-slate-900 sticky top-0 z-10 px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="bg-primary/10 p-2 rounded-lg">
                        <User className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Mon Profil</h1>
                        <p className="text-xs text-slate-500 font-medium">Préférences et paramètres d'investissement</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Link href="/">
                        <Button variant="outline" size="sm" className="gap-2">
                            <Home className="w-4 h-4" /> Retour au Simulateur
                        </Button>
                    </Link>
                    <Button onClick={handleSave} size="sm" className="gap-2 bg-primary text-white">
                        <Save className="w-4 h-4" /> Enregistrer
                    </Button>
                </div>
            </header>

            <main className="container mx-auto max-w-4xl pt-8 px-4 sm:px-6 lg:px-8 space-y-6">

                {saved && (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md flex items-center gap-2 animate-in fade-in slide-in-from-top-2 shadow-sm">
                        <Save className="w-5 h-5" />
                        <span>Profil enregistré avec succès ! Vos préférences seront utilisées par défaut.</span>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="shadow-lg border-0 bg-white/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Wallet className="w-5 h-5 text-blue-500" /> Situation Financière</CardTitle>
                            <CardDescription>Vos revenus et apports par défaut pour le calcul des prêts.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Salaire Brut Annuel (€)</Label>
                                <Input
                                    type="number"
                                    value={formData.annualSalary || ''}
                                    onChange={(e) => handleChange('annualSalary', parseFloat(e.target.value) || 0)}
                                />
                                <p className="text-xs text-slate-500">Sert à estimer votre capacité d'emprunt (taux d'endettement max).</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Apport Personnel par défaut (€)</Label>
                                <Input
                                    type="number"
                                    value={formData.personalContribution || ''}
                                    onChange={(e) => handleChange('personalContribution', parseFloat(e.target.value) || 0)}
                                />
                            </div>

                            <Separator className="my-2" />

                            <div className="space-y-2">
                                <Label>Revenu Fiscal N-2 (€)</Label>
                                <Input
                                    type="number"
                                    value={formData.revenueN2 || ''}
                                    onChange={(e) => handleChange('revenueN2', parseFloat(e.target.value) || 0)}
                                />
                                <p className="text-xs text-slate-500">Pour évaluer l'éligibilité aux aides (PTZ, Action Logement).</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Nombre de Parts Fiscales (Personnes)</Label>
                                <Input
                                    type="number"
                                    value={formData.householdSize || ''}
                                    onChange={(e) => handleChange('householdSize', parseFloat(e.target.value) || 1)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-lg border-0 bg-white/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-500" /> Objectifs & Banque</CardTitle>
                            <CardDescription>Critères de recherche et paramètres d'emprunt.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Durée Prêt par défaut (Ans)</Label>
                                    <Input
                                        type="number"
                                        value={formData.defaultLoanDuration || ''}
                                        onChange={(e) => handleChange('defaultLoanDuration', parseFloat(e.target.value) || 20)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Taux Intérêt Défaut (%)</Label>
                                    <Input
                                        type="number" step="0.1"
                                        value={formData.defaultInterestRate || ''}
                                        onChange={(e) => handleChange('defaultInterestRate', parseFloat(e.target.value) || 3.8)}
                                    />
                                </div>
                            </div>

                            <Separator className="my-2" />

                            <div className="space-y-2">
                                <Label className="flex justify-between items-center">
                                    <span>Taux Endettement Max (%)</span>
                                    <span className="text-xs text-slate-400">Classique: 35%</span>
                                </Label>
                                <Input
                                    type="number"
                                    value={formData.maxDebtRatio || ''}
                                    onChange={(e) => handleChange('maxDebtRatio', parseFloat(e.target.value) || 35)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Rentabilité Brute Visée (%)</Label>
                                    <Input
                                        type="number" step="0.5"
                                        value={formData.targetYieldMin || ''}
                                        onChange={(e) => handleChange('targetYieldMin', parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Cashflow Net Visé (€)</Label>
                                    <Input
                                        type="number"
                                        value={formData.targetCashflowMin || ''}
                                        onChange={(e) => handleChange('targetCashflowMin', parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                            </div>

                            <div className="mt-4 p-3 bg-amber-50 text-amber-800 text-sm rounded-md border border-amber-200 flex gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>Ces critères seront utilisés pour filtrer et mettre en évidence les meilleures annonces dans la recherche.</div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
