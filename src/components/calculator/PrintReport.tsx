
import { InvestmentData, FinancialResults } from '@/lib/types';
import { Separator } from '@/components/ui/separator';

interface PrintReportProps {
    data: InvestmentData;
    results: FinancialResults;
    city?: any;
}

export function PrintReport({ data, results, city }: PrintReportProps) {
    // Helper to format currency
    const f = (n: number) => Math.round(n).toLocaleString() + ' €';

    return (
        <div className="hidden print:block font-sans p-8 text-black bg-white w-full max-w-[210mm] mx-auto">
            {/* Header */}
            <div className="flex justify-between items-end border-b-2 border-slate-800 pb-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold uppercase tracking-widest">Dossier Bancaire</h1>
                    <p className="text-sm text-slate-500 mt-1">Généré par ImmoCashFlow</p>
                </div>
                <div className="text-right">
                    <div className="text-xl font-semibold">{city ? city.nom : 'Projet Immobilier'}</div>
                    <div className="text-sm text-slate-500">{new Date().toLocaleDateString()}</div>
                </div>
            </div>

            {/* Executive Summary */}
            <section className="mb-8">
                <h2 className="text-lg font-bold uppercase border-b border-slate-300 pb-1 mb-4">Synthèse du Projet</h2>
                <div className="grid grid-cols-2 gap-8 text-sm">
                    <div className="space-y-2">
                        <div className="flex justify-between"><span>Prix d'achat :</span> <span className="font-semibold">{f(data.price)}</span></div>
                        <div className="flex justify-between"><span>Travaux & Meubles :</span> <span className="font-semibold">{f(data.works + data.furniture)}</span></div>
                        <div className="flex justify-between"><span>Frais de Notaire :</span> <span className="font-semibold">{f(data.notaryFees)}</span></div>
                        <div className="border-t border-slate-200 my-2"></div>
                        <div className="flex justify-between font-bold"><span>Coût Total :</span> <span>{f(results.totalProjectCost)}</span></div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between"><span>Surface :</span> <span className="font-semibold">{data.surface} m²</span></div>
                        <div className="flex justify-between"><span>Prix/m² (Total) :</span> <span className="font-semibold">{f(results.totalProjectCost / (data.surface || 1))}/m²</span></div>
                        <div className="flex justify-between"><span>Loyer Mensuel :</span> <span className="font-semibold">{f(data.monthlyRent)}</span></div>
                        <div className="border-t border-slate-200 my-2"></div>
                        <div className="flex justify-between font-bold"><span>Rendement Brut :</span> <span>{results.yieldBrut.toFixed(2)} %</span></div>
                    </div>
                </div>
            </section>

            {/* Financing */}
            <section className="mb-8">
                <h2 className="text-lg font-bold uppercase border-b border-slate-300 pb-1 mb-4">Plan de Financement</h2>
                <div className="grid grid-cols-2 gap-8 text-sm">
                    <div className="space-y-2">
                        <div className="flex justify-between"><span>Apport Personnel :</span> <span className="font-semibold">{f(data.personalContribution || 0)}</span></div>
                        <div className="flex justify-between"><span>Montant Emprunté :</span> <span className="font-semibold">{f(data.loanAmount)}</span></div>
                        <div className="flex justify-between"><span>Durée :</span> <span className="font-semibold">{data.loanDuration} ans</span></div>
                        <div className="flex justify-between"><span>Taux d'intérêt :</span> <span className="font-semibold">{data.interestRate} %</span></div>
                    </div>
                    <div className="space-y-1">
                        <div className="bg-slate-100 p-4 rounded text-center">
                            <div className="text-xs text-slate-500 uppercase">Mensualité Estimée</div>
                            <div className="text-2xl font-bold">{f(results.monthlyMortgage)}</div>
                            <div className="text-xs text-slate-400">hors assurance</div>
                        </div>
                    </div>
                </div>
                {/* PTZ Details if applicable */}
                {(data.includePTZ || data.includeActionLogement) && (
                    <div className="mt-4 text-xs text-slate-500 italic border p-2 rounded">
                        * Incluant les aides :
                        {data.includePTZ && ` PTZ`}
                        {data.includeActionLogement && ` + Action Logement`}
                    </div>
                )}
            </section>

            {/* Cashflow & Charges */}
            <section className="mb-8">
                <h2 className="text-lg font-bold uppercase border-b border-slate-300 pb-1 mb-4">Rentabilité & Trésorerie</h2>
                <div className="mb-4">
                    <div className="grid grid-cols-4 gap-4 text-center border-b pb-4">
                        <div>
                            <div className="text-xs text-slate-500 uppercase">Cashflow Brut</div>
                            <div className="font-semibold">{f(results.monthlyCashFlowBrut)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 uppercase">Cashflow Net</div>
                            <div className="font-semibold">{f(results.monthlyCashFlowNet)}</div>
                        </div>
                        <div>
                            <div className="text-xs text-slate-500 uppercase">Impôts (Est.)</div>
                            <div className="font-semibold text-red-600">-{f(results.taxes / 12)}/mois</div>
                        </div>
                        <div className={`bg-slate-900 text-white rounded p-1`}>
                            <div className="text-xs text-slate-300 uppercase">Cashflow Net Net</div>
                            <div className="font-bold text-lg">{f(results.monthlyCashFlowNetNet)}</div>
                        </div>
                    </div>
                </div>

                <h3 className="text-sm font-semibold mb-2">Détail des Charges Annuelles (Estimé)</h3>
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-xs uppercase">
                        <tr>
                            <th className="p-2">Poste</th>
                            <th className="p-2 text-right">Montant / An</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        <tr><td className="p-2">Taxe Foncière</td><td className="p-2 text-right">{f(data.propertyTax || 0)}</td></tr>
                        <tr><td className="p-2">Charges Copro</td><td className="p-2 text-right">{f((data.condoFees || 0) * 12)}</td></tr>
                        <tr><td className="p-2">Assurance PNO</td><td className="p-2 text-right">{f(data.pnoInsurance || 0)}</td></tr>
                        <tr><td className="p-2">Gestion / GLI</td><td className="p-2 text-right">{f(data.managementFees || 0)}</td></tr>
                        <tr><td className="p-2">Vacance Locative (estim.)</td><td className="p-2 text-right">{f((data.monthlyRent || 0) * (data.vacancyMonth || 0))}</td></tr>
                    </tbody>
                </table>
            </section>

            <div className="text-center text-xs text-slate-400 mt-12 pt-8 border-t">
                <p>Document généré à titre indicatif. Ne constitue pas une offre de prêt contractuelle.</p>
            </div>
        </div>
    );
}
