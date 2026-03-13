import Database from 'better-sqlite3';
import path from 'path';

let db: ReturnType<typeof Database> | null = null;

export function getDB() {
    if (!db) {
        const dbPath = path.join(process.cwd(), 'data', 'properties.db');
        db = new Database(dbPath);

        // Performance pragmas for 900k+ records
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');
        db.pragma('cache_size = -64000');   // 64MB cache
        db.pragma('temp_store = MEMORY');
        db.pragma('mmap_size = 268435456'); // 256MB memory-mapped I/O

        db.exec(`
            CREATE TABLE IF NOT EXISTS properties (
                id TEXT PRIMARY KEY,
                source TEXT,
                title TEXT,
                price REAL,
                surface REAL,
                rooms INTEGER,
                city TEXT,
                postalCode TEXT,
                propertyKind TEXT,
                listingType TEXT,
                url TEXT,
                imageUrl TEXT,
                description TEXT,
                scrapedAt TEXT,
                pricePerSqm REAL,
                dpe TEXT,
                ges TEXT,
                charges REAL,
                floor INTEGER,
                hasElevator BOOLEAN,
                hasBalcony BOOLEAN,
                hasParking BOOLEAN,
                builtYear INTEGER,
                propertyTax REAL,
                isNew BOOLEAN,
                energyHeating TEXT,
                heatingType TEXT,
                bedrooms INTEGER,
                isFurnished BOOLEAN,
                hasCellar BOOLEAN,
                hasGarage BOOLEAN,
                terrain REAL,
                nbPhotos INTEGER,
                ownerType TEXT,
                estimatedYield REAL,
                estimatedCashflow REAL,
                region TEXT
            );
            -- Single-column indexes
            CREATE INDEX IF NOT EXISTS idx_listingType ON properties(listingType);
            CREATE INDEX IF NOT EXISTS idx_source ON properties(source);
            CREATE INDEX IF NOT EXISTS idx_postalCode ON properties(postalCode);
            CREATE INDEX IF NOT EXISTS idx_scrapedAt ON properties(scrapedAt);
            CREATE INDEX IF NOT EXISTS idx_ownerType ON properties(ownerType);
            CREATE INDEX IF NOT EXISTS idx_price ON properties(price);
            CREATE INDEX IF NOT EXISTS idx_surface ON properties(surface);
            CREATE INDEX IF NOT EXISTS idx_city ON properties(city);
            CREATE INDEX IF NOT EXISTS idx_estimatedYield ON properties(estimatedYield);
            CREATE INDEX IF NOT EXISTS idx_estimatedCashflow ON properties(estimatedCashflow);
            CREATE INDEX IF NOT EXISTS idx_region ON properties(region);
            CREATE INDEX IF NOT EXISTS idx_pricePerSqm ON properties(pricePerSqm);
            -- Composite indexes for common filter+sort combos (900k perf)
            CREATE INDEX IF NOT EXISTS idx_listing_scraped ON properties(listingType, scrapedAt DESC);
            CREATE INDEX IF NOT EXISTS idx_listing_yield ON properties(listingType, estimatedYield DESC);
            CREATE INDEX IF NOT EXISTS idx_listing_cashflow ON properties(listingType, estimatedCashflow DESC);
            CREATE INDEX IF NOT EXISTS idx_region_listing ON properties(region, listingType);
            CREATE INDEX IF NOT EXISTS idx_listing_price ON properties(listingType, price);
        `);
        for (const col of [
            ['ownerType', 'TEXT'], ['estimatedYield', 'REAL'],
            ['estimatedCashflow', 'REAL'], ['region', 'TEXT'],
        ] as const) {
            try { db.exec(`ALTER TABLE properties ADD COLUMN ${col[0]} ${col[1]}`); } catch { /* exists */ }
        }

        db.exec(`
            CREATE TABLE IF NOT EXISTS mortgage_rates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scrapedAt TEXT NOT NULL,
                source TEXT NOT NULL,
                sourceUrl TEXT,
                duration INTEGER NOT NULL,
                region TEXT,
                rate REAL NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_rates_scraped ON mortgage_rates(scrapedAt DESC);
            CREATE INDEX IF NOT EXISTS idx_rates_region ON mortgage_rates(region, duration);
        `);
    }
    return db;
}
