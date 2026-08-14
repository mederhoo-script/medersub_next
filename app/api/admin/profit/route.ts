import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

function toNumber(v: unknown) {
  return Number(v ?? 0) || 0;
}

async function sumProfitBetween(startIso: string, endIso?: string) {
  let query = supabaseAdmin
    .from('transactions')
    .select('amount, charged_amount, meta, created_at')
    .eq('type', 'purchase')
    .eq('status', 'success')
    .gte('created_at', startIso);

  if (endIso) query = query.lt('created_at', endIso);

  const { data, error } = await query;
  if (error) throw error;

  const items = Array.isArray(data) ? data : [];
  const profit = items.reduce((acc: number, tx: any) => {
    const metaProfit = tx?.meta?.profit;
    if (metaProfit !== undefined && metaProfit !== null) return acc + toNumber(metaProfit);
    const charged = toNumber(tx.charged_amount ?? tx.amount);
    const amount = toNumber(tx.amount);
    return acc + (charged - amount);
  }, 0);

  return { profit, count: items.length };
}

async function sumProfitSince(startIso?: string) {
  return sumProfitBetween(startIso ?? '1970-01-01T00:00:00.000Z');
}

async function getLastNDaysProfit(days: number) {
  const result: { label: string; profit: number; count: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - i);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const dayProfit = await sumProfitBetween(start.toISOString(), end.toISOString());
    result.push({
      label: start.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' }),
      profit: dayProfit.profit,
      count: dayProfit.count,
    });
  }

  return result;
}

export async function GET() {
  try {
    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const [week, month, year, all, days] = await Promise.all([
      sumProfitSince(weekStart.toISOString()),
      sumProfitSince(monthStart.toISOString()),
      sumProfitSince(yearStart.toISOString()),
      sumProfitSince(),
      getLastNDaysProfit(7)
    ]);

    return NextResponse.json({ week, month, year, all, days });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
