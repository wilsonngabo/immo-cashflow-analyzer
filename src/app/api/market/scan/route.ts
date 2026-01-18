import { NextResponse } from 'next/server';
import { scrapeSeLogerByCity } from '@/lib/scraper/engine';

export async function POST(request: Request) {
    try {
        const { city, zip } = await request.json();

        if (!city || !zip) {
            return NextResponse.json({ error: 'City and Zip required' }, { status: 400 });
        }

        const listings = await scrapeSeLogerByCity(city, zip);
        return NextResponse.json(listings);

    } catch (error) {
        console.error("Market Scan API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
