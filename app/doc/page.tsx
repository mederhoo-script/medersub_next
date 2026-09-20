import CopyButton from '@/components/docs/copy-button';

const baseUrl = 'https://medersub.vercel.app/api/v1';

const endpoints = [
    { method: 'GET', path: '/services', auth: 'Public', title: 'List services', description: 'Returns the current service catalog, including provider-configured data plans and public API selling prices.' },
    { method: 'GET', path: '/balance', auth: 'Required', title: 'Get balance', description: 'Returns the upstream account balance. This endpoint requires your Medersub API key.' },
    { method: 'POST', path: '/airtime', auth: 'Required', title: 'Buy airtime', description: 'Purchase airtime for a mobile number.' },
    { method: 'POST', path: '/data', auth: 'Required', title: 'Buy data', description: 'Purchase a data plan using a serviceID returned by the services endpoint.' },
    { method: 'POST', path: '/validatecable', auth: 'Required', title: 'Validate cable account', description: 'Validate a cable TV IUC number before subscribing.' },
    { method: 'POST', path: '/subcable', auth: 'Required', title: 'Subscribe cable', description: 'Subscribe or renew a cable TV account.' },
    { method: 'POST', path: '/validatemeter', auth: 'Required', title: 'Validate electricity meter', description: 'Validate an electricity meter before payment.' },
    { method: 'POST', path: '/payelectric', auth: 'Required', title: 'Pay electricity', description: 'Pay an electricity meter using a supported serviceID.' },
    { method: 'POST', path: '/education', auth: 'Required', title: 'Buy education PINs', description: 'Purchase one or more education examination PINs.' },
    { method: 'POST', path: '/transaction', auth: 'Required', title: 'Check transaction', description: 'Look up the status of an upstream provider transaction.' },
] as const;

const requestExamples = {
    airtime: `curl -X POST ${baseUrl}/airtime \\\n  -H "Authorization: Token ms_live_your_key" \\\n  -H "Content-Type: application/json" \\\n  -d '{
    "serviceID": "100",
    "amount": 500,
    "mobileNumber": "08012345678",
    "request-id": "your-system-order-1001",
    "network": "MTN"
  }'`,
    data: `curl -X POST ${baseUrl}/data \\\n  -H "Authorization: Token ms_live_your_key" \\\n  -H "Content-Type: application/json" \\\n  -d '{
    "serviceID": "100",
    "mobileNumber": "08012345678",
    "request-id": "your-system-order-1002",
    "network": "MTN"
  }'`,
    services: `curl ${baseUrl}/services`,
};

const responseExample = `{
  "status": "success",
  "message": "Transaction successful",
  "data": {
    "reference": "MS-DATA-1712345678901-ab12cd34"
  }
}`;

function Code({ children }: { children: string }) {
    return <div className="relative"><CopyButton value={children} /><pre className="overflow-x-auto rounded-xl bg-[#10231f] p-4 pr-24 text-[13px] leading-6 text-[#e9fff5]"><code>{children}</code></pre></div>;
}

function Method({ children, kind = 'post' }: { children: string; kind?: 'get' | 'post' }) {
    return <span className={`mr-2 inline-flex rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${kind === 'get' ? 'bg-[#d9f7e8] text-[#087443]' : 'bg-[#fff0d7] text-[#9b5600]'}`}>{children}</span>;
}

export default function DeveloperDocumentationPage() {
    return (
        <main className="min-h-screen bg-[#f5f7f3] text-[#17312a]">
            <header className="border-b border-[#dce7df] bg-[#f5f7f3]/95">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
                    <a href="#top" className="text-xl font-black tracking-[-0.04em] text-[#087443]">MEDERSUB<span className="text-[#f18a24]">.</span>API</a>
                    <div className="flex items-center gap-3 text-sm font-semibold">
                        <span className="hidden rounded-full border border-[#bfe4ce] bg-[#e9f8ef] px-3 py-1.5 text-[#087443] sm:inline-flex">Current API: v1</span>
                        <a href="/dashboard" className="rounded-lg bg-[#087443] px-3 py-2 text-white transition hover:bg-[#075e37]">Dashboard</a>
                    </div>
                </div>
            </header>

            <section id="top" className="mx-auto max-w-7xl px-5 pb-14 pt-14 lg:px-8 lg:pt-20">
                <div className="max-w-4xl">
                    <p className="mb-5 text-sm font-bold uppercase tracking-[0.2em] text-[#d97706]">Developer documentation</p>
                    <h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.05em] text-[#14372d] sm:text-6xl">Build reliable Nigerian VTU payments.</h1>
                    <p className="mt-6 max-w-2xl text-lg leading-8 text-[#597068]">One authenticated API for airtime, data, cable TV, electricity, education PINs, service discovery, and transaction lookups.</p>
                    <div className="mt-8 flex flex-wrap gap-3">
                        <a href="#quickstart" className="rounded-lg bg-[#087443] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#075e37]">Start integrating</a>
                        <a href="#endpoints" className="rounded-lg border border-[#b9cbc0] bg-white px-5 py-3 text-sm font-bold text-[#24483c] transition hover:border-[#087443]">Browse endpoints</a>
                    </div>
                </div>
            </section>

            <div className="mx-auto grid max-w-7xl gap-10 px-5 pb-24 lg:grid-cols-[210px_minmax(0,1fr)] lg:px-8">
                <aside className="hidden lg:block">
                    <nav className="sticky top-6 space-y-2 text-sm">
                        {['Quickstart', 'Authentication', 'Services', 'Endpoints', 'Requests', 'Responses', 'Errors', 'Production checklist'].map((item) => <a key={item} href={`#${item.toLowerCase().replaceAll(' ', '-')}`} className="block rounded-md px-3 py-2 text-[#597068] hover:bg-white hover:text-[#087443]">{item}</a>)}
                    </nav>
                </aside>

                <div className="min-w-0 space-y-16">
                    <section id="quickstart" className="scroll-mt-6">
                        <div className="mb-6">
                            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#d97706]">01 / Quickstart</p>
                            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">Make your first request</h2>
                            <p className="mt-3 max-w-2xl leading-7 text-[#597068]">Use the service catalog first. Never hard-code service IDs: administrators can route a network to a different provider and the catalog may change.</p>
                        </div>
                        <Code>{requestExamples.services}</Code>
                        <div className="mt-5 grid gap-4 sm:grid-cols-3">
                            {[['1', 'Get services', 'Discover current IDs and prices.'], ['2', 'Choose an ID', 'Store the exact serviceID for the product.'], ['3', 'Send a purchase', 'Use a unique request-id for retries.']].map(([number, title, text]) => <div key={number} className="rounded-xl border border-[#dce7df] bg-white p-5"><span className="text-2xl font-black text-[#f18a24]">{number}</span><h3 className="mt-3 font-bold">{title}</h3><p className="mt-1 text-sm leading-6 text-[#667b72]">{text}</p></div>)}
                        </div>
                    </section>

                    <section id="authentication" className="scroll-mt-6">
                        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#d97706]">02 / Authentication</p>
                        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">One key, two header formats</h2>
                        <p className="mt-3 max-w-3xl leading-7 text-[#597068]">Generate or rotate a Medersub API key from Account Settings. Keep it on your server. The services endpoint is public; every other v1 endpoint requires authentication.</p>
                        <div className="mt-6 grid gap-5 md:grid-cols-2">
                            <div className="rounded-xl border border-[#dce7df] bg-white p-5"><h3 className="font-bold">Recommended</h3><Code>{`Authorization: Token ms_live_your_key`}</Code></div>
                            <div className="rounded-xl border border-[#dce7df] bg-white p-5"><h3 className="font-bold">Also accepted</h3><Code>{`Authorization: Bearer ms_live_your_key\n\nx-api-key: ms_live_your_key`}</Code></div>
                        </div>
                        <p className="mt-4 text-sm text-[#667b72]">Do not put your key in browser JavaScript, mobile app bundles, public repositories, or client-side logs.</p>
                    </section>

                    <section id="services" className="scroll-mt-6">
                        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#d97706]">03 / Service discovery</p>
                        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">Always discover before buying</h2>
                        <div className="mt-6 rounded-xl border border-[#bfe4ce] bg-[#eaf8ef] p-5"><p className="font-bold text-[#087443]">GET {baseUrl}/services is public</p><p className="mt-2 text-sm leading-6 text-[#3e6555]">It returns the provider-aware catalog. Data plans and prices reflect the administrator&apos;s current provider routing and public API profit settings. Use the returned serviceID exactly as provided.</p></div>
                        <div className="mt-5"><Code>{requestExamples.services}</Code></div>
                        <div className="mt-5 overflow-x-auto rounded-xl border border-[#dce7df] bg-white"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-[#dce7df] bg-[#f8fbf8] text-[#597068]"><tr><th className="px-4 py-3 font-bold">Field</th><th className="px-4 py-3 font-bold">Meaning</th></tr></thead><tbody className="divide-y divide-[#edf2ee]"><tr><td className="px-4 py-3 font-mono text-[#087443]">data.dataPlans</td><td className="px-4 py-3 text-[#597068]">Available data products with serviceID, network, dataPlan, amount, validity, and dataType.</td></tr><tr><td className="px-4 py-3 font-mono text-[#087443]">data.education</td><td className="px-4 py-3 text-[#597068]">Education PIN products when supplied by the upstream catalog.</td></tr><tr><td className="px-4 py-3 font-mono text-[#087443]">data.providerConfig</td><td className="px-4 py-3 text-[#597068]">Current provider routing metadata. Treat it as informational and do not hard-code it.</td></tr></tbody></table></div>
                    </section>

                    <section id="endpoints" className="scroll-mt-6">
                        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#d97706]">04 / Endpoint reference</p>
                        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">Everything available in v1</h2>
                        <div className="mt-6 space-y-3">{endpoints.map((endpoint) => <article key={`${endpoint.method}-${endpoint.path}`} className="rounded-xl border border-[#dce7df] bg-white p-5"><div className="flex flex-wrap items-center gap-2"><Method kind={endpoint.method === 'GET' ? 'get' : 'post'}>{endpoint.method}</Method><code className="font-semibold text-[#24483c]">{endpoint.path}</code><span className="ml-auto text-xs font-bold uppercase tracking-wider text-[#82958b]">{endpoint.auth} auth</span></div><h3 className="mt-4 text-lg font-bold">{endpoint.title}</h3><p className="mt-1 text-sm leading-6 text-[#667b72]">{endpoint.description}</p></article>)}</div>
                    </section>

                    <section id="requests" className="scroll-mt-6">
                        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#d97706]">05 / Requests</p>
                        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">Purchase examples</h2>
                        <div className="mt-6 space-y-6"><div><h3 className="mb-3 font-bold">Airtime</h3><Code>{requestExamples.airtime}</Code></div><div><h3 className="mb-3 font-bold">Data</h3><Code>{requestExamples.data}</Code></div></div>
                        <div className="mt-6 overflow-x-auto rounded-xl border border-[#dce7df] bg-white"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b border-[#dce7df] bg-[#f8fbf8] text-[#597068]"><tr><th className="px-4 py-3">Endpoint</th><th className="px-4 py-3">Required body fields</th><th className="px-4 py-3">Optional</th></tr></thead><tbody className="divide-y divide-[#edf2ee] text-[#597068]"><tr><td className="px-4 py-3 font-mono">airtime</td><td className="px-4 py-3">serviceID, amount, mobileNumber</td><td className="px-4 py-3">network, request-id</td></tr><tr><td className="px-4 py-3 font-mono">data</td><td className="px-4 py-3">serviceID, mobileNumber</td><td className="px-4 py-3">network, request-id</td></tr><tr><td className="px-4 py-3 font-mono">validatecable</td><td className="px-4 py-3">serviceID, iucNum</td><td className="px-4 py-3">None</td></tr><tr><td className="px-4 py-3 font-mono">subcable</td><td className="px-4 py-3">serviceID, iucNum</td><td className="px-4 py-3">request-id</td></tr><tr><td className="px-4 py-3 font-mono">validatemeter</td><td className="px-4 py-3">serviceID, meterNum, meterType</td><td className="px-4 py-3">None</td></tr><tr><td className="px-4 py-3 font-mono">payelectric</td><td className="px-4 py-3">serviceID, meterNum, meterType, amount</td><td className="px-4 py-3">request-id</td></tr><tr><td className="px-4 py-3 font-mono">education</td><td className="px-4 py-3">serviceID, quantity</td><td className="px-4 py-3">request-id</td></tr><tr><td className="px-4 py-3 font-mono">transaction</td><td className="px-4 py-3">reference</td><td className="px-4 py-3">None</td></tr></tbody></table></div>
                        <p className="mt-5 rounded-xl border border-[#bfe4ce] bg-[#eaf8ef] p-4 text-sm leading-6 text-[#3e6555]"><strong>Provider routing:</strong> Send <code>network</code> for airtime and data when possible. The server uses the admin&apos;s configured route and never trusts a client-supplied provider name. Data service IDs are checked against the current catalog. If a route is ambiguous, the API rejects the request instead of selecting the wrong provider.</p>
                        <p className="mt-5 rounded-xl border border-[#f2d7a6] bg-[#fff7e8] p-4 text-sm leading-6 text-[#7c5a26]"><strong>request-id:</strong> Use a unique, stable identifier from your system. Reuse the same value when retrying the same order. If omitted, Medersub generates one, but your integration cannot safely correlate retries.</p>
                    </section>

                    <section id="responses" className="scroll-mt-6">
                        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#d97706]">06 / Responses</p>
                        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">Predictable response envelope</h2>
                        <p className="mt-3 leading-7 text-[#597068]">Provider responses preserve the familiar <code>status</code>, <code>message</code>, and <code>data</code> shape. Treat <code>status</code> as the business result and the HTTP status as the transport result.</p>
                        <div className="mt-5"><Code>{responseExample}</Code></div>
                        <div className="mt-5 grid gap-4 sm:grid-cols-3"><div className="rounded-xl border border-[#bfe4ce] bg-[#eaf8ef] p-4"><p className="font-mono font-bold text-[#087443]">success</p><p className="mt-2 text-sm text-[#3e6555]">Request completed. HTTP 200.</p></div><div className="rounded-xl border border-[#f2d7a6] bg-[#fff7e8] p-4"><p className="font-mono font-bold text-[#9b5600]">processing</p><p className="mt-2 text-sm text-[#765b2d]">Provider accepted the request for processing.</p></div><div className="rounded-xl border border-[#f1c9c9] bg-[#fff0f0] p-4"><p className="font-mono font-bold text-[#b42318]">failed</p><p className="mt-2 text-sm text-[#81504d]">Request was rejected or could not be completed.</p></div></div>
                    </section>

                    <section id="errors" className="scroll-mt-6">
                        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#d97706]">07 / Errors</p>
                        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">Handle failures safely</h2>
                        <div className="mt-6 overflow-x-auto rounded-xl border border-[#dce7df] bg-white"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b border-[#dce7df] bg-[#f8fbf8] text-[#597068]"><tr><th className="px-4 py-3">HTTP</th><th className="px-4 py-3">Meaning</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-[#edf2ee] text-[#597068]"><tr><td className="px-4 py-3 font-mono">200</td><td className="px-4 py-3">Successful provider response</td><td className="px-4 py-3">Read the response status and data.</td></tr><tr><td className="px-4 py-3 font-mono">400</td><td className="px-4 py-3">Invalid input or provider failure</td><td className="px-4 py-3">Show message; do not blindly retry.</td></tr><tr><td className="px-4 py-3 font-mono">401</td><td className="px-4 py-3">Missing or invalid API key</td><td className="px-4 py-3">Check server-side credentials.</td></tr><tr><td className="px-4 py-3 font-mono">404</td><td className="px-4 py-3">Unknown endpoint</td><td className="px-4 py-3">Check the path and API version.</td></tr></tbody></table></div>
                        <p className="mt-5 leading-7 text-[#597068]">For a timeout after a purchase request, do not create a second order immediately. Query the provider transaction reference where available, or retry with the same <code>request-id</code>.</p>
                    </section>

                    <section id="production-checklist" className="scroll-mt-6 rounded-2xl bg-[#14372d] p-7 text-[#e9fff5] sm:p-9">
                        <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#f8b45e]">08 / Production checklist</p>
                        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">Before you go live</h2>
                        <ul className="mt-6 grid gap-3 text-sm leading-6 text-[#c6dfd3] sm:grid-cols-2"><li>Use a server-side proxy for every authenticated request.</li><li>Load service IDs from GET /services at runtime.</li><li>Keep request-id stable across retries.</li><li>Log references, not API keys or PINs.</li><li>Handle success, processing, and failed statuses.</li><li>Set sensible timeouts and exponential backoff.</li></ul>
                        <div className="mt-8 border-t border-white/15 pt-6"><p className="font-bold text-white">Version note</p><p className="mt-2 text-sm leading-6 text-[#c6dfd3]">This workspace currently implements <code>/api/v1</code>. No `/api/v2` route exists in the deployed codebase yet. This documentation intentionally describes the live v1 contract rather than inventing a v2 contract.</p></div>
                    </section>
                </div>
            </div>
        </main>
    );
}
