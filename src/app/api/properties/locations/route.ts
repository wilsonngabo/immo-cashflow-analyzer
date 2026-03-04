import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { Property } from '@/lib/types';
import { getDepartmentCode, getRegionForDepartment, DEPARTMENTS } from '@/lib/geography';

const DB_PATH = path.join(process.cwd(), 'data', 'properties.json');

export async function GET() {
    try {
        const raw = await fs.readFile(DB_PATH, 'utf-8');
        const properties = JSON.parse(raw) as Property[];

        const locations: Record<string, Record<string, { name: string, cities: Set<string> | string[] }>> = {};

        for (const p of properties) {
            if (!p.postalCode || !p.city) continue;
            const deptCode = getDepartmentCode(p.postalCode);
            if (!deptCode) continue;

            const region = getRegionForDepartment(deptCode) || 'Autre';
            const deptName = DEPARTMENTS[deptCode] || deptCode;
            // capitalize city name properly
            const city = p.city.charAt(0).toUpperCase() + p.city.slice(1).toLowerCase();

            if (!locations[region]) locations[region] = {};
            if (!locations[region][deptCode]) locations[region][deptCode] = { name: deptName, cities: new Set<string>() };

            (locations[region][deptCode].cities as Set<string>).add(city);
        }

        // Convert Sets to sorted Arrays for JSON payload
        for (const region in locations) {
            for (const deptCode in locations[region]) {
                locations[region][deptCode].cities = Array.from(locations[region][deptCode].cities as Set<string>).sort();
            }
        }

        return NextResponse.json(locations);
    } catch (e) {
        return NextResponse.json({}, { status: 500 });
    }
}
