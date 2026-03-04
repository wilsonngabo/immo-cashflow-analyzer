import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        console.error("====== CLIENT SIDE ERROR CAPTURED ======");
        console.error(body.message);
        console.error(body.stack);
        console.error("=========================================");

        fs.writeFileSync(path.join(process.cwd(), 'client_error_log.txt'), JSON.stringify(body, null, 2));

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ success: false });
    }
}
