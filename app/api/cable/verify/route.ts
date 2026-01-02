import { NextResponse } from 'next/server';
import { inlomax } from '@/lib/inlomax';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { serviceID, iucNum } = body;

        if (!serviceID || !iucNum) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const response = await inlomax.validateCable(iucNum, serviceID);

        if (response.status !== 'success') {
            return NextResponse.json({ error: response.message || 'Validation failed' }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            data: response.data // { customerName: "JOHN DOE", currentBouquet: "..." }
        });

    } catch (error: any) {
        console.error('Cable Validation Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
