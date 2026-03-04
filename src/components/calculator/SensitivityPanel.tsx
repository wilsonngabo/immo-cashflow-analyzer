'use client';

import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Sliders } from 'lucide-react';
import { InvestmentData } from '@/lib/types';
import { calculateFinancials } from '@/lib/calculations/financials';

interface SensitivityPanelProps {
    data: InvestmentData;
    mode: string;
}

const RENT_DELTAS = [-0.20, -0.10, 0, +0.10, +0.20];
const PRICE_DELTAS = [-0.10, 0, +0.10];

function fmt(v: number) {
    const sign = v > 0 ? '+' : '';
    return `${sign}${Math.round(v)} €`;
}

function colorClass(v: number) {
    if (v > 50) return 'text-green-600 font-semibold';
    if (v > 0) return 'text-green-500';
    if (v > -100) return 'text-orange-500';
    return 'text-red-500 font-semibold';
}

export function SensitivityPanel({ data, mode }: SensitivityPanelProps) {
    const matrix = useMemo(() => {
        return PRICE_DELTAS.map(pd => ({
            priceDelta: pd,
            cells: RENT_DELTAS.map(rd => {
                const tweaked: InvestmentData = {
                    ...data,
                    price: Math.round(data.price * (1 + pd)),
                    monthlyRent: Math.round(data.monthlyRent * (1 + rd)),
                    loanAmount: Math.round(data.loanAmount * (1 + pd)),
                };
                const res = calculateFinancials(tweaked, mode);
                return {
                    rentDelta: rd,
                    cashflow: res.monthlyCashFlowNetNet,
                    yieldBrut: res.yieldBrut,
                };
            }),
        }));
    }, [data, mode]);

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-primary" />
                    Analyse de Sensibilité — Cash-Flow Net (€/mois)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                        <thead>
                            <tr>
                                <th className="text-left p-2 text-slate-500 font-medium w-24">
                                    Prix \ Loyer
                                </th>
                                {RENT_DELTAS.map(rd => (
                                    <th key={rd} className="text-center p-2 font-medium text-slate-600 min-w-[72px]">
                                        {rd > 0 ? '+' : ''}{Math.round(rd * 100)}%
                                        <div className="text-[10px] text-slate-400 font-normal">
                                            {Math.round(data.monthlyRent * (1 + rd))} €
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {matrix.map(row => (
                                <tr key={row.priceDelta} className="border-t border-slate-100">
                                    <td className="p-2 text-slate-600 font-medium">
                                        {row.priceDelta > 0 ? '+' : ''}{Math.round(row.priceDelta * 100)}%
                                        <div className="text-[10px] text-slate-400 font-normal">
                                            {Math.round(data.price * (1 + row.priceDelta) / 1000)}k €
                                        </div>
                                    </td>
                                    {row.cells.map(cell => (
                                        <td
                                            key={cell.rentDelta}
                                            className={`text-center p-2 rounded ${cell.rentDelta === 0 && row.priceDelta === 0 ? 'bg-slate-100 ring-1 ring-slate-300' : ''}`}
                                        >
                                            <span className={colorClass(cell.cashflow)}>
                                                {fmt(cell.cashflow)}
                                            </span>
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                {cell.yieldBrut.toFixed(1)}%
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="text-[10px] text-slate-400 mt-3">
                    La cellule centrale (surlignée) correspond à vos valeurs actuelles. Les rendements affichés sont bruts.
                </p>
            </CardContent>
        </Card>
    );
}
