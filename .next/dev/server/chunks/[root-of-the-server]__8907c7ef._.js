module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[project]/utils/pricing.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "calculateDataProfit",
    ()=>calculateDataProfit
]);
function calculateDataProfit(planName) {
    // Normalize string: remove spaces, lowercase
    const name = planName.toLowerCase().replace(/\s/g, '');
    // Extract number and unit
    const match = name.match(/(\d+(?:\.\d+)?)(mb|gb|tb)/);
    if (!match) return 0; // Default if parsing fails
    const value = parseFloat(match[1]);
    const unit = match[2];
    // Convert to GB for standardized comparison
    let sizeInGB = value;
    if (unit === 'mb') {
        sizeInGB = value / 1024;
    } else if (unit === 'tb') {
        sizeInGB = value * 1024;
    }
    // Pricing tiers logic
    if (sizeInGB <= 1) {
        return 10;
    } else if (sizeInGB <= 3) {
        return 20;
    } else if (sizeInGB <= 5) {
        return 30;
    } else if (sizeInGB <= 10) {
        return 50;
    } else {
        return 100; // > 10GB
    }
}
}),
"[project]/app/api/purchase/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$utils$2f$pricing$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/utils/pricing.ts [app-route] (ecmascript)");
;
async function POST(req) {
    try {
        const body = await req.json();
        const { userId, serviceType, amount, mobileNumber, serviceID, network, planName } = body;
        console.log('Purchase Request:', {
            userId,
            serviceType,
            amount,
            mobileNumber,
            planName
        });
        if (!userId || !amount || !mobileNumber || !serviceID) {
            return NextResponse.json({
                error: 'Missing required fields'
            }, {
                status: 400
            });
        }
        // 0. Check for Maintenance Mode & Markup
        const { data: settings } = await supabaseAdmin.from('system_settings').select('*');
        const config = settings?.reduce((acc, curr)=>{
            acc[curr.key] = curr.value;
            return acc;
        }, {}) || {};
        const generalConfig = config.general || {};
        if (generalConfig.maintenance) {
            return NextResponse.json({
                error: 'System is currently under maintenance. Please try again later.'
            }, {
                status: 503
            });
        }
        // ... existing serviceKey logic ...
        let markupToApply = 0;
        if (serviceType === 'DATA' && planName) {
            markupToApply = (0, __TURBOPACK__imported__module__$5b$project$5d2f$utils$2f$pricing$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["calculateDataProfit"])(planName);
        } else {
            // Fallback to DB markup for other services or if planName missing
            const globalMarkup = Number(generalConfig.markup || 0);
            markupToApply = globalMarkup;
        // Note: In a real app we might still check specific markup from DB here for non-DATA
        }
        // Calculate total cost to user (Provider Amount + Markup)
        // Ensure 'amount' passed from frontend is the BASE amount or TOTAL?
        // Usually, frontend shows Plan Price. We should charge Plan Price + Markup?
        // Or is Plan Price already including Markup?
        // Let's assume 'amount' is what the user expects to pay (Plan Price).
        // If we want to add a fee ON TOP, we do it here.
        // For simplicity: Charged Amount = Amount + Markup.
        const totalCharge = Number(amount) + markupToApply;
        // 1. Check User Balance from WALLETS table
        const { data: wallet, error: walletError } = await supabaseAdmin.from('wallets').select('balance').eq('user_id', userId).single();
        if (walletError || !wallet) {
            return NextResponse.json({
                error: 'User wallet not found.'
            }, {
                status: 404
            });
        }
        if (Number(wallet.balance) < totalCharge) {
            return NextResponse.json({
                error: `Insufficient balance. Required: ₦${totalCharge}`
            }, {
                status: 400
            });
        }
        // 2. Call Inlomax API (Send the actual cost to provider, not the charged amount)
        let apiResponse;
        if (serviceType === 'AIRTIME') {
            apiResponse = await inlomax.purchaseAirtime(mobileNumber, amount, serviceID);
        } else if (serviceType === 'DATA') {
            apiResponse = await inlomax.purchaseData(mobileNumber, serviceID);
        } else {
            return NextResponse.json({
                error: 'Invalid service type'
            }, {
                status: 400
            });
        }
        if (apiResponse.status !== 'success') {
            console.error('Provider API Failed:', apiResponse); // Log full response
            let errorMsg = apiResponse.message || 'Provider failed';
            const lowerMsg = errorMsg.toLowerCase();
            // Masking provider empty wallet error
            if (lowerMsg.includes('insufficient funds') || lowerMsg.includes('insuffucient funds')) {
                errorMsg = 'Service temporarily unavailable. Please try again later.';
            }
            return NextResponse.json({
                error: errorMsg,
                debug: apiResponse
            }, {
                status: 502
            });
        }
        // 3. Deduct Total Charge from WALLETS
        const newBalance = Number(wallet.balance) - totalCharge;
        const { error: updateError } = await supabaseAdmin.from('wallets').update({
            balance: newBalance
        }).eq('user_id', userId);
        if (updateError) {
            console.error('CRITICAL: Failed to deduct balance', userId, totalCharge, updateError);
        }
        // 4. Record Transaction
        await supabaseAdmin.from('transactions').insert({
            user_id: userId,
            type: 'purchase',
            service_id: serviceID,
            amount: Number(amount),
            charged_amount: totalCharge,
            status: 'success',
            reference: apiResponse.data?.reference || `REF-${Date.now()}`,
            meta: {
                service_type: serviceType,
                mobile: mobileNumber,
                network: network,
                provider_ref: apiResponse.data?.reference,
                markup_applied: markupToApply,
                profit: markupToApply
            }
        });
        return NextResponse.json({
            success: true,
            newBalance,
            message: apiResponse.message
        });
    } catch (err) {
        console.error('Purchase API Exception:', err);
        return NextResponse.json({
            error: err.message || 'Internal Server Error'
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__8907c7ef._.js.map