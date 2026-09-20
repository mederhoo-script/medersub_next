'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, ExternalLink, X } from 'lucide-react';

export default function AnnouncementPopup() {
    const [announcement, setAnnouncement] = useState<{
        enabled: boolean;
        title: string;
        message: string;
        actionLabel: string;
        actionUrl: string;
        version: string;
        displayMode: 'once' | 'every_visit';
        targetPath: string;
    } | null>(null);
    const [visible, setVisible] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        setVisible(false);
        fetch(`/api/announcement?path=${encodeURIComponent(pathname)}`)
            .then((response) => response.ok ? response.json() : null)
            .then((data) => {
                if (!data?.enabled || !data.title || !data.message) return;
                const dismissedKey = `medersub-announcement-version:${data.targetPath || 'all'}`;
                const dismissedVersion = window.localStorage.getItem(dismissedKey);
                if (data.displayMode === 'every_visit' || dismissedVersion !== data.version) {
                    setAnnouncement(data);
                    setVisible(true);
                }
            })
            .catch(() => undefined);
    }, [pathname]);

    const dismiss = () => {
        if (announcement?.displayMode === 'once') {
            const dismissedKey = `medersub-announcement-version:${announcement.targetPath || 'all'}`;
            window.localStorage.setItem(dismissedKey, announcement.version);
        }
        setVisible(false);
    };

    if (!visible || !announcement) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="announcement-title">
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
                <div className="flex items-start justify-between bg-gradient-to-br from-blue-600 to-blue-700 px-6 py-5 text-white">
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15"><Bell className="h-5 w-5" /></span>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">Important update</p>
                            <h2 id="announcement-title" className="mt-1 text-xl font-bold">{announcement.title}</h2>
                        </div>
                    </div>
                    <button type="button" onClick={dismiss} className="rounded-lg p-2 text-blue-100 transition hover:bg-white/15 hover:text-white" aria-label="Close announcement"><X className="h-5 w-5" /></button>
                </div>
                <div className="px-6 py-6">
                    <p className="whitespace-pre-line text-[15px] leading-7 text-slate-600">{announcement.message}</p>
                    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <button type="button" onClick={dismiss} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Dismiss</button>
                        {announcement.actionLabel && announcement.actionUrl && (
                            <a href={announcement.actionUrl} onClick={dismiss} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">{announcement.actionLabel}<ExternalLink className="h-4 w-4" /></a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
