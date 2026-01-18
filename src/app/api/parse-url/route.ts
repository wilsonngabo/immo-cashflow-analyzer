import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { url } = await request.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // Simulated Scraper Logic
        // In a real app, this would use Cheerio/Puppeteer

        // Mock Data based on domain
        let parsedData = {};

        if (url.includes('seloger.com')) {
            // Mock SeLoger Data
            parsedData = {
                price: 249000,
                surface: 42,
                monthlyRent: 850, // Estimated
                propertyTax: 900, // Estimated
                condoFees: 120, // Estimated
                works: 5000, // Estimated refresh
                isNewConstruction: false,
                description: "Bel appartement T2..."
            };
        } else if (url.includes('leboncoin.fr')) {
            // Mock Leboncoin Data
            parsedData = {
                price: 185000,
                surface: 35,
                monthlyRent: 720,
                works: 15000, // LBC often needs more works
                condoFees: 80,
                isNewConstruction: false
            };
        } else {
            // Generic fallback or error
            // For demo, just return some realistic numbers so it "works" for any link
            parsedData = {
                price: 210000,
                surface: 55,
                monthlyRent: 950,
                works: 0
            };
        }

        return NextResponse.json(parsedData);

    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
