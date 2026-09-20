import { NextResponse } from 'next/server';
import { getConfiguredServices } from '@/lib/vtu-providers';

export async function GET() {
    try {
        const data = await getConfiguredServices();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
