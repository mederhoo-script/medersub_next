const endpoints = [
  ['GET', '/api/v1/services', 'Returns Inlomax service IDs and Medersub selling prices.'],
  ['GET', '/api/v1/balance', 'Returns the Medersub account’s upstream Inlomax balance.'],
  ['POST', '/api/v1/airtime', 'Buy airtime: serviceID, amount, mobileNumber, request-id.'],
  ['POST', '/api/v1/data', 'Buy data: serviceID, mobileNumber, request-id.'],
  ['POST', '/api/v1/validatecable', 'Validate cable: serviceID, iucNum.'],
  ['POST', '/api/v1/subcable', 'Buy cable: serviceID, iucNum, request-id.'],
  ['POST', '/api/v1/validatemeter', 'Validate electricity meter: serviceID, meterNum, meterType.'],
  ['POST', '/api/v1/payelectric', 'Pay electricity: serviceID, meterNum, meterType, amount, request-id.'],
  ['POST', '/api/v1/education', 'Buy education pins: serviceID, quantity, request-id.'],
  ['POST', '/api/v1/transaction', 'Look up a transaction: reference.'],
] as const;

const examples: Record<string, string> = {
  airtime: '{\n  "serviceID": "100",\n  "amount": 200,\n  "mobileNumber": "0903837261",\n  "request-id": "MY-APP-ORDER-123"\n}',
  data: '{\n  "serviceID": "100",\n  "mobileNumber": "0903837261",\n  "request-id": "MY-APP-ORDER-123"\n}',
  validatecable: '{\n  "serviceID": "1",\n  "iucNum": "7027914329"\n}',
  subcable: '{\n  "serviceID": "1",\n  "iucNum": "7027914329",\n  "request-id": "MY-APP-ORDER-123"\n}',
  validatemeter: '{\n  "serviceID": "1",\n  "meterNum": "7027914329",\n  "meterType": 1\n}',
  payelectric: '{\n  "serviceID": "1",\n  "meterNum": "07364853244533",\n  "meterType": 1,\n  "amount": 1000,\n  "request-id": "MY-APP-ORDER-123"\n}',
  education: '{\n  "serviceID": "1",\n  "quantity": 3,\n  "request-id": "MY-APP-ORDER-123"\n}',
  transaction: '{\n  "reference": "INL|NQJK56QVZVHHX34RJ5XTMDXLG"\n}',
};

export default function ApiDocumentationPage() {
  return <main className="mx-auto max-w-5xl px-6 py-14 text-slate-900">
    <h1 className="text-4xl font-bold">Medersub API v1</h1>
    <p className="mt-4 text-lg text-slate-600">A thin, Inlomax-compatible VTU API. Switch the base URL and use your Medersub key—your Inlomax key is never exposed.</p>
    <section className="mt-10 rounded-xl border bg-slate-50 p-6">
      <h2 className="text-2xl font-semibold">Getting started</h2>
      <p className="mt-3">Base URL: <code className="rounded bg-white px-2 py-1">https://your-domain.com/api/v1</code></p>
      <p className="mt-3">The <code>/api/v1/services</code> endpoint is public. Authenticate every other request with <code className="rounded bg-white px-2 py-1">Authorization: Token YOUR_MEDERSUB_API_KEY</code>. Check or rotate your key in Account Settings, or while signed in call <code className="rounded bg-white px-2 py-1">POST /api/account/api-key</code>; save the returned <code>ms_live_…</code> key because it is shown only once.</p>
      <p className="mt-3">For purchases, send a unique <code>request-id</code>. It is forwarded unchanged to Inlomax, enabling safe retries. If omitted, Medersub creates one.</p>
    </section>
    <section className="mt-10">
      <h2 className="text-2xl font-semibold">Endpoints</h2>
      <div className="mt-4 space-y-3">{endpoints.map(([method, path, description]) => <article key={path} className="rounded-xl border p-5">
        <h3 className="font-mono font-semibold"><span className={method === 'GET' ? 'text-emerald-700' : 'text-blue-700'}>{method}</span> {path}</h3>
        <p className="mt-2 text-slate-600">{description}</p>
        {examples[path.split('/').pop() || ''] && <><p className="mt-4 text-sm font-medium">Request body</p><pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-4 text-sm text-slate-100">{examples[path.split('/').pop() || '']}</pre></>}
        <p className="mt-4 text-sm text-slate-600">All responses preserve the Inlomax <code>status</code>, <code>message</code>, and <code>data</code> structure. For example: <code>{'{ "status": "success", "message": "…", "data": {} }'}</code>.</p>
      </article>)}</div>
    </section>
    <section className="mt-10 rounded-xl border border-amber-200 bg-amber-50 p-6"><h2 className="text-xl font-semibold">Pricing</h2><p className="mt-2">Service-plan <code>amount</code> values include the configurable Medersub public markup. Inlomax service IDs and purchase request fields remain unchanged so provider transactions use the documented upstream format.</p></section>
  </main>;
}
