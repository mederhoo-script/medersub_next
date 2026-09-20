import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { data, error } = await supabaseAdmin
        .from('system_settings')
        .select('value')
        .eq('key', 'general')
        .maybeSingle();

    if (error) return NextResponse.json({ enabled: false }, { status: 200 });

    const general = data?.value && typeof data.value === 'object' ? data.value as Record<string, unknown> : {};
    const announcement = general.announcement && typeof general.announcement === 'object'
        ? general.announcement as Record<string, unknown>
        : {};
    const targetPath = typeof announcement.targetPath === 'string' ? announcement.targetPath.trim() : '';
    const pathname = new URL(request.url).searchParams.get('path') || '';
    const pathMatches = !targetPath || pathname === targetPath;

    return NextResponse.json({
        enabled: announcement.enabled === true && pathMatches,
        title: typeof announcement.title === 'string' ? announcement.title.trim() : '',
        message: typeof announcement.message === 'string' ? announcement.message.trim() : '',
        actionLabel: typeof announcement.actionLabel === 'string' ? announcement.actionLabel.trim() : '',
        actionUrl: typeof announcement.actionUrl === 'string' ? announcement.actionUrl.trim() : '',
        version: typeof announcement.version === 'string' ? announcement.version.trim() : '1',
        displayMode: announcement.displayMode === 'every_visit' ? 'every_visit' : 'once',
        targetPath,
    });
}
