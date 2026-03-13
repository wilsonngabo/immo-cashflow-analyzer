'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
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
    TrendingUp, ChevronLeft, ChevronRight, Zap, AlertCircle, Camera, ExternalLink
} from 'lucide-react';
import { Property, InvestmentData } from '@/lib/types';
import { getProfileBasedFinancials, buildInvestmentDataFromProperty, getBestTaxRegimeFinancials } from '@/lib/calculations/annonces';
import { useRates } from '@/hooks/useRates';

interface PropertyBrowserProps {
    onAnalyze: (data: Partial<InvestmentData>, options?: { fiscalMode?: string; rentMarketInfo?: { median: number; count: number } | null }) => void;
    initialFilters?: Record<string, string> | null;
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

function sourceLinkLabel(source: string): string {
    if (source === 'leboncoin') return 'Voir sur LeBonCoin';
    if (source === 'bienveo') return 'Voir sur Bienveo';
    return 'Voir sur SeLoger';
}

/** Fallback yield/cashflow when API did not provide them (e.g. buy with price only). */
function fallbackYieldCashflow(price: number): { yield: number; cf: number } {
    const y = 6;
    const cf = (price * (y / 100) * 0.7 - (price * 1.08 * 0.073)) / 12;
    return { yield: y, cf: Math.round(cf) };
}

export function PropertyBrowser({ onAnalyze, initialFilters }: PropertyBrowserProps) {
    const { profile, isLoaded } = useProfile();
    const { rates: liveRates } = useRates();
    const [properties, setProperties] = useState<Property[]>([]);
    const [stats, setStats] = useState<DBStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [regions, setRegions] = useState<{ code: string, nom: string }[]>([]);
    const [allDepartments, setAllDepartments] = useState<{ code: string, nom: string, codeRegion: string }[]>([]);
    const [cities, setCities] = useState<{ code: string, nom: string, codesPostaux: string[] }[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [apiError, setApiError] = useState<string | null>(null);

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
    const [filterOwnerType, setFilterOwnerType] = useState('all');
    const [filterListingType, setFilterListingType] = useState('buy');
    const [filterPropertyKind, setFilterPropertyKind] = useState('all');
    const [sortBy, setSortBy] = useState('scrapedAt');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const hasHydratedFromUrl = useRef(false);

    // DVF: prix médian au m² par code postal (pour "sous/sur le marché")
    const [dvfByPostal, setDvfByPostal] = useState<Record<string, number | null>>({});

    // Do NOT pre-fill filterMinYield/filterMinCashflow from profile here: it would trigger
    // a second fetch with strict filters and an empty result, wiping the list.



    const fetchProperties = useCallback(async (p = 1) => {
        setLoading(true);
        setApiError(null);
        try {
            const params = new URLSearchParams({
                page: String(p),
                pageSize: '24',
                sortBy,
                sortDir,
                listingType: filterListingType,
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
            if (filterOwnerType !== 'all') params.set('ownerType', filterOwnerType);
            if (filterPropertyKind !== 'all') params.set('propertyKind', filterPropertyKind);

            const res = await fetch(`/api/properties?${params}`);
            const json = await res.json();
            if (!res.ok) {
                setApiError(json.error || `Erreur ${res.status}`);
                setProperties([]);
                setTotal(0);
                setTotalPages(1);
                return;
            }
            setProperties(json.properties ?? []);
            setStats(json.stats ?? null);
            setTotal(json.pagination?.total ?? 0);
            setTotalPages(json.pagination?.totalPages ?? 1);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setApiError(msg || 'Erreur réseau');
            setProperties([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [filterRegion, filterDepartment, filterCity, filterPostalCode, filterMinPrice, filterMaxPrice, filterMinSurface, filterMinYield, filterMinCashflow, filterSource, filterOwnerType, filterListingType, filterPropertyKind, sortBy, sortDir]);

    // Ré-ordonner par le cashflow/renta affiché (meilleur régime) pour que l'ordre corresponde à l'écran
    const displayedProperties = useMemo(() => {
        if (properties.length === 0) return properties;
        if (sortBy === 'estimatedCashflow' && isLoaded && profile) {
            return [...properties].sort((a, b) => {
                const cfA = (a.listingType === 'buy' && a.price > 0 && (a.surface || a.pricePerSqm))
                    ? getBestTaxRegimeFinancials(a, profile, liveRates).bestCaseCashflow
                    : (a.estimatedCashflow ?? 0);
                const cfB = (b.listingType === 'buy' && b.price > 0 && (b.surface || b.pricePerSqm))
                    ? getBestTaxRegimeFinancials(b, profile, liveRates).bestCaseCashflow
                    : (b.estimatedCashflow ?? 0);
                return sortDir === 'desc' ? cfB - cfA : cfA - cfB;
            });
        }
        if (sortBy === 'estimatedYield' && isLoaded && profile) {
            return [...properties].sort((a, b) => {
                const yA = (a.listingType === 'buy' && a.price > 0 && (a.surface || a.pricePerSqm))
                    ? getBestTaxRegimeFinancials(a, profile, liveRates).yieldBrut
                    : (a.estimatedYield ?? 0);
                const yB = (b.listingType === 'buy' && b.price > 0 && (b.surface || b.pricePerSqm))
                    ? getBestTaxRegimeFinancials(b, profile, liveRates).yieldBrut
                    : (b.estimatedYield ?? 0);
                return sortDir === 'desc' ? yB - yA : yA - yB;
            });
        }
        return properties;
    }, [properties, sortBy, sortDir, isLoaded, profile, liveRates]);

    // Hydrate filters from URL once on mount (shareable links)
    useEffect(() => {
        if (hasHydratedFromUrl.current) return;
        hasHydratedFromUrl.current = true;
        const r = searchParams.get('region');
        const d = searchParams.get('department');
        const c = searchParams.get('city');
        const pc = searchParams.get('postalCode');
        const minP = searchParams.get('minPrice');
        const maxP = searchParams.get('maxPrice');
        const minS = searchParams.get('minSurface');
        const minY = searchParams.get('minYield');
        const minCf = searchParams.get('minCashflow');
        const src = searchParams.get('source');
        const own = searchParams.get('ownerType');
        const pk = searchParams.get('propertyKind');
        const lt = searchParams.get('listingType');
        const sort = searchParams.get('sortBy');
        const dir = searchParams.get('sortDir');
        if (pk != null) setFilterPropertyKind(pk);
        if (lt != null) setFilterListingType(lt);
        if (r != null) setFilterRegion(r);
        if (d != null) setFilterDepartment(d);
        if (c != null) setFilterCity(c);
        if (pc != null) setFilterPostalCode(pc);
        if (minP != null) setFilterMinPrice(minP);
        if (maxP != null) setFilterMaxPrice(maxP);
        if (minS != null) setFilterMinSurface(minS);
        if (minY != null) setFilterMinYield(minY);
        if (minCf != null) setFilterMinCashflow(minCf);
        if (src != null) setFilterSource(src);
        if (own != null) setFilterOwnerType(own);
        if (sort != null) setSortBy(sort);
        if (dir === 'asc' || dir === 'desc') setSortDir(dir);
    }, [searchParams]);

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

    // Apply programmatic filters (e.g. from "voir annonces similaires")
    useEffect(() => {
        if (!initialFilters) return;
        if (initialFilters.listingType) setFilterListingType(initialFilters.listingType);
        if (initialFilters.postalCode) setFilterPostalCode(initialFilters.postalCode);
        if (initialFilters.minSurface) setFilterMinSurface(initialFilters.minSurface);
        if (initialFilters.propertyKind) setFilterPropertyKind(initialFilters.propertyKind);
        if (initialFilters.region) setFilterRegion(initialFilters.region);
        if (initialFilters.department) setFilterDepartment(initialFilters.department);
    }, [initialFilters]);

    // Debounced fetch: wait 400ms after last filter change so typing is seamless
    useEffect(() => {
        const t = setTimeout(() => {
            fetchProperties(1);
            setPage(1);
        }, 400);
        return () => clearTimeout(t);
    }, [fetchProperties]);

    // Sync filters to URL (debounced) so links are shareable and back button works
    useEffect(() => {
        const t = setTimeout(() => {
            const p = new URLSearchParams();
            if (filterRegion !== 'all') p.set('region', filterRegion);
            if (filterDepartment !== 'all') p.set('department', filterDepartment);
            if (filterCity !== 'all') p.set('city', filterCity);
            if (filterPostalCode) p.set('postalCode', filterPostalCode);
            if (filterMinPrice) p.set('minPrice', filterMinPrice);
            if (filterMaxPrice) p.set('maxPrice', filterMaxPrice);
            if (filterMinSurface) p.set('minSurface', filterMinSurface);
            if (filterMinYield) p.set('minYield', filterMinYield);
            if (filterMinCashflow) p.set('minCashflow', filterMinCashflow);
            if (filterSource !== 'all') p.set('source', filterSource);
            if (filterOwnerType !== 'all') p.set('ownerType', filterOwnerType);
            if (filterPropertyKind !== 'all') p.set('propertyKind', filterPropertyKind);
            if (filterListingType !== 'buy') p.set('listingType', filterListingType);
            if (sortBy !== 'scrapedAt') p.set('sortBy', sortBy);
            if (sortDir !== 'desc') p.set('sortDir', sortDir);
            const q = p.toString();
            const url = q ? `${pathname}?${q}` : pathname;
            router.replace(url, { scroll: false });
        }, 500);
        return () => clearTimeout(t);
    }, [pathname, router, filterRegion, filterDepartment, filterCity, filterPostalCode, filterMinPrice, filterMaxPrice, filterMinSurface, filterMinYield, filterMinCashflow, filterSource, filterOwnerType, filterPropertyKind, filterListingType, sortBy, sortDir]);

    // Fetch DVF median price
    useEffect(() => {
        const postals = new Set<string>();
        properties.forEach(p => {
            if (p.listingType === 'buy' && p.postalCode && p.price && (p.surface || p.pricePerSqm)) {
                postals.add(p.postalCode);
            }
        });
        postals.forEach(code => {
            if (dvfByPostal[code] !== undefined) return;
            fetch(`/api/dvf?postalCode=${encodeURIComponent(code)}`)
                .then(r => r.json())
                .then(data => {
                    setDvfByPostal(prev => ({ ...prev, [code]: data.medianPricePerSqm ?? null }));
                })
                .catch(() => {});
        });
    }, [properties]);


    const handleAnalyze = async (p: Property) => {
        if (isLoaded && profile && p.listingType === 'buy' && p.price > 0) {
            const data = buildInvestmentDataFromProperty(p, profile, liveRates);
            const { bestMode } = getBestTaxRegimeFinancials(p, profile, liveRates);

            // Fetch market rent from LBC location listings stored in DB
            let marketRent: number | null = null;
            let rentMarketInfo: { median: number; count: number } | null = null;
            if (p.postalCode) {
                try {
                    const params = new URLSearchParams({ postalCode: p.postalCode });
                    if (p.surface)   params.set('surface',   String(p.surface));
                    if (p.rooms)     params.set('rooms',     String(p.rooms));
                    if (p.bedrooms)  params.set('bedrooms',  String(p.bedrooms));
                    const res  = await fetch(`/api/rent-estimate?${params}`);
                    const json = await res.json();
                    if (json.count >= 3 && json.medianRent) {
                        marketRent = json.medianRent;
                        rentMarketInfo = {
                            median: json.medianRent,
                            count: json.count,
                            colocPerRoom: json.colocPerRoom ?? null,
                            colocCount: json.colocCount ?? 0,
                            colocSource: json.colocSource ?? null,
                            furnished: json.furnished ?? null,
                            unfurnished: json.unfurnished ?? null,
                        };
                    }
                } catch { /* ignore — fall back to yield-based estimate */ }
            }

            onAnalyze({
                price: data.price,
                surface: data.surface,
                loanAmount: data.loanAmount,
                notaryFees: data.notaryFees,
                monthlyRent: marketRent ?? data.monthlyRent,
                propertyType: data.propertyType,
                zone: data.zone,
                postalCode: p.postalCode,
                propertyTax: data.propertyTax,
                condoFees: data.condoFees,
                pnoInsurance: data.pnoInsurance,
                personalContribution: data.personalContribution,
                interestRate: data.interestRate,
                loanDuration: data.loanDuration,
                rooms: p.rooms,
                bedrooms: p.bedrooms,
                imageUrl: p.imageUrl,
                listingUrl: p.url,
            }, { fiscalMode: bestMode, rentMarketInfo });
        } else {
            const monthlyRent = p.estimatedYield != null
                ? Math.round((p.price * p.estimatedYield / 100) / 12)
                : Math.round((p.price * 0.06) / 12);
            onAnalyze({
                price: p.price,
                surface: p.surface ?? 0,
                loanAmount: p.price,
                monthlyRent,
                postalCode: p.postalCode,
                propertyType: p.source === 'bienveo' ? 'HLM' : 'OLD',
            });
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const availableDepartments = useMemo(() => {
        if (filterRegion === 'all') return allDepartments;
        const selectedRegion = regions.find(r => r.nom === filterRegion);
        if (!selectedRegion) return allDepartments;
        return allDepartments.filter(d => d.codeRegion === selectedRegion.code);
    }, [allDepartments, filterRegion, regions]);

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-lg font-semibold tracking-tight text-[#211D1D] dark:text-[#DAD9D3] flex items-center gap-2">
                        <Database className="w-5 h-5 opacity-70" />
                        Base d&apos;Annonces Immobilières
                    </h2>
                    <p className="text-sm text-[#211D1D]/70 dark:text-[#DAD9D3]/70 mt-1">
                        {total > 0 ? `${total.toLocaleString('fr-FR')} annonce${total > 1 ? 's' : ''} en base` : 'Aucun résultat pour les critères choisis'}
                    </p>
                </div>
            </div>

            {/* Stats row — style AVA: fond discret, typo claire */}
            {stats && stats.total > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Total annonces', value: stats.total, sub: `LBC: ${stats.bySources.leboncoin} / SL: ${stats.bySources.seloger} / BIE: ${stats.bySources.bienveo ?? 0}` },
                        { label: 'Prix moyen', value: fmtPrice(stats.avgPrice), sub: 'Toutes villes' },
                        { label: 'Surface moyenne', value: `${stats.avgSurface} m²`, sub: 'Annonces avec surface' },
                        { label: 'Prix/m² moyen', value: `${stats.avgPricePerSqm.toLocaleString('fr-FR')} €/m²`, sub: 'Annonces calculables' },
                    ].map(s => (
                        <div key={s.label} className="rounded-2xl p-5 bg-[#211D1D]/[0.04] dark:bg-[#DAD9D3]/[0.06] border border-[#211D1D]/[0.08] dark:border-[#DAD9D3]/[0.12]">
                            <div className="text-[10px] font-medium text-[#211D1D]/60 dark:text-[#DAD9D3]/60 uppercase tracking-widest">{s.label}</div>
                            <div className="text-xl font-semibold text-[#211D1D] dark:text-[#DAD9D3] mt-2">{s.value}</div>
                            <div className="text-xs text-[#211D1D]/50 dark:text-[#DAD9D3]/50 mt-1">{s.sub}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Filter bar - toujours visible pour pouvoir modifier les critères */}
            <div className="flex flex-wrap gap-2 items-end">
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Type</Label>
                        <Select value={filterListingType} onValueChange={setFilterListingType}>
                            <SelectTrigger className="h-8 text-xs w-28">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="buy">Achat</SelectItem>
                                <SelectItem value="rent">Location</SelectItem>
                                <SelectItem value="colocation">Colocation</SelectItem>
                                <SelectItem value="all">Tout</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Bien</Label>
                        <Select value={filterPropertyKind} onValueChange={setFilterPropertyKind}>
                            <SelectTrigger className="h-8 text-xs w-32">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous</SelectItem>
                                <SelectItem value="apartment">Appartement</SelectItem>
                                <SelectItem value="house">Maison</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
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
                                <SelectItem value="bienveo">Bienveo</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Annonceur</Label>
                        <Select value={filterOwnerType} onValueChange={setFilterOwnerType}>
                            <SelectTrigger className="h-8 text-xs w-32">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tous (pro + particulier)</SelectItem>
                                <SelectItem value="private">Particulier</SelectItem>
                                <SelectItem value="professional">Pro</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Ordonner par</Label>
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
                                <SelectItem value="estimatedCashflow">Cashflow (Best Case)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Ordre</Label>
                        <Select value={sortDir} onValueChange={(v) => setSortDir(v as 'asc' | 'desc')}>
                            <SelectTrigger className="h-8 text-xs w-32">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="desc">Décroissant</SelectItem>
                                <SelectItem value="asc">Croissant</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={() => fetchProperties(1)}>
                        <Search className="w-3.5 h-3.5" /> Filtrer
                    </Button>
                </div>

            {/* Property grid */}
            {apiError ? (
                <div className="text-center py-16 rounded-2xl border border-[#211D1D]/10 dark:border-[#DAD9D3]/10 bg-[#211D1D]/[0.03] dark:bg-[#DAD9D3]/[0.05] max-w-md mx-auto">
                    <AlertCircle className="w-10 h-10 mx-auto mb-4 text-[#211D1D]/60 dark:text-[#DAD9D3]/60" />
                    <p className="text-sm font-medium text-[#211D1D] dark:text-[#DAD9D3]">Erreur de chargement</p>
                    <p className="text-xs mt-2 text-[#211D1D]/60 dark:text-[#DAD9D3]/60">{apiError}</p>
                    <Button variant="outline" size="sm" className="mt-6 rounded-full border-[#211D1D]/20 dark:border-[#DAD9D3]/20" onClick={() => fetchProperties(1)}>
                        <RefreshCw className="w-4 h-4 mr-2" /> Réessayer
                    </Button>
                </div>
            ) : loading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-[#211D1D]/40 dark:text-[#DAD9D3]/40" />
                </div>
            ) : properties.length === 0 || total === 0 ? (
                <div className="text-center py-16 text-[#211D1D]/60 dark:text-[#DAD9D3]/60">
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm font-medium">Aucun résultat</p>
                    <p className="text-xs mt-2">Modifiez les filtres ou lancez une collecte ci-dessus.</p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {displayedProperties.map((p, idx) => (
                            <Card key={p.id} className="flex flex-col overflow-hidden card-hover rounded-2xl border border-[#211D1D]/[0.08] dark:border-[#DAD9D3]/[0.12] bg-[#DAD9D3]/50 dark:bg-[#211D1D]/50 group animate-fade-in-up" style={{ animationDelay: `${Math.min(idx * 0.04, 0.36)}s` }}>
                                {/* Image */}
                                {p.imageUrl ? (
                                    <div className="h-36 bg-slate-100 overflow-hidden relative">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105" />
                                        {p.nbPhotos !== undefined && p.nbPhotos > 0 && (
                                            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                                                <Camera className="w-3 h-3" /> {p.nbPhotos}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-36 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                                        <Building2 className="w-10 h-10 text-slate-300" />
                                    </div>
                                )}

                                <CardContent className="flex-1 flex flex-col p-4">
                                    <div className="flex flex-wrap gap-1 items-center mb-1.5">
                                        {sourceBadge(p.source)}
                                        {p.propertyKind === 'apartment' && <span className="text-[10px] bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded-full font-medium">Appart</span>}
                                        {p.propertyKind === 'house' && <span className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Maison</span>}
                                        {p.source === 'bienveo' && <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full font-medium">HLM</span>}
                                        {p.ownerType === 'professional' && p.source !== 'bienveo' && <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full font-medium">Pro</span>}
                                        {p.ownerType === 'private' && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">Particulier</span>}
                                    </div>

                                    <p className="text-xs font-medium text-slate-700 line-clamp-2 mb-1.5 flex-1">
                                        {p.title}
                                    </p>

                                    <div className="text-lg font-bold text-slate-900">
                                        {fmtPrice(p.price)}
                                    </div>

                                    {/* Prix vs marché DVF (source: data.gouv.fr / DVF) */}
                                    {p.listingType === 'buy' && p.price && p.postalCode && (p.surface || p.pricePerSqm) && (() => {
                                        const median = dvfByPostal[p.postalCode!];
                                        if (median == null || median <= 0) return null;
                                        const listingPricePerSqm = p.pricePerSqm ?? (p.surface ? p.price / p.surface : 0);
                                        if (!listingPricePerSqm) return null;
                                        const pct = Math.round(((listingPricePerSqm - median) / median) * 100);
                                        const surface = p.surface ?? (p.pricePerSqm ? p.price / p.pricePerSqm : 0);
                                        return (
                                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mb-0.5">
                                                {pct <= -5 && <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Sous le marché (~{Math.abs(pct)}%)</span>}
                                                {pct >= 10 && <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">Sur le marché (+{pct}%)</span>}
                                                {pct > -5 && pct < 10 && <span className="text-[10px] text-slate-500">Prix proche du marché</span>}
                                                {surface > 0 && (
                                                    <span className="text-[10px] text-slate-400">
                                                        Loyer estimé marché: ~{Math.round((median * surface * 0.05) / 12)}€/mois
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    <div className="flex flex-wrap gap-1.5 mt-1 mb-1 text-[10px] text-slate-500">
                                        {p.surface && <span className="bg-slate-100 px-1.5 py-0.5 rounded">{p.surface} m²</span>}
                                        {p.rooms && <span className="bg-slate-100 px-1.5 py-0.5 rounded">{p.rooms} pièces</span>}
                                        {p.pricePerSqm && <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{p.pricePerSqm.toLocaleString('fr-FR')} €/m²</span>}
                                        {(p.listingType === 'buy' && p.price > 0 && (p.surface || p.pricePerSqm) && isLoaded && profile) ? (() => {
                                            const f = getBestTaxRegimeFinancials(p, profile, liveRates);
                                            return (
                                                <>
                                                    <span className={`px-1.5 py-0.5 rounded font-semibold ${f.bestCaseCashflow > 0 ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300' : 'bg-red-100 text-red-700 ring-1 ring-red-300'}`} title={`Best case (0 vacance, ${f.bestCaseLabel})`}>
                                                        {f.bestCaseCashflow > 0 ? '+' : ''}{f.bestCaseCashflow}€ CF
                                                    </span>
                                                    <span className="text-[9px] text-slate-500">{f.bestCaseLabel}</span>
                                                    <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium">{f.yieldBrut.toFixed(1)}%</span>
                                                    <span className="text-[9px] text-slate-500 border border-slate-200 px-1 py-0.5 rounded">{f.bestModeLabel}</span>
                                                    {f.cfColoc0Vac != null && (
                                                        <span className={`px-1.5 py-0.5 rounded font-medium text-[9px] ${f.cfColoc0Vac > 0 ? 'bg-violet-50 text-violet-700' : 'bg-red-50 text-red-600'}`} title="Coloc (0 vacance)">
                                                            {f.cfColoc0Vac > 0 ? '+' : ''}{f.cfColoc0Vac}€ coloc
                                                        </span>
                                                    )}
                                                    <span className={`px-1 py-0.5 rounded text-[9px] ${f.cfLocation0Vac > 0 ? 'text-emerald-600' : 'text-red-500'}`} title="Location classique (0 vacance)">
                                                        {f.cfLocation0Vac > 0 ? '+' : ''}{f.cfLocation0Vac}€ loc
                                                    </span>
                                                </>
                                            );
                                        })() : p.listingType === 'buy' && p.price > 0 ? (() => {
                                            const y = p.estimatedYield ?? fallbackYieldCashflow(p.price).yield;
                                            const cf = p.estimatedCashflow ?? fallbackYieldCashflow(p.price).cf;
                                            const canColoc = (p.bedrooms != null && p.bedrooms >= 2) || (p.rooms != null && p.rooms >= 3);
                                            const cfColoc = canColoc ? Math.round(cf * 1.28) : null;
                                            const bestCf = cfColoc != null ? Math.max(cf, cfColoc) : cf;
                                            const bestLabel = cfColoc != null && cfColoc > cf ? 'Coloc' : 'Location';
                                            return (
                                                <>
                                                    <span className={`px-1.5 py-0.5 rounded font-semibold ${bestCf > 0 ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300' : 'bg-red-100 text-red-700 ring-1 ring-red-300'}`}>
                                                        {bestCf > 0 ? '+' : ''}{bestCf}€ CF
                                                    </span>
                                                    <span className="text-[9px] text-slate-500">{bestLabel}</span>
                                                    <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium">{y}%</span>
                                                    {cfColoc != null && (
                                                        <span className={`px-1.5 py-0.5 rounded font-medium text-[9px] ${cfColoc > 0 ? 'bg-violet-50 text-violet-700' : 'bg-red-50 text-red-600'}`}>
                                                            {cfColoc > 0 ? '+' : ''}{cfColoc}€ coloc
                                                        </span>
                                                    )}
                                                    <span className={`px-1 py-0.5 rounded text-[9px] ${cf > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {cf > 0 ? '+' : ''}{cf}€ loc
                                                    </span>
                                                </>
                                            );
                                        })() : null}
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

                                    <a
                                        href={p.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium mb-2"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        {sourceLinkLabel(p.source)}
                                    </a>

                                    <Separator className="mb-2" />

                                    <div className="flex gap-1.5 mt-auto">
                                        <Button
                                            size="sm"
                                            className="flex-1 h-7 text-xs gap-1"
                                            onClick={() => handleAnalyze(p)}
                                        >
                                            <TrendingUp className="w-3 h-3" /> Analyser
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
