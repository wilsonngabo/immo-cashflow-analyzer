
// Use relative paths to avoid alias issues in simple script execution
import { scrapeWithCheerio } from '../src/lib/scraper/cheerio';
import { scrapeWithPuppeteer } from '../src/lib/scraper/puppeteer';

const CITY = "Bordeaux";
const ZIP = "33000";

async function runTests() {
    console.log("========================================");
    console.log(`TESTING SCRAPERS for ${CITY} (${ZIP})`);
    console.log("========================================");

    // 1. Test Cheerio (Lightweight) - Legacy URL
    console.log("\n[TEST 1] Testing Cheerio (Legacy list.htm)...");
    const t0 = Date.now();
    try {
        // Construct Legacy URL
        // cp:33000 for Bordeaux
        const legacyUrl = `https://www.seloger.com/list.htm?projects=2&types=1,2&places=[{cp:${ZIP}}]&enterprise=0&qsVersion=1.0`;
        console.log(`Checking: ${legacyUrl}`);

        const response = await fetch(legacyUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });

        console.log(`Status: ${response.status}`);
        const html = await response.text();
        // console.log("HTML Preview:", html.substring(0, 500)); 

        // Simple regex check for listings
        const count = (html.match(/Price__PriceContainer/g) || []).length;
        console.log(`[TEST 1] Result: Found ${count} price elements in HTML.`);

    } catch (e) {
        console.error("[TEST 1] Failed:", e);
    }
    console.log(`Time: ${(Date.now() - t0) / 1000}s`);

    // 2. Test Puppeteer (Headless Browser)
    console.log("\n[TEST 2] Testing Puppeteer (Browser)...");
    const t1 = Date.now();
    try {
        const resultsPuppeteer = await scrapeWithPuppeteer(CITY, ZIP);
        console.log(`[TEST 2] Result: ${resultsPuppeteer.length} listings found.`);
        if (resultsPuppeteer.length > 0) {
            console.log("Sample:", resultsPuppeteer[0]);
        } else {
            console.log("No data found (Blocked or Timeout).");
        }
    } catch (e) {
        console.error("[TEST 2] Failed:", e);
    }
    console.log(`Time: ${(Date.now() - t1) / 1000}s`);

    console.log("\n========================================");
    console.log("TEST COMPLETE");
}

runTests();
