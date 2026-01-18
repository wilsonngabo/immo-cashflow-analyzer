import { FinancialResults, InvestmentData, SavedSimulation } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { getSimulationVerdict } from '@/lib/calculations/comparison';
import { Badge } from '@/components/ui/badge';

interface ComparisonDashboardProps {
    simulations: SavedSimulation[];
    onLoad: (sim: SavedSimulation) => void;
    onDelete: (id: string) => void;
}

export function ComparisonDashboard({ simulations, onLoad, onDelete }: ComparisonDashboardProps) {

    const getScoreColor = (score: number) => {
        if (score >= 70) return 'text-green-600';
        if (score >= 50) return 'text-yellow-600';
        return 'text-red-600';
    };

    if (simulations.length === 0) {
        return (
            <Card className="bg-slate-50 border-dashed">
                <CardContent className="flex flex-col items-center justify-center p-8 text-slate-500">
                    <p>Aucune simulation enregistrée.</p>
                    <p className="text-sm">Sauvegardez vos calculs pour les comparer ici.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold tracking-tight">Comparateur de Projets</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {simulations.map((sim) => {
                    const verdict = getSimulationVerdict(sim, simulations);

                    return (
                        <Card key={sim.id} className="relative overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                            <div className={`absolute top-0 left-0 w-1 h-full ${sim.results.monthlyCashFlowNetNet > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start mb-1">
                                    <CardTitle className="text-base font-semibold truncate pr-4">{sim.name}</CardTitle>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500" onClick={() => onDelete(sim.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-500">{new Date(sim.date).toLocaleDateString()}</span>
                                    {verdict && (
                                        <Badge variant="outline" className={`${verdict.badgeColor} border font-normal`}>
                                            {verdict.badge}
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4 text-sm flex-1 flex flex-col">
                                {/* Verdict Description */}
                                {verdict && (
                                    <div className="text-xs bg-slate-50 p-2 rounded text-slate-600 italic">
                                        "{verdict.description}"
                                    </div>
                                )}

                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500">Score Immo</span>
                                    <span className={`text-lg font-bold ${getScoreColor(sim.score)}`}>{sim.score}/100</span>
                                </div>

                                <Separator />

                                <div className="grid grid-cols-2 gap-y-2">
                                    <span className="text-slate-500">Prix</span>
                                    <span className="font-medium text-right">{sim.data.price / 1000}k €</span>

                                    <span className="text-slate-500">Renta Brute</span>
                                    <span className="font-medium text-right">{sim.results.yieldBrut.toFixed(1)}%</span>

                                    <span className="text-slate-500">Charges/mois</span>
                                    <span className="font-medium text-right text-slate-700">{Math.round(sim.results.monthlyCashFlowBrut - sim.results.monthlyCashFlowNet)} €</span>

                                    <span className="text-slate-500">Impôts/an</span>
                                    <span className="font-medium text-right text-orange-600">{Math.round(sim.results.taxes)} €</span>

                                    <span className="text-slate-500">Cash-Flow</span>
                                    <span className={`font-medium text-right ${sim.results.monthlyCashFlowNetNet > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                        {Math.round(sim.results.monthlyCashFlowNetNet)} €
                                    </span>
                                </div>

                                <div className="mt-auto pt-4">
                                    <Button variant="outline" className="w-full" onClick={() => onLoad(sim)}>
                                        Charger
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
