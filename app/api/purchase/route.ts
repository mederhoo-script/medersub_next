import { NextResponse } from 'next/server';
// Force rebuild
import { supabaseAdmin } from '@/lib/supabase-admin';
import { inlomax } from '@/lib/inlomax';
import { calculateDataProfit } from '@/utils/pricing';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { userId, serviceType, amount, mobileNumber, serviceID, network, planName, meterType, quantity } = body;

        console.log('Purchase Request:', { userId, serviceType, amount, mobileNumber, planName });

        // Validate required fields (mobileNumber not required for EDUCATION)
        if (!userId || !amount || !serviceID) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (serviceType !== 'EDUCATION' && !mobileNumber) {
            return NextResponse.json({ error: 'Mobile number is required' }, { status: 400 });
        }

        // 0. Check for Maintenance Mode & Markup
        const { data: settings } = await supabaseAdmin.from('system_settings').select('*');
        const config = settings?.reduce((acc: any, curr: any) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {}) || {};

        const generalConfig = config.general || {};

        if (generalConfig.maintenance) {
            return NextResponse.json({ error: 'System is currently under maintenance. Please try again later.' }, { status: 503 });
        }

        // ... existing serviceKey logic ...

        let markupToApply = 0;
        let discount = 0;

        if (serviceType === 'DATA' && planName) {
            markupToApply = calculateDataProfit(planName);
        } else if (serviceType === 'AIRTIME') {
            // Apply Discount for Airtime
            const purchaseAmount = Number(amount);
            if (network === 'MTN' || network === 'AIRTEL') {
                discount = purchaseAmount * 0.01; // 1%
            } else {
                discount = purchaseAmount * 0.02; // 2%
            }
        } else if (serviceType === 'CABLE') {
            // DB markup for CABLE could be added here if needed, or specific logic.
            // For now, assume markup/discount logic is similar to others or standard DB config
            const globalMarkup = Number(generalConfig.markup || 0);
            markupToApply = globalMarkup;
        } else if (serviceType === 'ELECTRICITY') {
            // Apply Discount for Electricity (0.5%)
            const purchaseAmount = Number(amount);
            discount = purchaseAmount * 0.005;
        } else if (serviceType === 'EDUCATION') {
            // Apply ₦20 profit per pin
            const qty = Number(quantity || 1);
            markupToApply = 20 * qty;
        } else {
            // Fallback to DB markup for other services
            const globalMarkup = Number(generalConfig.markup || 0);
            markupToApply = globalMarkup;
        }

        // Calculate total cost to user 
        // For Airtime: Charged = Amount - Discount
        // For Data/Others: Charged = Amount + Markup
        const totalCharge = (Number(amount) + markupToApply) - discount;

        // 1. Check User Balance from WALLETS table
        const { data: wallet, error: walletError } = await supabaseAdmin
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .single();

        if (walletError || !wallet) {
            return NextResponse.json({ error: 'User wallet not found.' }, { status: 404 });
        }

        if (Number(wallet.balance) < totalCharge) {
            return NextResponse.json({ error: `Insufficient balance. Required: ₦${totalCharge}` }, { status: 400 });
        }

        // 2. Call Inlomax API (Send the actual cost to provider, not the charged amount)
        let apiResponse;
        if (serviceType === 'AIRTIME') {
            apiResponse = await inlomax.purchaseAirtime(mobileNumber, amount, serviceID);
        } else if (serviceType === 'DATA') {
            apiResponse = await inlomax.purchaseData(mobileNumber, serviceID);
        } else if (serviceType === 'CABLE') {
            // "mobileNumber" here will act as "iucNum" for Cable
            apiResponse = await inlomax.purchaseCable(mobileNumber, serviceID);
        } else if (serviceType === 'ELECTRICITY') {
            // "mobileNumber" is meterNum
            const mType = meterType || 1; // Default to 1 (Prepaid) if missing
            apiResponse = await inlomax.payElectricity(mobileNumber, serviceID, mType, Number(amount));
        } else if (serviceType === 'EDUCATION') {
            const qty = Number(quantity || 1);
            apiResponse = await inlomax.purchaseEducation(serviceID, qty);
        } else {
            return NextResponse.json({ error: 'Invalid service type' }, { status: 400 });
        }

        if (apiResponse.status !== 'success') {
            console.error('Provider API Failed:', apiResponse); // Log full response
            let errorMsg = apiResponse.message || 'Provider failed';
            const lowerMsg = errorMsg.toLowerCase();
            // Masking provider empty wallet error
            if (lowerMsg.includes('insufficient funds') || lowerMsg.includes('insuffucient funds')) {
                errorMsg = 'Service temporarily unavailable. Please try again later.';
            }
            return NextResponse.json({ error: errorMsg, debug: apiResponse }, { status: 502 });
        }

        // 3. Deduct Total Charge from WALLETS
        const newBalance = Number(wallet.balance) - totalCharge;
        const { error: updateError } = await supabaseAdmin
            .from('wallets')
            .update({ balance: newBalance })
            .eq('user_id', userId);

        if (updateError) {
            console.error('CRITICAL: Failed to deduct balance', userId, totalCharge, updateError);
        }

        // 4. Record Transaction
        await supabaseAdmin.from('transactions').insert({
            user_id: userId,
            type: 'purchase',
            service_id: serviceID,
            amount: Number(amount), // Provider cost
            charged_amount: totalCharge, // What user paid (includes profit)
            status: 'success',
            reference: apiResponse.data?.reference || `REF-${Date.now()}`,
            meta: {
                service_type: serviceType, // 'AIRTIME', 'DATA', 'EDUCATION', etc.
                mobile: mobileNumber,
                network: network,
                provider_ref: apiResponse.data?.reference,
                markup_applied: markupToApply,
                profit: markupToApply,
                ...(serviceType === 'EDUCATION' && apiResponse.data?.pins ? { pins: apiResponse.data.pins } : {})
            }
        });

        return NextResponse.json({
            success: true,
            newBalance,
            message: apiResponse.message,
            ...(serviceType === 'EDUCATION' && apiResponse.data?.pins ? { pins: apiResponse.data.pins } : {})
        });

    } catch (err: any) {
        console.error('Purchase API Exception:', err);
        return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
    }
}
