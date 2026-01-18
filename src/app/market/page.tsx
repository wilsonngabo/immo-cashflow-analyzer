'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { scrapeSeLogerByCity, MarketListing } from '@/lib/scraper/engine';
import { Loader2, Search, Database, BarChart3 } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

import { LocationSearch } from '@/components/location/LocationSearch';

export default function MarketExplorer() {
    const [selectedCity, setSelectedCity] = useState<any>(null);
    const [listings, setListings] = useState<MarketListing[]>([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ avgPriceSqM: 0, count: 0 });

    const handleScan = async () => {
        if (!selectedCity) return;
        setLoading(true);
        try {
            // Call API implementation
            const res = await fetch('/api/market/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    city: selectedCity.nom,
                    zip: selectedCity.codesPostaux[0]
                })
            });

            if (res.ok) {
                const results = await res.json();
                setListings(results);

                if (results.length > 0) {
                    const totalSqM = results.reduce((acc: any, curr: any) => acc + curr.pricePerSqm, 0);
                    setStats({
                        avgPriceSqM: Math.round(totalSqM / results.length),
                        count: results.length
                    });
                }
            }
        } catch (e) {
            console.error("Scan failed", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
            {/* Header */}
            <header className="border-b bg-white dark:bg-slate-900 sticky top-0 z-10 px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.href = '/'}>
                    {/* Reusing existing icons or just text */}
                    <div className="bg-primary/10 p-2 rounded-lg">
                        <Database className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">ImmoCashFlow</h1>
                        <p className="text-xs text-slate-500 font-medium">Market Explorer</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.location.href = '/'}>
                        ← Retour Calculatrice
                    </Button>
                </div>
            </header>

            <div className="max-w-6xl mx-auto space-y-8 pt-8 px-4">

                <div className="flex items-center gap-4">
                    <Database className="w-8 h-8 text-primary" />
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Market Explorer</h1>
                        <p className="text-slate-500">Scraping & Analyse de Marché (Base de Données)</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Control Panel */}
                    <Card className="md:col-span-1 h-fit">
                        <CardHeader>
                            <CardTitle>Scanner une Ville</CardTitle>
                            <CardDescription>Choisir une ville dans la base de données</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Ville cible</label>
                                <LocationSearch onSelect={setSelectedCity} />
                                {selectedCity && (
                                    <p className="text-xs text-green-600 font-medium">
                                        Cible: {selectedCity.nom} ({selectedCity.codesPostaux[0]})
                                    </p>
                                )}
                            </div>

                            <Button className="w-full gap-2" onClick={handleScan} disabled={loading || !selectedCity}>
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                Lancer le Scraper
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Stats & DB View */}
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex justify-between items-center">
                                <span>Base de Données ({listings.length} annonces)</span>
                                {stats.count > 0 && (
                                    <div className="flex items-center gap-2 text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full">
                                        <BarChart3 className="w-4 h-4" />
                                        Moyenne: {stats.avgPriceSqM} €/m²
                                    </div>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="max-h-[500px] overflow-auto border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Prix</TableHead>
                                            <TableHead>Surface</TableHead>
                                            <TableHead>€/m²</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {listings.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-10 text-slate-500">
                                                    Aucune donnée. Lancez un scan.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            listings.map((item) => (
                                                <TableRow key={item.id}>
                                                    <TableCell>{(item.price / 1000).toFixed(0)}k €</TableCell>
                                                    <TableCell>{item.surface} m²</TableCell>
                                                    <TableCell className="font-medium">{item.pricePerSqm} €</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" className="h-6 text-xs">Détails</Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
