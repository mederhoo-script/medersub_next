import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
// Force rebuild
import { supabaseAdmin } from '@/lib/supabase-admin';
import { inlomax } from '@/lib/inlomax';
import { calculateDataProfit } from '@/utils/pricing';
import { getRewardSpendEligibility } from '@/lib/rewards';
import { TRANSACTION_PIN_PATTERN, verifyTransactionPin } from '@/lib/transaction-pin';

type SystemSettingRow = { key: string; value: unknown };


async function getAuthenticatedUserId() {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
                },
            },
        }
    );

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user.id;
}

function jsonError(message: string, status: number, extra: Record<string, unknown> = {}) {
    return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

function jsonSuccess(payload: Record<string, unknown>) {
    return NextResponse.json({ ok: true, ...payload });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { userId, serviceType, amount, mobileNumber, serviceID, network, planName, meterType, quantity, paymentSource, transactionPin, biometricToken } = body;
        const selectedPaymentSource = paymentSource === 'reward' ? 'reward' : 'wallet';
        const authenticatedUserId = await getAuthenticatedUserId();

        if (!authenticatedUserId) {
            return jsonError('Unauthorized', 401);
        }

        if (authenticatedUserId !== userId) {
            return jsonError('You can only make purchases from your own account.', 403);
        }

        console.log('Purchase Request:', { userId, serviceType, amount, mobileNumber, planName });

        // Validate required fields (mobileNumber not required for EDUCATION)
        if (!userId || !amount || !serviceID) {
            return jsonError('Missing required fields', 400);
        }

        if (serviceType !== 'EDUCATION' && !mobileNumber) {
            return jsonError('Mobile number is required', 400);
        }

        const hasBiometricToken = typeof biometricToken === 'string' && biometricToken.trim().length > 0;
        if (!hasBiometricToken && !TRANSACTION_PIN_PATTERN.test(transactionPin || '')) {
            return jsonError('Enter your 4-digit transaction PIN or approve with biometrics.', 400);
        }

        if (hasBiometricToken) {
            const { data: approval, error: approvalError } = await supabaseAdmin
                .from('transaction_biometric_approvals')
                .select('token, expires_at, consumed_at')
                .eq('token', biometricToken)
                .eq('user_id', userId)
                .maybeSingle();

            if (approvalError || !approval) {
                return jsonError('Invalid biometric approval.', 401);
            }

            if (approval.consumed_at || new Date(approval.expires_at) < new Date()) {
                return jsonError('Biometric approval has expired or already been used.', 401);
            }

            await supabaseAdmin
                .from('transaction_biometric_approvals')
                .update({ consumed_at: new Date().toISOString() })
                .eq('token', biometricToken);
        } else {
            const { data: pinProfile, error: pinProfileError } = await supabaseAdmin
                .from('profiles')
                .select('transaction_pin_hash, transaction_pin_changed')
                .eq('id', userId)
                .single();

            if (pinProfileError || !pinProfile) {
                return jsonError('User profile not found.', 404);
            }

            if (!pinProfile.transaction_pin_hash) {
                return jsonError('Set up your transaction PIN in Account Settings before making purchases.', 403);
            }

            if (!pinProfile.transaction_pin_changed) {
                return jsonError('Change your default transaction PIN in Account Settings before making purchases.', 403);
            }

            if (!verifyTransactionPin(transactionPin, pinProfile.transaction_pin_hash)) {
                return jsonError('Invalid transaction PIN.', 401);
            }
        }

        // 0. Check for Maintenance Mode & Markup
        const { data: settings } = await supabaseAdmin.from('system_settings').select('*');
        const config = (settings as SystemSettingRow[] | null)?.reduce<Record<string, unknown>>((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {}) || {};

        const generalConfig = (config.general as { maintenance?: boolean; markup?: number | string } | undefined) || {};

        if (generalConfig.maintenance) {
            return jsonError('System is currently under maintenance. Please try again later.', 503);
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

        // 1. Check User Balance based on selected payment source
        let currentBalance = 0;
        if (selectedPaymentSource === 'reward') {
            const { data: profile, error: profileError } = await supabaseAdmin
                .from('profiles')
                .select('reward_balance_ngn,telegram_id,reward_ads_watched,reward_referrals_count')
                .eq('id', userId)
                .single();

            if (profileError || !profile) {
                return jsonError('User profile not found.', 404);
            }

            const rewardSpendEligibility = getRewardSpendEligibility({
                telegramId: (profile.telegram_id as string) || null,
                rewardAdsWatched: Number(profile.reward_ads_watched || 0),
                rewardReferralsCount: Number(profile.reward_referrals_count || 0),
            });

            if (!rewardSpendEligibility.canSpendRewards) {
                const remainingRequirements = [
                    rewardSpendEligibility.remainingAdsToWatch > 0
                        ? `watch ${rewardSpendEligibility.remainingAdsToWatch} more ${rewardSpendEligibility.remainingAdsToWatch === 1 ? 'ad' : 'ads'}`
                        : '',
                    rewardSpendEligibility.remainingReferrals > 0
                        ? `refer ${rewardSpendEligibility.remainingReferrals} more ${rewardSpendEligibility.remainingReferrals === 1 ? 'user' : 'users'}`
                        : '',
                ].filter(Boolean);
                const requirementMessage = remainingRequirements.length > 0
                    ? `${remainingRequirements.join(' and ')} first.`
                    : 'Complete your Telegram reward stage requirements first.';
                return jsonError(`Telegram reward spend locked. ${requirementMessage}`, 400, { stage: rewardSpendEligibility });
            }

            if (profile.telegram_id) {
                const { data: fundingTransactions, error: fundingError } = await supabaseAdmin
                    .from('transactions')
                    .select('charged_amount')
                    .eq('user_id', userId)
                    .eq('type', 'deposit')
                    .eq('status', 'success');

                if (fundingError) {
                    console.error('Failed to load funding transactions for reward spend cap:', fundingError);
                    return jsonError('Unable to verify reward spend cap. Please try again.', 500);
                }

                const { data: rewardSpendTransactions, error: rewardSpendTxError } = await supabaseAdmin
                    .from('reward_transactions')
                    .select('amount_ngn')
                    .eq('user_id', userId)
                    .eq('type', 'spend_on_vtu')
                    .lt('amount_ngn', 0);

                if (rewardSpendTxError) {
                    console.error('Failed to load reward spend transactions for cap check:', rewardSpendTxError);
                    return jsonError('Unable to verify reward spend cap. Please try again.', 500);
                }

                const totalWalletFunding = (fundingTransactions || []).reduce((sum, tx) => sum + Number(tx.charged_amount || 0), 0);
                const totalRewardSpent = (rewardSpendTransactions || []).reduce((sum, tx) => sum + Math.abs(Number(tx.amount_ngn || 0)), 0);
                const unlockedRewardSpend = Math.floor(totalWalletFunding / 500) * 300;
                const projectedRewardSpend = totalRewardSpent + totalCharge;

                if (projectedRewardSpend > unlockedRewardSpend) {
                    const nextUnlockedTier = Math.ceil(projectedRewardSpend / 300);
                    const requiredFundingForProjectedSpend = nextUnlockedTier * 500;
                    const additionalFundingNeeded = Math.max(0, requiredFundingForProjectedSpend - totalWalletFunding);
                    return jsonError(`Reward spend limit reached. You've unlocked ₦${unlockedRewardSpend.toLocaleString()} reward spend from ₦${totalWalletFunding.toLocaleString()} wallet funding. Fund ₦${additionalFundingNeeded.toLocaleString()} more in main wallet to continue.`, 400);
                }
            }

            currentBalance = Number(profile.reward_balance_ngn || 0);
        } else {
            const { data: wallet, error: walletError } = await supabaseAdmin
                .from('wallets')
                .select('balance')
                .eq('user_id', userId)
                .single();

            if (walletError || !wallet) {
                return jsonError('User wallet not found.', 404);
            }
            currentBalance = Number(wallet.balance);
        }

        if (currentBalance < totalCharge) {
            return jsonError(`Insufficient ${selectedPaymentSource} balance. Required: ₦${totalCharge}`, 400);
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
            return jsonError('Invalid service type', 400);
        }

        if (apiResponse.status !== 'success') {
            console.error('Provider API Failed:', apiResponse); // Log full response
            let errorMsg = apiResponse.message || 'Provider failed';
            const lowerMsg = errorMsg.toLowerCase();
            // Masking provider empty wallet error
            if (lowerMsg.includes('insufficient funds') || lowerMsg.includes('insuffucient funds')) {
                errorMsg = 'Service temporarily unavailable. Please try again later.';
            }
            return jsonError(errorMsg, 502, { debug: apiResponse });
        }

        // 3. Deduct Total Charge from selected balance
        let newBalance = currentBalance - totalCharge;
        let balanceUpdateError: { message?: string } | null = null;
        if (selectedPaymentSource === 'reward') {
            const { data: rewardSpendBalance, error: rewardSpendError } = await supabaseAdmin.rpc('spend_reward_on_vtu', {
                p_user_id: userId,
                p_amount: totalCharge,
                p_meta: {
                    service_type: serviceType,
                    service_id: serviceID,
                    provider_ref: apiResponse.data?.reference || null,
                    payment_source: 'reward',
                }
            });
            if (rewardSpendError) {
                balanceUpdateError = rewardSpendError;
            } else {
                // `spend_reward_on_vtu` returns a numeric scalar balance.
                const rpcBalance = rewardSpendBalance as number | null;
                if (typeof rpcBalance === 'number' && Number.isFinite(rpcBalance)) {
                    newBalance = rpcBalance;
                } else {
                    throw new Error(`Reward spend RPC returned invalid balance. Expected numeric value but got: ${String(rewardSpendBalance)}. Check reward RPC deployment and response format.`);
                }
            }
        } else {
            const walletUpdate = await supabaseAdmin
                .from('wallets')
                .update({ balance: newBalance })
                .eq('user_id', userId);
            balanceUpdateError = walletUpdate.error;
        }

        if (balanceUpdateError) {
            console.error('CRITICAL: Failed to deduct balance', userId, totalCharge, balanceUpdateError);
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
                payment_source: selectedPaymentSource,
                provider_ref: apiResponse.data?.reference,
                markup_applied: markupToApply,
                profit: markupToApply,
                ...(serviceType === 'EDUCATION' && apiResponse.data?.pins ? { pins: apiResponse.data.pins } : {})
            }
        });

        return jsonSuccess({
            success: true,
            newBalance,
            message: apiResponse.message,
            ...(serviceType === 'EDUCATION' && apiResponse.data?.pins ? { pins: apiResponse.data.pins } : {})
        });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Internal Server Error';
        console.error('Purchase API Exception:', err);
        return jsonError(message, 500);
    }
}
