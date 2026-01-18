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

export default function MarketExplorer() {
    const [city, setCity] = useState('');
    const [zip, setZip] = useState('');
    const [listings, setListings] = useState<MarketListing[]>([]);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ avgPriceSqM: 0, count: 0 });

    const handleScan = async () => {
        if (!city || !zip) return;
        setLoading(true);
        try {
            // In a real app, this would be a server action or API call
            // For now calling the engine directly (client-side simulation)
            const results = await scrapeSeLogerByCity(city, zip);
            setListings(results);

            // Calculate Stats
            if (results.length > 0) {
                const totalSqM = results.reduce((acc, curr) => acc + curr.pricePerSqm, 0);
                setStats({
                    avgPriceSqM: Math.round(totalSqM / results.length),
                    count: results.length
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
            <div className="max-w-6xl mx-auto space-y-8">

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
                            <CardDescription>Récupérer les annonces SeLoger</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Ville</label>
                                <Input placeholder="ex: Bordeaux" value={city} onChange={e => setCity(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Code Postal</label>
                                <Input placeholder="ex: 33000" value={zip} onChange={e => setZip(e.target.value)} />
                            </div>
                            <Button className="w-full gap-2" onClick={handleScan} disabled={loading || !city || !zip}>
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
