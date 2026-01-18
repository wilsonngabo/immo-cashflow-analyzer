'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Link2, ArrowRight, Loader2 } from 'lucide-react';
import { InvestmentData } from '@/lib/types'; // We might need to map Partial<InvestmentData>

interface UrlImporterProps {
    onDataImported: (data: Partial<InvestmentData>) => void;
}

export function UrlImporter({ onDataImported }: UrlImporterProps) {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleImport = async () => {
        if (!url) return;
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/parse-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });

            if (!response.ok) {
                throw new Error('Echec de l\'importation');
            }

            const data = await response.json();
            onDataImported(data);

        } catch (err) {
            setError('Impossible d\'extraire les données de ce lien.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="border-dashed bg-slate-50 dark:bg-slate-900/50">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Link2 className="w-4 h-4" /> Importer depuis SeLoger / Leboncoin
                </CardTitle>
                <CardDescription>Collez le lien de l'annonce pour pré-remplir la calculatrice.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex gap-2">
                    <Input
                        placeholder="https://www.seloger.com/..."
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="bg-white"
                    />
                    <Button onClick={handleImport} disabled={loading || !url}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    </Button>
                </div>
                {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
            </CardContent>
        </Card>
    );
}
