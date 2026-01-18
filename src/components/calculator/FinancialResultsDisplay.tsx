import { FinancialResults } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, PiggyBank } from 'lucide-react';

interface FinancialResultsDisplayProps {
    results: FinancialResults;
    comparativeResults?: Record<string, FinancialResults>;
    currentMode?: string;
}

export function FinancialResultsDisplay({ results, comparativeResults, currentMode }: FinancialResultsDisplayProps) {
    const formatCurrency = (val: number) =>
        new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

    const formatPercent = (val: number) =>
        new Intl.NumberFormat('fr-FR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(val / 100);

    const isPositive = results.monthlyCashFlowNetNet > 0;

    return (
        <div className="space-y-6">
            {/* Main KPI Card */}
            <Card className={`border-t-4 shadow-lg ${isPositive ? 'border-t-green-500' : 'border-t-red-500'}`}>
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        <span>Résultats</span>
                        <span className={`text-sm px-2 py-1 rounded ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {isPositive ? 'Rentable' : 'Effort d\'épargne'}
                        </span>
                    </CardTitle>
                    <CardDescription>Analyse mensuelle et rendements</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Cashflow Net Net */}
                    <div className="text-center p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                        <div className="text-sm text-slate-500 mb-1">Cash-Flow Net (Après Impôts)</div>
                        <div className={`text-3xl font-bold ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                            {formatCurrency(results.monthlyCashFlowNetNet)}<span className="text-sm text-slate-400">/mois</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                            <div className="flex items-center gap-2 text-blue-700 mb-1">
                                <TrendingUp className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase">Rendement Brut</span>
                            </div>
                            <div className="text-xl font-bold text-slate-800">
                                {formatPercent(results.yieldBrut)}
                            </div>
                        </div>
                        <div className="p-3 bg-purple-50/50 rounded-lg border border-purple-100">
                            <div className="flex items-center gap-2 text-purple-700 mb-1">
                                <PiggyBank className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase">Rendement Net</span>
                            </div>
                            <div className="text-xl font-bold text-slate-800">
                                {formatPercent(results.yieldNet)}
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Visualization Breakdown */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-semibold uppercase text-slate-500">Répartition du Loyer ({Math.round(results.monthlyCashFlowBrut + results.monthlyMortgage + (results.taxes / 12) + results.monthlyCashFlowNetNet)} €)</h4>

                        {/* Simple Stacked Bar */}
                        <div className="h-4 w-full flex rounded-full overflow-hidden text-[8px] text-white font-bold leading-4 text-center">
                            <div style={{ width: `${(results.monthlyMortgage / (results.yieldBrut * results.totalProjectCost / 1200)) * 100}%` }} className="bg-blue-500">
                                Crédit
                            </div>
                            <div style={{ width: `${((results.monthlyCashFlowBrut - results.monthlyCashFlowNet) / (results.yieldBrut * results.totalProjectCost / 1200)) * 100}%` }} className="bg-slate-400">
                                Ch.
                            </div>
                            <div style={{ width: `${((results.taxes / 12) / (results.yieldBrut * results.totalProjectCost / 1200)) * 100}%` }} className="bg-orange-400">
                                Impôt
                            </div>
                            <div className="bg-green-500 flex-1">
                                CF
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div>Crédit</span>
                                <span>{Math.round(results.monthlyMortgage)}€</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-400"></div>Charges/Taxe</span>
                                <span>{Math.round(results.monthlyCashFlowBrut - results.monthlyCashFlowNet)}€</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-400"></div>Impôts (Est.)</span>
                                <span>{Math.round(results.taxes / 12)}€</span>
                            </div>
                            <div className="flex items-center justify-between font-bold">
                                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div>Poche</span>
                                <span className={isPositive ? "text-green-600" : "text-red-500"}>{Math.round(results.monthlyCashFlowNetNet)}€</span>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>Coût Total Projet</span>
                        <span>{formatCurrency(results.totalProjectCost)}</span>
                    </div>

                    {comparativeResults && (
                        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-primary" /> Comparatif Fiscal
                            </h4>
                            <div className="grid grid-cols-4 gap-2 text-center text-xs">
                                {Object.entries(comparativeResults)
                                    .sort(([, a], [, b]) => b.monthlyCashFlowNetNet - a.monthlyCashFlowNetNet) // Sort by Best Cashflow
                                    .map(([mode, res], index) => {
                                        // Calculate 'best' based on cashflow
                                        const allCashflows = Object.values(comparativeResults).map(r => r.monthlyCashFlowNetNet);
                                        const maxCashflow = Math.max(...allCashflows);
                                        const isBest = res.monthlyCashFlowNetNet === maxCashflow;
                                        const isCurrent = mode === currentMode;

                                        return (
                                            <div key={mode} className={`p-2 rounded-lg border ${isCurrent ? 'bg-primary/5 border-primary' : 'bg-slate-50 dark:bg-slate-800 border-transparent'} ${isBest ? 'ring-2 ring-green-500 bg-green-50/50 order-first' : ''}`}>
                                                {isBest && <div className="text-[9px] font-bold text-green-600 uppercase mb-1">Meilleur choix</div>}
                                                <div className="font-semibold mb-1 truncate" title={mode}>
                                                    {mode === 'LMNP_MICRO' ? 'Micro' : mode === 'LMNP_REEL' ? 'Réel' : mode === 'SCI_IS' ? 'SCI' : 'Foncier'}
                                                </div>
                                                <div className={`font-bold ${res.monthlyCashFlowNetNet > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    {Math.round(res.monthlyCashFlowNetNet)}€
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-1">
                                                    Impôt: {Math.round(res.taxes / 12)}€
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {!isPositive && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                    <div className="flex">
                        <div className="ml-3">
                            <p className="text-sm text-yellow-700">
                                Votre projet nécessite un effort d'épargne mensuel.
                                Essayez d'augmenter l'apport ou de négocier le prix d'achat.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

