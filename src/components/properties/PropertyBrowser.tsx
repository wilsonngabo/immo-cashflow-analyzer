'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Database, Search, RefreshCw, Loader2, Building2, MapPin,
    TrendingUp, ChevronLeft, ChevronRight, Zap, AlertCircle, Trash2, Camera, PlayCircle
} from 'lucide-react';
import { Property, InvestmentData } from '@/lib/types';

interface PropertyBrowserProps {
    onAnalyze: (data: Partial<InvestmentData>) => void;
}

interface DBStats {
    total: number;
    avgPrice: number;
    avgSurface: number;
    avgPricePerSqm: number;
    bySources: { leboncoin: number; seloger: number; bienveo?: number };
}

function fmtPrice(v: number) {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M€`;
    if (v >= 1000) return `${Math.round(v / 1000)}k€`;
    return `${v}€`;
}

function sourceBadge(source: string) {
    if (source === 'leboncoin') return <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">LeBonCoin</span>;
    if (source === 'bienveo') return <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">Bienveo</span>;
    return <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">SeLoger</span>;
}

export function PropertyBrowser({ onAnalyze }: PropertyBrowserProps) {
    const { profile, isLoaded } = useProfile();
    const [properties, setProperties] = useState<Property[]>([]);
    const [stats, setStats] = useState<DBStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [pipelineLoading, setPipelineLoading] = useState(false);
    const [regions, setRegions] = useState<{ code: string, nom: string }[]>([]);
    const [allDepartments, setAllDepartments] = useState<{ code: string, nom: string, codeRegion: string }[]>([]);
    const [cities, setCities] = useState<{ code: string, nom: string, codesPostaux: string[] }[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [filterRegion, setFilterRegion] = useState('all');
    const [filterDepartment, setFilterDepartment] = useState('all');
    const [filterCity, setFilterCity] = useState('all');
    const [filterPostalCode, setFilterPostalCode] = useState('');
    const [filterMinPrice, setFilterMinPrice] = useState('');
    const [filterMaxPrice, setFilterMaxPrice] = useState('');
    const [filterMinSurface, setFilterMinSurface] = useState('');
    const [filterMinYield, setFilterMinYield] = useState('');
    const [filterMinCashflow, setFilterMinCashflow] = useState('');
    const [filterSource, setFilterSource] = useState('all');
    const [sortBy, setSortBy] = useState('scrapedAt');

    // Populate initial filters with profile if available
    useEffect(() => {
        if (isLoaded && profile) {
            if (profile.targetYieldMin > 0 && filterMinYield === '') setFilterMinYield(String(profile.targetYieldMin));
            if (profile.targetCashflowMin !== 0 && filterMinCashflow === '') setFilterMinCashflow(String(profile.targetCashflowMin));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoaded, profile]);


    const fetchProperties = useCallback(async (p = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(p),
                pageSize: '24',
                sortBy,
                sortDir: 'desc',
            });
            if (filterRegion !== 'all') {
                params.set('region', filterRegion);
            }
            if (filterDepartment !== 'all') params.set('department', filterDepartment);
            if (filterCity !== 'all') params.set('city', filterCity);
            if (filterPostalCode) params.set('postalCode', filterPostalCode);
            if (filterMinPrice) params.set('minPrice', filterMinPrice);
            if (filterMaxPrice) params.set('maxPrice', filterMaxPrice);
            if (filterMinSurface) params.set('minSurface', filterMinSurface);
            if (filterMinYield) params.set('minYield', filterMinYield);
            if (filterMinCashflow) params.set('minCashflow', filterMinCashflow);
            if (filterSource !== 'all') params.set('source', filterSource);

            const res = await fetch(`/api/properties?${params}`);
            const json = await res.json();
            setProperties(json.properties ?? []);
            setStats(json.stats ?? null);
            setTotal(json.pagination?.total ?? 0);
            setTotalPages(json.pagination?.totalPages ?? 1);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [filterRegion, regions, filterDepartment, filterCity, filterMinPrice, filterMaxPrice, filterMinSurface, filterMinYield, filterMinCashflow, filterSource, sortBy]);

    useEffect(() => {
        fetch('https://geo.api.gouv.fr/regions')
            .then(res => res.json())
            .then(data => setRegions(data.sort((a: any, b: any) => a.nom.localeCompare(b.nom))))
            .catch(console.error);

        fetch('https://geo.api.gouv.fr/departements')
            .then(res => res.json())
            .then(data => setAllDepartments(data.sort((a: any, b: any) => a.code.localeCompare(b.code))))
            .catch(console.error);
    }, []);

    useEffect(() => {
        if (filterDepartment === 'all') {
            setCities([]);
            return;
        }
        fetch(`https://geo.api.gouv.fr/departements/${filterDepartment}/communes?fields=nom,codesPostaux`)
            .then(res => res.json())
            .then(data => setCities(data.sort((a: any, b: any) => a.nom.localeCompare(b.nom))))
            .catch(console.error);
    }, [filterDepartment]);

    useEffect(() => {
        fetchProperties(1);
        setPage(1);
    }, [fetchProperties]);



    const handleClearDB = async () => {
        if (!confirm('Vider toute la base de données ?')) return;
        await fetch('/api/scrape', { method: 'DELETE' });
        setProperties([]);
        setStats(null);
        setTotal(0);
        setFilterRegion('all');
        setFilterDepartment('all');
        setFilterCity('all');
    };

    const handleAnalyze = (p: Property) => {
        onAnalyze({
            price: p.price,
            surface: p.surface ?? 0,
            loanAmount: p.price,
            propertyType: 'OLD',
        });
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const availableDepartments = useMemo(() => {
        if (filterRegion === 'all') return allDepartments;
        const selectedRegion = regions.find(r => r.nom === filterRegion);
        if (!selectedRegion) return allDepartments;
        return allDepartments.filter(d => d.codeRegion === selectedRegion.code);
    }, [allDepartments, filterRegion, regions]);

    const handleRunPipeline = async () => {
        setPipelineLoading(true);
        try {
            const res = await fetch('/api/pipeline', { method: 'POST' });
            if (res.ok) {
                alert('La pipeline de récupération a été lancée en arrière-plan !');
            } else {
                const json = await res.json();
                alert(`Erreur: ${json.error || 'Erreur lors du lancement.'}`);
            }
        } catch (e) {
            console.error(e);
            alert('Erreur lors du lancement de la pipeline.');
        } finally {
            setPipelineLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                        <Database className="w-5 h-5 text-primary" />
                        Base d&apos;Annonces Immobilières
                    </h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {total > 0 ? `${total} annonces en base` : 'Aucune annonce — lancez une collecte ci-dessous'}
                    </p>
                </div>
                <div className="flex gap-2 items-center">
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-primary text-primary hover:bg-primary/5"
                        onClick={handleRunPipeline}
                        disabled={pipelineLoading}
                    >
                        {pipelineLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                        Lancer la Pipeline
                    </Button>
                    {total > 0 && (
                        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-red-500 gap-1" onClick={handleClearDB}>
                            <Trash2 className="w-3.5 h-3.5" /> Vider la base
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats row */}
            {stats && stats.total > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Total annonces', value: stats.total, sub: `LBC: ${stats.bySources.leboncoin} / SL: ${stats.bySources.seloger}` },
                        { label: 'Prix moyen', value: fmtPrice(stats.avgPrice), sub: 'Toutes villes' },
                        { label: 'Surface moyenne', value: `${stats.avgSurface} m²`, sub: 'Annonces avec surface' },
                        { label: 'Prix/m² moyen', value: `${stats.avgPricePerSqm.toLocaleString('fr-FR')} €/m²`, sub: 'Annonces calculables' },
                    ].map(s => (
                        <div key={s.label} className="bg-white rounded-lg border p-3 shadow-sm">
                            <div className="text-xs text-slate-500">{s.label}</div>
                            <div className="text-lg font-bold text-slate-800 mt-0.5">{s.value}</div>
                            <div className="text-[10px] text-slate-400">{s.sub}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Filter bar */}
            {total > 0 && (
                <div className="flex flex-wrap gap-2 items-end">
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Région</Label>
                        <Select value={filterRegion} onValueChange={(v) => {
                            setFilterRegion(v);
                            setFilterDepartment('all');
                            setFilterCity('all');
                        }}>
                            <SelectTrigger className="h-8 text-xs w-44">
                                <Search className="w-3 h-3 mr-1 opacity-50" />
                                <SelectValue placeholder="Toutes les régions" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                                <SelectItem value="all">Toutes les régions</SelectItem>
                                {regions.map(r => <SelectItem key={r.code} value={r.nom}>{r.nom}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Département</Label>
                        <Select value={filterDepartment} onValueChange={(v) => {
                            setFilterDepartment(v);
                            setFilterCity('all');
                        }} disabled={filterRegion === 'all' && regions.length > 0}>
                            <SelectTrigger className="h-8 text-xs w-36">
                                <SelectValue placeholder="Tous les dépts" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                                <SelectItem value="all">Tous les dépts</SelectItem>
                                {availableDepartments.map(d => (
                                    <SelectItem key={d.code} value={d.code}>{d.code} - {d.nom}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Ville (Rechercher)</Label>
                        <div className="relative group">
                            <Input
                                className="h-8 text-xs w-40 pl-7"
                                placeholder="Tours, Lyon..."
                                value={filterCity === 'all' ? '' : filterCity}
                                onChange={e => setFilterCity(e.target.value || 'all')}
                            />
                            <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary transition-colors" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Code Postal</Label>
                        <Input
                            className="h-8 text-xs w-24"
                            type="text"
                            placeholder="75011"
                            value={filterPostalCode}
                            onChange={e => setFilterPostalCode(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Prix min</Label>
                        <Input className="h-8 text-xs w-24" type="number" placeholder="50000" value={filterMinPrice} onChange={e => setFilterMinPrice(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Prix max</Label>
                        <Input className="h-8 text-xs w-24" type="number" placeholder="500000" value={filterMaxPrice} onChange={e => setFilterMaxPrice(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Surface min (m²)</Label>
                        <Input className="h-8 text-xs w-24" type="number" placeholder="20" value={filterMinSurface} onChange={e => setFilterMinSurface(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Renta. min (%)</Label>
                        <Input className="h-8 text-xs w-24" type="number" placeholder="6" value={filterMinYield} onChange={e => setFilterMinYield(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">CF net min (€)</Label>
                        <Input className="h-8 text-xs w-24" type="number" placeholder="150" value={filterMinCashflow} onChange={e => setFilterMinCashflow(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Source</Label>
                        <Select value={filterSource} onValueChange={setFilterSource}>
                            <SelectTrigger className="h-8 text-xs w-32">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Toutes</SelectItem>
                                <SelectItem value="leboncoin">LeBonCoin</SelectItem>
                                <SelectItem value="seloger">SeLoger</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Trier par</Label>
                        <Select value={sortBy} onValueChange={setSortBy}>
                            <SelectTrigger className="h-8 text-xs w-36">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="scrapedAt">Date de collecte</SelectItem>
                                <SelectItem value="price">Prix</SelectItem>
                                <SelectItem value="surface">Surface</SelectItem>
                                <SelectItem value="pricePerSqm">Prix/m²</SelectItem>
                                <SelectItem value="estimatedYield">Rentabilité Brute</SelectItem>
                                <SelectItem value="estimatedCashflow">Cashflow Net</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => fetchProperties(1)}>
                        <Search className="w-3.5 h-3.5" /> Filtrer
                    </Button>
                </div>
            )}

            {/* Property grid */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
            ) : properties.length === 0 && total === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Aucune annonce en base.</p>
                    <p className="text-xs mt-1">Lancez une collecte ci-dessus pour démarrer.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {properties.map(p => (
                            <Card key={p.id} className="flex flex-col overflow-hidden hover:shadow-md transition-shadow group">
                                {/* Image */}
                                {p.imageUrl ? (
                                    <div className="h-32 bg-slate-100 overflow-hidden relative">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                        {p.nbPhotos !== undefined && p.nbPhotos > 0 && (
                                            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                                                <Camera className="w-3 h-3" /> {p.nbPhotos}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-32 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                                        <Building2 className="w-8 h-8 text-slate-300" />
                                    </div>
                                )}

                                <CardContent className="flex-1 flex flex-col p-3">
                                    <div className="flex justify-between items-start mb-1.5">
                                        {sourceBadge(p.source)}
                                        <span className="text-[10px] text-slate-400">
                                            {p.listingType === 'buy' ? 'Achat' : 'Location'}
                                        </span>
                                    </div>

                                    <p className="text-xs font-medium text-slate-700 line-clamp-2 mb-1.5 flex-1">
                                        {p.title}
                                    </p>

                                    <div className="text-lg font-bold text-slate-900">
                                        {fmtPrice(p.price)}
                                    </div>

                                    <div className="flex flex-wrap gap-1.5 mt-1 mb-1 text-[10px] text-slate-500">
                                        {p.surface && <span className="bg-slate-100 px-1.5 py-0.5 rounded">{p.surface} m²</span>}
                                        {p.rooms && <span className="bg-slate-100 px-1.5 py-0.5 rounded">{p.rooms} pièces</span>}
                                        {p.pricePerSqm && <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{p.pricePerSqm.toLocaleString('fr-FR')} €/m²</span>}
                                        {p.estimatedYield !== undefined && <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium">{p.estimatedYield}% Renta</span>}
                                        {p.estimatedCashflow !== undefined && (
                                            <span className={`px-1.5 py-0.5 rounded font-medium ${p.estimatedCashflow > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                                                {p.estimatedCashflow > 0 ? '+' : ''}{p.estimatedCashflow}€ CF
                                            </span>
                                        )}
                                    </div>

                                    {/* Secondary Attributes Row */}
                                    {(p.dpe || p.ges || p.floor !== undefined || p.propertyTax || p.heatingType || p.isNew || p.bedrooms || p.terrain || p.isFurnished || p.hasCellar || p.hasGarage) && (
                                        <div className="flex flex-wrap gap-1.5 mb-2 text-[9px] text-slate-400">
                                            {p.isNew && <span className="border border-indigo-200 text-indigo-500 px-1 py-0.5 rounded">Neuf</span>}
                                            {p.bedrooms !== undefined && <span className="border border-slate-200 px-1 py-0.5 rounded text-slate-600 font-medium">{p.bedrooms} ch.</span>}
                                            {p.terrain !== undefined && <span className="border border-slate-200 bg-amber-50 text-amber-700 px-1 py-0.5 rounded font-medium">Terrain {p.terrain}m²</span>}
                                            {p.floor !== undefined && <span className="border border-slate-200 px-1 py-0.5 rounded">Étage {p.floor}</span>}
                                            {p.isFurnished && <span className="border border-slate-200 px-1 py-0.5 rounded">Meublé</span>}
                                            {p.hasCellar && <span className="border border-slate-200 px-1 py-0.5 rounded">Cave</span>}
                                            {p.hasGarage && <span className="border border-slate-200 px-1 py-0.5 rounded">Garage</span>}
                                            {p.propertyTax !== undefined && <span className="border border-slate-200 px-1 py-0.5 rounded">Taxe: {p.propertyTax}€</span>}
                                            {p.dpe && <span className="border border-slate-200 px-1 py-0.5 rounded font-medium">DPE: {p.dpe}</span>}
                                            {p.ges && <span className="border border-slate-200 px-1 py-0.5 rounded">GES: {p.ges}</span>}
                                            {(p.heatingType || p.energyHeating) && (
                                                <span className="border border-slate-200 px-1 py-0.5 rounded truncate max-w-[80px]">
                                                    {p.heatingType} {p.energyHeating}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {p.city && (
                                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-2">
                                            <MapPin className="w-3 h-3" /> {p.city} {p.postalCode}
                                        </div>
                                    )}

                                    <Separator className="mb-2" />

                                    <div className="flex gap-1.5 mt-auto">
                                        <Button
                                            size="sm"
                                            className="flex-1 h-7 text-xs gap-1"
                                            onClick={() => handleAnalyze(p)}
                                        >
                                            <TrendingUp className="w-3 h-3" /> Analyser
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs px-2"
                                            onClick={() => window.open(p.url, '_blank')}
                                        >
                                            Voir
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-4">
                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { setPage(p => p - 1); fetchProperties(page - 1); }}>
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <span className="text-sm text-slate-500">Page {page} / {totalPages}</span>
                            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => { setPage(p => p + 1); fetchProperties(page + 1); }}>
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
