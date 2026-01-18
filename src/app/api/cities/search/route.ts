import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Load cities once in memory (Server Side - careful with memory, but 5MB is fine for Node process)
// In a real generic usage, we might stream or use a real DB.
let citiesCache: any[] | null = null;

function getCities() {
    if (citiesCache) return citiesCache;
    try {
        const filePath = path.join(process.cwd(), 'src', 'data', 'cities.json');
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        citiesCache = JSON.parse(fileContent);
        return citiesCache;
    } catch (e) {
        console.error("Failed to load cities.json", e);
        return [];
    }
}

// Basic Dept Mapping (Partial for MVP, can be expanded)
const DEPARTMENTS: Record<string, string> = {
    '01': 'Ain', '02': 'Aisne', '03': 'Allier', '04': 'Alpes-de-Haute-Provence', '05': 'Hautes-Alpes',
    '06': 'Alpes-Maritimes', '07': 'Ardèche', '08': 'Ardennes', '09': 'Ariège', '10': 'Aube',
    '11': 'Aude', '12': 'Aveyron', '13': 'Bouches-du-Rhône', '14': 'Calvados', '15': 'Cantal',
    '16': 'Charente', '17': 'Charente-Maritime', '18': 'Cher', '19': 'Corrèze', '21': 'Côte-d\'Or',
    '22': 'Côtes-d\'Armor', '23': 'Creuse', '24': 'Dordogne', '25': 'Doubs', '26': 'Drôme',
    '27': 'Eure', '28': 'Eure-et-Loir', '29': 'Finistère', '30': 'Gard', '31': 'Haute-Garonne',
    '32': 'Gers', '33': 'Gironde', '34': 'Hérault', '35': 'Ille-et-Vilaine', '36': 'Indre',
    '37': 'Indre-et-Loire', '38': 'Isère', '39': 'Jura', '40': 'Landes', '41': 'Loir-et-Cher',
    '42': 'Loire', '43': 'Haute-Loire', '44': 'Loire-Atlantique', '45': 'Loiret', '46': 'Lot',
    '47': 'Lot-et-Garonne', '48': 'Lozère', '49': 'Maine-et-Loire', '50': 'Manche', '51': 'Marne',
    '52': 'Haute-Marne', '53': 'Mayenne', '54': 'Meurthe-et-Moselle', '55': 'Meuse', '56': 'Morbihan',
    '57': 'Moselle', '58': 'Nièvre', '59': 'Nord', '60': 'Oise', '61': 'Orne', '62': 'Pas-de-Calais',
    '63': 'Puy-de-Dôme', '64': 'Pyrénées-Atlantiques', '65': 'Hautes-Pyrénées', '66': 'Pyrénées-Orientales',
    '67': 'Bas-Rhin', '68': 'Haut-Rhin', '69': 'Rhône', '70': 'Haute-Saône', '71': 'Saône-et-Loire',
    '72': 'Sarthe', '73': 'Savoie', '74': 'Haute-Savoie', '75': 'Paris', '76': 'Seine-Maritime',
    '77': 'Seine-et-Marne', '78': 'Yvelines', '79': 'Deux-Sèvres', '80': 'Somme', '81': 'Tarn',
    '82': 'Tarn-et-Garonne', '83': 'Var', '84': 'Vaucluse', '85': 'Vendée', '86': 'Vienne',
    '87': 'Haute-Vienne', '88': 'Vosges', '89': 'Yonne', '90': 'Territoire de Belfort', '91': 'Essonne',
    '92': 'Hauts-de-Seine', '93': 'Seine-Saint-Denis', '94': 'Val-de-Marne', '95': 'Val-d\'Oise'
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('q') || '').toLowerCase().trim();

    if (!query || query.length < 2) {
        return NextResponse.json([]);
    }

    const cities = getCities();
    if (!cities) return NextResponse.json([]);

    let results = [];

    // 1. Department Match Logic (if 2 digits)
    if (query.length === 2 && /^\d{2}$/.test(query)) {
        const deptName = DEPARTMENTS[query];
        if (deptName) {
            results.push({
                nom: `${query} - ${deptName} (Tout le département)`,
                code: query, // Special ID for dept
                codesPostaux: [query],
                population: 0,
                isDepartment: true
            });
        }
    }

    // 2. City Filter
    // Limit standard results to 50
    const cityMatches = cities.filter((city: any) => {
        const nameMatch = city.nom.toLowerCase().includes(query);
        const zipMatch = city.codesPostaux.some((cp: string) => cp.startsWith(query));
        return nameMatch || zipMatch;
    }).slice(0, 50);

    results = [...results, ...cityMatches];

    return NextResponse.json(results);
}
