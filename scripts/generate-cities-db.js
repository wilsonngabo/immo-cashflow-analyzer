
const fs = require('fs');
const https = require('https');

const url = 'https://geo.api.gouv.fr/communes?fields=nom,code,codesPostaux,population&format=json';
const outputPath = './src/data/cities.json';

console.log('Fetching French cities database...');

https.get(url, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        const cities = JSON.parse(data);
        // Filter for relevant cities (e.g. population > 500 to avoid tiny hamlets if needed, but user said "every city")
        // We will keep all.

        fs.writeFileSync(outputPath, JSON.stringify(cities, null, 2));
        console.log(`Successfully saved ${cities.length} cities to ${outputPath}`);
    });

}).on('error', (err) => {
    console.error('Error fetching cities:', err.message);
});
