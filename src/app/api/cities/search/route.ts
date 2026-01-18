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

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('q') || '').toLowerCase().trim();

    if (!query || query.length < 2) {
        return NextResponse.json([]);
    }

    const cities = getCities();
    if (!cities) return NextResponse.json([]);

    // Filter cities
    // Logic: Name starts with query OR Zip starts with query
    const results = cities.filter((city: any) => {
        const nameMatch = city.nom.toLowerCase().includes(query);
        const zipMatch = city.codesPostaux.some((cp: string) => cp.startsWith(query));
        return nameMatch || zipMatch;
    }).slice(0, 50); // Limit to 50 results

    return NextResponse.json(results);
}
