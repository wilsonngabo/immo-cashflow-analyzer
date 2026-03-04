import { NextResponse } from 'next/server';

/**
 * DVF (Demande de Valeurs Foncières) - marché immobilier.
 * Utilise la micro-API api.cquest.org/dvf (code_commune).
 * Doc: https://github.com/cquest/dvf_as_api
 * Note: Alsace, Moselle, Mayotte non couverts par DVF.
 */
const DVF_API_BASE = 'https://api.cquest.org/dvf';
const GEO_API = 'https://geo.api.gouv.fr';

async function getCodeCommuneFromPostal(codePostal: string): Promise<string | null> {
    const res = await fetch(`${GEO_API}/communes?codePostal=${encodeURIComponent(codePostal)}`, {
        next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const communes = await res.json();
    return Array.isArray(communes) && communes.length > 0 ? (communes[0]?.code ?? null) : null;
}

function median(arr: number[]): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const codePostal = searchParams.get('codePostal') ?? searchParams.get('postalCode');
    let codeCommune = searchParams.get('codeCommune') ?? searchParams.get('code_commune');

    if (!codePostal && !codeCommune) {
        return NextResponse.json(
            { error: 'codePostal ou codeCommune requis' },
            { status: 400 }
        );
    }

    if (codePostal && !codeCommune) {
        codeCommune = await getCodeCommuneFromPostal(codePostal);
        if (!codeCommune) {
            return NextResponse.json(
                { medianPricePerSqm: null, count: 0, source: 'dvf' },
                { status: 200 }
            );
        }
    }

    try {
        const params = new URLSearchParams();
        params.set('code_commune', codeCommune!);

        const res = await fetch(`${DVF_API_BASE}?${params}`, {
            headers: { Accept: 'application/json' },
            next: { revalidate: 86400 },
        });

        if (!res.ok) {
            return NextResponse.json(
                { medianPricePerSqm: null, count: 0, source: 'dvf' },
                { status: 200 }
            );
        }

        const data = await res.json();
        const results = Array.isArray(data) ? data : data.results ?? data ?? [];

        if (!Array.isArray(results) || results.length === 0) {
            return NextResponse.json({
                medianPricePerSqm: null,
                count: 0,
                source: 'dvf',
            });
        }

        const pricesPerSqm: number[] = [];
        for (const m of results) {
            const valeur = m.valeur_fonciere ?? m.valeurFonciere;
            const surface = m.surface_reelle_bati ?? m.surface_reelle ?? m.surfaceReelleBati ?? m.surfaceReelle;
            if (valeur != null && surface != null && surface > 0) {
                pricesPerSqm.push(valeur / surface);
            }
        }

        const medianPricePerSqm = pricesPerSqm.length > 0 ? Math.round(median(pricesPerSqm)) : null;

        return NextResponse.json({
            medianPricePerSqm,
            count: pricesPerSqm.length,
            source: 'dvf',
        });
    } catch (e) {
        console.error('[api/dvf]', e);
        return NextResponse.json(
            { medianPricePerSqm: null, count: 0, source: 'dvf' },
            { status: 200 }
        );
    }
}
