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
                nbPhotos INTEGER
            )
            CREATE INDEX IF NOT EXISTS idx_listingType ON properties(listingType);
            CREATE INDEX IF NOT EXISTS idx_source ON properties(source);
            CREATE INDEX IF NOT EXISTS idx_postalCode ON properties(postalCode);
            CREATE INDEX IF NOT EXISTS idx_scrapedAt ON properties(scrapedAt);
        `);
    }
    return db;
}
