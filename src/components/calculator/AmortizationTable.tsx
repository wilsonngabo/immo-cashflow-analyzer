'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table2, ChevronDown, ChevronRight } from 'lucide-react';
import { InvestmentData, FinancialResults } from '@/lib/types';
import { calculateAmortizationSchedule } from '@/lib/calculations/financials';

interface AmortizationTableProps {
    data: InvestmentData;
    results: FinancialResults;
}

function fmtCur(v: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

export function AmortizationTable({ data, results }: AmortizationTableProps) {
    const [open, setOpen] = useState(false);

    const schedule = useMemo(() => {
        if (!open) return [];
        return calculateAmortizationSchedule(
            data.loanAmount,
            data.interestRate,
            data.loanDuration,
            data.price,
            results.monthlyCashFlowNetNet,
            0.01,
        );
    }, [open, data.loanAmount, data.interestRate, data.loanDuration, data.price, results.monthlyCashFlowNetNet]);

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Table2 className="w-4 h-4 text-primary" />
                        Tableau d&apos;Amortissement
                    </CardTitle>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1"
                        onClick={() => setOpen(o => !o)}
                    >
                        {open
                            ? <><ChevronDown className="w-3.5 h-3.5" /> Réduire</>
                            : <><ChevronRight className="w-3.5 h-3.5" /> Voir tableau</>
                        }
                    </Button>
                </div>
            </CardHeader>

            {open && (
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50 border-y border-slate-200">
                                <tr>
                                    <th className="text-left px-4 py-2 font-medium text-slate-500">Année</th>
                                    <th className="text-right px-3 py-2 font-medium text-slate-500">Capital Restant</th>
                                    <th className="text-right px-3 py-2 font-medium text-slate-500">Intérêts/an</th>
                                    <th className="text-right px-3 py-2 font-medium text-slate-500">Capital Amorti</th>
                                    <th className="text-right px-3 py-2 font-medium text-slate-500">Valeur Bien</th>
                                    <th className="text-right px-3 py-2 font-medium text-slate-500">Cash Cumulé</th>
                                    <th className="text-right px-4 py-2 font-medium text-slate-600 font-semibold">Patrimoine Net</th>
                                </tr>
                            </thead>
                            <tbody>
                                {schedule.map((row, i) => (
                                    <tr
                                        key={row.year}
                                        className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} ${row.year === data.loanDuration ? 'ring-1 ring-inset ring-blue-200 bg-blue-50/30' : ''}`}
                                    >
                                        <td className="px-4 py-2 font-medium text-slate-700">
                                            {row.year === 0 ? 'Départ' : `An ${row.year}`}
                                            {row.year === data.loanDuration && (
                                                <span className="ml-1 text-[9px] bg-blue-100 text-blue-600 px-1 rounded">Fin crédit</span>
                                            )}
                                        </td>
                                        <td className="text-right px-3 py-2 text-slate-600">{fmtCur(row.remainingCapital)}</td>
                                        <td className="text-right px-3 py-2 text-red-400">{row.interestPaid > 0 ? fmtCur(-row.interestPaid) : '—'}</td>
                                        <td className="text-right px-3 py-2 text-green-600">{row.capitalPaid > 0 ? fmtCur(row.capitalPaid) : '—'}</td>
                                        <td className="text-right px-3 py-2 text-slate-600">{fmtCur(row.propertyValue)}</td>
                                        <td className={`text-right px-3 py-2 ${row.cumulativeCashFlow >= 0 ? 'text-green-600' : 'text-red-400'}`}>
                                            {fmtCur(row.cumulativeCashFlow)}
                                        </td>
                                        <td className={`text-right px-4 py-2 font-semibold ${row.netWorth >= 0 ? 'text-slate-800' : 'text-red-500'}`}>
                                            {fmtCur(row.netWorth)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-[10px] text-slate-400 px-4 py-2 border-t">
                        Valeur bien : appréciation +1%/an. Patrimoine Net = Valeur – Capital Restant + Cash Cumulé.
                    </p>
                </CardContent>
            )}
        </Card>
    );
}
