import { NextResponse } from 'next/server';
import { inlomax } from '@/lib/inlomax';

export async function GET() {
    try {
        const data = await inlomax.getServices();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
