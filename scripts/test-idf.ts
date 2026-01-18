
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const TARGET_URL = "https://www.seloger.com/classified-search?distributionTypes=Buy&estateTypes=House,Apartment&locations=AD04FR5";

async function runVisualTest() {
    console.log("========================================");
    console.log("TESTING ILE DE FRANCE (VISUAL MODE)");
    console.log("URL: " + TARGET_URL);
    console.log("========================================");

    const browser = await puppeteer.launch({
        headless: false, // User can see the window
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1280,800'
        ]
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log("Navigating...");
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        const title = await page.title();
        console.log("Page Title:", title);

        // Debug Selectors
        const debugInfo = await page.evaluate(() => {
            // Find elements with price-like text
            const allDivs = Array.from(document.querySelectorAll('div'));
            const priceDivs = allDivs.filter(d => d.textContent && d.textContent.match(/^\d{1,3}( \d{3})* €$/));

            const cards = Array.from(document.querySelectorAll('[data-testid*="card"]'));

            return {
                priceClasses: priceDivs.slice(0, 3).map(d => d.className),
                cardCount: cards.length,
                cardClasses: cards.slice(0, 3).map(c => c.className),
                htmlSample: document.body.innerHTML.substring(0, 500)
            };
        });

        console.log("Debug Info:", debugInfo);

        // Wait a bit to let user see
        await new Promise(r => setTimeout(r, 5000));

    } catch (e) {
        console.error("Puppeteer Failed:", e);
    } finally {
        await browser.close();
    }
}

runVisualTest();
