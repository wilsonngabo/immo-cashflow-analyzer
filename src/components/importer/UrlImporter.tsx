'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Link2, ArrowRight, Loader2, CheckCircle2, AlertCircle, PenLine, X } from 'lucide-react';
import { InvestmentData } from '@/lib/types';

interface ParsedListing {
    title?: string;
    price?: number;
    surface?: number;
    rooms?: number;
    city?: string;
    postalCode?: string;
    monthlyRent?: number;
    propertyType?: 'OLD' | 'NEW' | 'HLM';
    source?: string;
}

interface UrlImporterProps {
    onDataImported: (data: Partial<InvestmentData>) => void;
}

function detectSourceLabel(url: string): string | null {
    if (url.includes('seloger.com')) return 'SeLoger';
    if (url.includes('leboncoin.fr')) return 'LeBonCoin';
    if (url.includes('pap.fr')) return 'PAP';
    if (url.includes('bienici.com')) return 'BienIci';
    return null;
}

/** Fallback manual entry form shown when scraping fails */
function ManualFallbackForm({
    prefilled,
    onConfirm,
    onCancel,
}: {
    prefilled?: Partial<ParsedListing>;
    onConfirm: (data: Partial<ParsedListing>) => void;
    onCancel: () => void;
}) {
    const [form, setForm] = useState<Partial<ParsedListing>>({
        price: prefilled?.price,
        surface: prefilled?.surface,
        city: prefilled?.city ?? '',
    });

    const set = (k: keyof ParsedListing, v: string) =>
        setForm(prev => ({ ...prev, [k]: k === 'city' ? v : parseFloat(v) || undefined }));

    return (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
            <div className="flex justify-between items-center">
                <p className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                    <PenLine className="w-3 h-3" /> Saisie manuelle
                </p>
                <button onClick={onCancel} className="text-amber-500 hover:text-amber-800">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                    <Label className="text-xs text-amber-700">Prix (€)</Label>
                    <Input
                        type="number"
                        className="h-8 text-xs bg-white"
                        placeholder="ex: 180000"
                        value={form.price ?? ''}
                        onChange={e => set('price', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-amber-700">Surface (m²)</Label>
                    <Input
                        type="number"
                        className="h-8 text-xs bg-white"
                        placeholder="ex: 45"
                        value={form.surface ?? ''}
                        onChange={e => set('surface', e.target.value)}
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-amber-700">Ville</Label>
                    <Input
                        type="text"
                        className="h-8 text-xs bg-white"
                        placeholder="ex: Lyon"
                        value={form.city ?? ''}
                        onChange={e => set('city', e.target.value)}
                    />
                </div>
            </div>
            <Button
                size="sm"
                className="w-full h-8 text-xs"
                onClick={() => onConfirm(form)}
                disabled={!form.price && !form.surface}
            >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Appliquer
            </Button>
        </div>
    );
}

export function UrlImporter({ onDataImported }: UrlImporterProps) {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [warning, setWarning] = useState('');
    const [imported, setImported] = useState<ParsedListing | null>(null);
    const [showManual, setShowManual] = useState(false);
    const [manualPrefill, setManualPrefill] = useState<Partial<ParsedListing> | undefined>();
    const [scraperApiConfigured, setScraperApiConfigured] = useState<boolean | null>(null);

    const sourceLabel = url ? detectSourceLabel(url) : null;

    const applyListing = (listing: Partial<ParsedListing>) => {
        const partial: Partial<InvestmentData> = {};
        if (listing.price) { partial.price = listing.price; partial.loanAmount = listing.price; }
        if (listing.surface) partial.surface = listing.surface;
        if (listing.propertyType) partial.propertyType = listing.propertyType;
        if (listing.monthlyRent) partial.monthlyRent = listing.monthlyRent;
        onDataImported(partial);
    };

    const handleImport = async () => {
        if (!url) return;
        setLoading(true);
        setError('');
        setWarning('');
        setImported(null);
        setShowManual(false);
        setManualPrefill(undefined);

        try {
            const response = await fetch('/api/parse-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            const json = await response.json();
            setScraperApiConfigured(json.scraperApiConfigured ?? null);

            if (response.ok && json.success) {
                const listing: ParsedListing = json.listing ?? json;
                setImported(listing);
                applyListing(listing);
                return;
            }

            // 422 — blocked or no data
            if (response.status === 422) {
                if (json.listing) {
                    // Partial data — still apply what we have + show manual option
                    setImported(json.listing);
                    applyListing(json.listing);
                    setManualPrefill(json.listing);
                }
                if (json.blocked || json.warning) {
                    setWarning(json.warning ?? json.error ?? 'Données partielles.');
                    setShowManual(true);
                }
                return;
            }

            setError(json.error ?? 'Impossible d\'extraire les données de ce lien.');

        } catch (err) {
            setError('Erreur réseau. Vérifiez votre connexion.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleManualConfirm = (data: Partial<ParsedListing>) => {
        setImported(prev => ({ ...prev, ...data }));
        applyListing(data);
        setShowManual(false);
        setWarning('');
    };

    return (
        <Card className="border-dashed bg-slate-50 dark:bg-slate-900/50">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Link2 className="w-4 h-4" /> Importer depuis SeLoger / Leboncoin / BienIci
                    {sourceLabel && (
                        <span className="ml-auto text-[10px] font-normal bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            {sourceLabel} détecté
                        </span>
                    )}
                </CardTitle>
                <CardDescription>Collez le lien de l&apos;annonce pour pré-remplir la calculatrice.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex gap-2">
                    <Input
                        placeholder="https://www.seloger.com/... ou leboncoin.fr/..."
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleImport()}
                        className="bg-white"
                    />
                    <Button onClick={handleImport} disabled={loading || !url}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    </Button>
                </div>

                {scraperApiConfigured === false && sourceLabel && (
                    <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                        ⚡ Pour de meilleurs résultats sur {sourceLabel}, configurez{' '}
                        <code className="bg-slate-100 px-1 rounded">SCRAPERAPI_KEY</code> dans{' '}
                        <code className="bg-slate-100 px-1 rounded">.env.local</code>
                    </p>
                )}

                {error && (
                    <div className="flex items-start gap-2 mt-2 text-xs text-red-600 bg-red-50 rounded p-2">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {warning && !showManual && (
                    <div className="flex items-start gap-2 mt-2 text-xs text-amber-600 bg-amber-50 rounded p-2">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>{warning}</span>
                    </div>
                )}

                {warning && showManual && (
                    <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded p-2 flex flex-col gap-1.5">
                        <div className="flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>{warning}</span>
                        </div>
                        <ManualFallbackForm
                            prefilled={manualPrefill}
                            onConfirm={handleManualConfirm}
                            onCancel={() => setShowManual(false)}
                        />
                    </div>
                )}

                {imported && !showManual && (
                    <div className="flex items-start gap-2 mt-2 text-xs text-green-700 bg-green-50 rounded p-2">
                        <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <div>
                            <span className="font-medium">Données importées depuis {imported.source}</span>
                            {imported.title && <p className="text-slate-500 mt-0.5 truncate max-w-xs">{imported.title}</p>}
                            <div className="flex flex-wrap gap-2 mt-1">
                                {imported.price && <span className="bg-white px-1.5 py-0.5 rounded border border-green-200">{imported.price.toLocaleString('fr-FR')} €</span>}
                                {imported.surface && <span className="bg-white px-1.5 py-0.5 rounded border border-green-200">{imported.surface} m²</span>}
                                {imported.city && <span className="bg-white px-1.5 py-0.5 rounded border border-green-200">{imported.city}</span>}
                            </div>
                            <button
                                className="text-[10px] text-slate-400 mt-1.5 underline hover:text-amber-600"
                                onClick={() => { setShowManual(true); setManualPrefill(imported); }}
                            >
                                Corriger manuellement
                            </button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
