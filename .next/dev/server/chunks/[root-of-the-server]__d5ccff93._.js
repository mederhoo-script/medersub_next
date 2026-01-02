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
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/lib/supabase.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "supabase",
    ()=>supabase
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/index.mjs [app-route] (ecmascript) <locals>");
;
const supabaseUrl = ("TURBOPACK compile-time value", "https://arbagxcbwqmquydrowjw.supabase.co");
const supabaseAnonKey = ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyYmFneGNid3FtcXV5ZHJvd2p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NjIwMjMsImV4cCI6MjA3MjEzODAyM30.k7-oHFYulHIWs56vBzhQnClvJAlLfhyhdL7rZuauAfk");
const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["createClient"])(supabaseUrl, supabaseAnonKey);
}),
"[project]/lib/inlomax.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "inlomax",
    ()=>inlomax
]);
(()=>{
    const e = new Error("Cannot find module 'axios'");
    e.code = 'MODULE_NOT_FOUND';
    throw e;
})();
;
const INLOMAX_API_KEY = process.env.INLOMAX_API_KEY;
const BASE_URL = 'https://inlomax.com/api';
const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Authorization': `Token ${INLOMAX_API_KEY}`,
        'Content-Type': 'application/json'
    }
});
const inlomax = {
    getBalance: async ()=>{
        try {
            const { data } = await api.get('/balance');
            return data;
        } catch (error) {
            console.error('Inlomax Balance Error:', error.response?.data || error.message);
            return {
                status: 'error',
                message: 'Failed to fetch balance'
            };
        }
    },
    getServices: async ()=>{
        try {
            const { data } = await api.get('/services');
            return data;
        } catch (error) {
            console.error('Inlomax Services Error:', error.response?.data || error.message);
            return {
                status: 'error',
                message: 'Failed to fetch services'
            };
        }
    },
    purchaseAirtime: async (mobileNumber, amount, serviceID)=>{
        try {
            const { data } = await api.post('/airtime', {
                mobileNumber,
                amount,
                serviceID
            });
            return data;
        } catch (error) {
            console.error('Inlomax Airtime Error:', error.response?.data || error.message);
            // Return the error response properly
            return error.response?.data || {
                status: 'error',
                message: 'Failed to purchase airtime'
            };
        }
    },
    purchaseData: async (mobileNumber, serviceID)=>{
        try {
            const { data } = await api.post('/data', {
                mobileNumber,
                serviceID
            });
            return data;
        } catch (error) {
            console.error('Inlomax Data Error:', error.response?.data || error.message);
            return error.response?.data || {
                status: 'error',
                message: 'Failed to purchase data'
            };
        }
    },
    validateCable: async (iucNum, serviceID)=>{
        try {
            const { data } = await api.post('/validatecable', {
                iucNum,
                serviceID
            });
            return data;
        } catch (error) {
            return error.response?.data || {
                status: 'error',
                message: 'Failed to validate cable'
            };
        }
    },
    purchaseCable: async (iucNum, serviceID)=>{
        try {
            const { data } = await api.post('/subcable', {
                iucNum,
                serviceID
            });
            return data;
        } catch (error) {
            return error.response?.data || {
                status: 'error',
                message: 'Failed to subscribe cable'
            };
        }
    },
    validateMeter: async (meterNum, serviceID, meterType)=>{
        try {
            const { data } = await api.post('/validatemeter', {
                meterNum,
                serviceID,
                meterType
            });
            return data;
        } catch (error) {
            return error.response?.data || {
                status: 'error',
                message: 'Failed to validate meter'
            };
        }
    },
    payElectricity: async (meterNum, serviceID, meterType, amount)=>{
        try {
            const { data } = await api.post('/payelectric', {
                meterNum,
                serviceID,
                meterType,
                amount
            });
            return data;
        } catch (error) {
            return error.response?.data || {
                status: 'error',
                message: 'Failed to pay electricity'
            };
        }
    },
    getTransaction: async (reference)=>{
        try {
            const { data } = await api.post('/transaction', {
                reference
            });
            return data;
        } catch (error) {
            return error.response?.data || {
                status: 'error',
                message: 'Failed to fetch transaction'
            };
        }
    }
};
}),
"[project]/app/api/purchase/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabase.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inlomax$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/inlomax.ts [app-route] (ecmascript)");
;
;
;
async function POST(req) {
    try {
        const { userId, serviceType, amount, mobileNumber, serviceID, network } = await req.json();
        if (!userId || !amount || !mobileNumber || !serviceID) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Missing required fields'
            }, {
                status: 400
            });
        }
        // 1. Check User Balance
        const { data: user, error: userError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabaseAdmin"].from('profiles').select('balance').eq('id', userId).single();
        if (userError || !user) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'User not found'
            }, {
                status: 404
            });
        }
        if (user.balance < amount) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Insufficient balance'
            }, {
                status: 400
            });
        }
        // 2. Call Inlomax API
        let apiResponse;
        if (serviceType === 'AIRTIME') {
            apiResponse = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inlomax$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["inlomax"].purchaseAirtime(mobileNumber, amount, serviceID);
        } else if (serviceType === 'DATA') {
            apiResponse = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$inlomax$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["inlomax"].purchaseData(mobileNumber, serviceID);
        } else {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: 'Invalid service type'
            }, {
                status: 400
            });
        }
        if (apiResponse.status !== 'success') {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: apiResponse.message || 'Provider failed'
            }, {
                status: 502
            });
        }
        // 3. Deduct Balance
        const newBalance = user.balance - Number(amount);
        const { error: updateError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabaseAdmin"].from('profiles').update({
            balance: newBalance
        }).eq('id', userId);
        if (updateError) {
            // Critical: Money wasn't deducted but service given. 
            // In prod, log this heavily.
            console.error('CRITICAL: Failed to deduct balance after successful purchase', userId, amount);
        }
        // 4. Record Transaction
        await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabase$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabaseAdmin"].from('transactions').insert({
            user_id: userId,
            type: 'PURCHASE',
            amount: Number(amount),
            service_type: serviceType,
            status: 'SUCCESS',
            reference: apiResponse.data?.reference || `REF-${Date.now()}`,
            meta: {
                mobile: mobileNumber,
                network: network,
                provider_ref: apiResponse.data?.reference
            }
        });
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: true,
            newBalance,
            message: apiResponse.message
        });
    } catch (err) {
        console.error('Purchase Error:', err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: err.message || 'Internal Server Error'
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__d5ccff93._.js.map