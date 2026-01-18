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
    const [selectedCities, setSelectedCities] = useState<any[]>([]);
    const [listings, setListings] = useState<MarketListing[]>([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ avgPriceSqM: 0, count: 0 });

    const handleScan = async () => {
        if (selectedCities.length === 0) return;
        setLoading(true);
        setListings([]); // Clear previous

        try {
            let allResults: MarketListing[] = [];

            // Execute scans in parallel
            const promises = selectedCities.map(target =>
                fetch('/api/market/scan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        city: target.nom,
                        zip: target.codesPostaux[0]
                    })
                }).then(res => res.ok ? res.json() : [])
            );

            const resultsArrays = await Promise.all(promises);
            allResults = resultsArrays.flat();

            setListings(allResults);

            if (allResults.length > 0) {
                const totalSqM = allResults.reduce((acc: any, curr: any) => acc + curr.pricePerSqm, 0);
                setStats({
                    avgPriceSqM: Math.round(totalSqM / allResults.length),
                    count: allResults.length
                });
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
                                <LocationSearch
                                    onSelect={(cities) => setSelectedCities(Array.isArray(cities) ? cities : [cities])}
                                    selectedCities={selectedCities}
                                    multi={true}
                                />
                            </div>

                            <Button className="w-full gap-2" onClick={handleScan} disabled={loading || selectedCities.length === 0}>
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
                                            <TableHead>Source</TableHead>
                                            <TableHead>Prix</TableHead>
                                            <TableHead>Surface</TableHead>
                                            <TableHead>€/m²</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {listings.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-10 text-slate-500">
                                                    Aucune donnée. Lancez un scan.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            listings.map((item) => (
                                                <TableRow key={item.id}>
                                                    <TableCell>
                                                        <div className={`text-[10px] px-2 py-1 rounded-full font-bold w-fit ${item.source === 'REAL' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                            {item.source === 'REAL' ? 'SELOGER' : 'SIMULATION'}
                                                        </div>
                                                    </TableCell>
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
