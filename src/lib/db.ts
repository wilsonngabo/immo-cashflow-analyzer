import Database from 'better-sqlite3';
import path from 'path';

let db: ReturnType<typeof Database> | null = null;

export function getDB() {
    if (!db) {
        const dbPath = path.join(process.cwd(), 'data', 'properties.db');
        db = new Database(dbPath, {
            // verbose: console.log
        });
        db.pragma('journal_mode = WAL');

        // Ensure table exists (in case the python script hasn't run yet)
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
        `);
        try {
            db.exec('ALTER TABLE properties ADD COLUMN ownerType TEXT');
        } catch { /* already exists */ }
        try {
            db.exec('ALTER TABLE properties ADD COLUMN estimatedYield REAL');
        } catch { /* already exists */ }
        try {
            db.exec('ALTER TABLE properties ADD COLUMN estimatedCashflow REAL');
        } catch { /* already exists */ }
        try {
            db.exec('ALTER TABLE properties ADD COLUMN region TEXT');
        } catch { /* already exists */ }
        try {
            db.exec('CREATE INDEX IF NOT EXISTS idx_region ON properties(region)');
        } catch { /* already exists */ }
    }
    return db;
}
