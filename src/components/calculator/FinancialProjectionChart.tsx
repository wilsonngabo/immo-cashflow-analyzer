'use client';

import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Wallet } from 'lucide-react';
import { InvestmentData, FinancialResults } from '@/lib/types';
import { calculateAmortizationSchedule } from '@/lib/calculations/financials';
import { useMemo } from 'react';

interface FinancialProjectionChartProps {
    data: InvestmentData;
    results: FinancialResults;
}

export function FinancialProjectionChart({ data, results }: FinancialProjectionChartProps) {
    const projectionData = useMemo(() => {
        const initialValue = data.price + data.works;
        return calculateAmortizationSchedule(
            data.loanAmount,
            data.interestRate,
            data.loanDuration,
            initialValue,
            results.monthlyCashFlowNetNet, // Pass Cashflow
            0.01
        );
    }, [data, results]);

    const finalNetWorth = projectionData[projectionData.length - 1]?.netWorth || 0;
    const finalCash = projectionData[projectionData.length - 1]?.cumulativeCashFlow || 0;

    return (
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-indigo-600" />
                            Projection Patrimoniale (20 ans)
                        </CardTitle>
                        <CardDescription>
                            Enrichissement total (Capital Amorti + Plus-value + Cashflow cumulé).
                        </CardDescription>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-slate-500">Enrichissement Global</div>
                        <div className="text-2xl font-bold text-indigo-600">
                            +{Math.round(finalNetWorth).toLocaleString('fr-FR')} €
                        </div>
                        <div className="text-[10px] text-slate-400">
                            dont {Math.round(finalCash).toLocaleString()} € de cash
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={projectionData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="year" />
                            <YAxis
                                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                            />
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <Tooltip
                                formatter={(value: any, name: any) => [`${Math.round(Number(value) || 0).toLocaleString()} €`, name]}
                                labelFormatter={(label) => `Année ${label}`}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="netWorth"
                                stackId="1"
                                stroke="#4f46e5"
                                fill="url(#colorNetWorth)"
                                name="Patrimoine Net Total"
                                strokeWidth={2}
                            />
                            <Area
                                type="monotone"
                                dataKey="cumulativeCashFlow"
                                stackId="2"
                                stroke="#22c55e"
                                fill="transparent"
                                name="Cashflow Cumulé"
                                strokeDasharray="3 3"
                            />
                            <Area
                                type="monotone"
                                dataKey="remainingCapital"
                                stackId="3"
                                stroke="#94a3b8"
                                fill="transparent"
                                name="Dette Restante"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
