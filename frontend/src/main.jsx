import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ClipboardList, Database, LayoutDashboard, Plus, RefreshCw, Search, Trash2, UserRound, X } from 'lucide-react'
import './styles.css'
import './customer.css'
import './portal.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Request failed')
  return data
}

const today = new Date().toISOString().slice(0, 10)
const resourceConfig = [
  ['parties', 'Party', 'name'],
  ['gsm', 'GSM', 'value'],
  ['paper-types', 'Paper type', 'name'],
  ['counters', 'Counter', 'value'],
  ['sizes', 'Size', 'name'],
  ['printing-sides', 'Printing side', 'name'],
  ['quantities', 'Quantity', 'value'],
]

function Select({ label, value, onChange, options, valueKey = 'id', labelKey = 'name', required = false }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} required={required}>
    <option value="">Select {label.toLowerCase()}</option>
    {options.map((option) => <option key={option[valueKey]} value={option[valueKey]}>{option[labelKey] ?? option.value}</option>)}
  </select></label>
}

function JobForm({ catalog, editing, onSaved, onCancel }) {
  const [form, setForm] = useState(editing || { date: today, partyOptionId: '', gsmOptionId: '', paperTypeId: '', counterOptionId: '', sizeId: '', printingSideId: '', quantityOptionId: '', jobDetails: '' })
  const [message, setMessage] = useState('')
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const quoteRule = useMemo(() => catalog.priceRules?.find((rule) => rule.paperTypeId === form.paperTypeId && rule.sizeId === form.sizeId && rule.printingSideId === form.printingSideId && rule.quantityId === form.quantityOptionId), [catalog, form])
  async function submit(event) {
    event.preventDefault(); setMessage('')
    try {
      await request(editing ? `/api/jobs/${editing.id}` : '/api/jobs', { method: editing ? 'PUT' : 'POST', body: form })
      setMessage(editing ? 'Job updated.' : 'Job saved.')
      onSaved()
    } catch (error) { setMessage(error.message) }
  }
  return <form className="panel form-panel" onSubmit={submit}>
    <div className="panel-heading"><div><p className="eyebrow">Production entry</p><h2>{editing ? 'Edit job record' : 'Create a job record'}</h2></div>{editing && <button className="icon-button" type="button" onClick={onCancel} title="Cancel edit"><X size={18} /></button>}</div>
    <div className="form-grid">
      <label className="field"><span>Date</span><input type="date" value={form.date?.slice(0, 10) || ''} onChange={(event) => set('date', event.target.value)} required /></label>
      <Select label="Party" value={form.partyOptionId} onChange={(value) => set('partyOptionId', value)} options={catalog.parties} required />
      <Select label="GSM" value={form.gsmOptionId} onChange={(value) => set('gsmOptionId', value)} options={catalog.gsm} labelKey="label" required />
      <Select label="Paper type" value={form.paperTypeId} onChange={(value) => set('paperTypeId', value)} options={catalog['paper-types']} required />
      <Select label="Counter" value={form.counterOptionId} onChange={(value) => set('counterOptionId', value)} options={catalog.counters} labelKey="label" required />
      <Select label="Size" value={form.sizeId} onChange={(value) => set('sizeId', value)} options={catalog.sizes} />
      <Select label="Printing side" value={form.printingSideId} onChange={(value) => set('printingSideId', value)} options={catalog['printing-sides']} />
      <Select label="Quantity" value={form.quantityOptionId} onChange={(value) => set('quantityOptionId', value)} options={catalog.quantities} labelKey="label" required />
      <label className="field field-wide"><span>Job details</span><input value={form.jobDetails} onChange={(event) => set('jobDetails', event.target.value)} placeholder="JOB NO. 12001 / FRONT" required /></label>
    </div>
    <div className="form-footer"><div className="quote">{quoteRule ? <><span>Configured rate</span><strong>Rs. {Number(quoteRule.amount).toLocaleString('en-IN')}</strong></> : <span>No rate configured for this combination</span>}</div><div className="actions"><button className="button secondary" type="button" onClick={onCancel}>Clear</button><button className="button primary" type="submit">{editing ? 'Update job' : 'Save job'}</button></div></div>
    {message && <p className="form-message">{message}</p>}
  </form>
}

function JobsView({ catalog, refreshCatalog }) {
  const [jobs, setJobs] = useState([]); const [editing, setEditing] = useState(null); const [search, setSearch] = useState(''); const [loading, setLoading] = useState(true)
  async function load() { setLoading(true); const data = await request(`/api/jobs?limit=100&search=${encodeURIComponent(search)}`); setJobs(data.data); setLoading(false) }
  useEffect(() => { load().catch(() => setLoading(false)) }, [search])
  async function remove(id) { if (!window.confirm('Delete this job record?')) return; await request(`/api/jobs/${id}`, { method: 'DELETE' }); load() }
  return <>
    <JobForm catalog={catalog} editing={editing} onSaved={() => { setEditing(null); load(); refreshCatalog() }} onCancel={() => setEditing(null)} />
    <section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">Live register</p><h2>Job records</h2></div><div className="search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search party, paper, job..." /></div></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Party</th><th>GSM</th><th>Paper</th><th>Qty</th><th>Counter</th><th>Job details</th><th></th></tr></thead><tbody>{loading ? <tr><td colSpan="8" className="empty">Loading records...</td></tr> : jobs.length === 0 ? <tr><td colSpan="8" className="empty">No jobs found.</td></tr> : jobs.map((job) => <tr key={job.id}><td>{new Date(job.date).toLocaleDateString('en-IN')}</td><td>{job.partyName}</td><td>{job.gsm}</td><td>{job.paperType}</td><td>{job.quantity.toLocaleString('en-IN')}</td><td>{job.counter.toLocaleString('en-IN')}</td><td>{job.jobDetails}</td><td><div className="row-actions"><button className="text-button" onClick={() => setEditing(job)}>Edit</button><button className="danger-button" onClick={() => remove(job.id)} title="Delete"><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div></section>
  </>
}

function CustomerPanel() {
  const [jobs, setJobs] = useState([])
  const [party, setParty] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (party.trim()) params.set('partyName', party.trim())
      if (search.trim()) params.set('search', search.trim())
      const data = await request(`/api/jobs?${params}`)
      setJobs(data.data)
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [party, search])

  const totalQuantity = jobs.reduce((total, job) => total + Number(job.quantity || 0), 0)
  const parties = [...new Set(jobs.map((job) => job.partyName).filter(Boolean))].sort()

  return <>
    <section className="customer-hero">
      <div><p className="eyebrow">Customer view</p><h2>Production details at a glance</h2><p>Review your submitted offset jobs, quantities, paper specifications, and job references.</p></div>
      <div className="customer-mark"><UserRound size={25} /></div>
    </section>
    <div className="stat-grid">
      <div className="stat-card"><span>Total jobs</span><strong>{jobs.length}</strong><small>Matching records</small></div>
      <div className="stat-card"><span>Total quantity</span><strong>{totalQuantity.toLocaleString('en-IN')}</strong><small>Sheets / pieces</small></div>
      <div className="stat-card"><span>Parties shown</span><strong>{parties.length}</strong><small>Customer accounts</small></div>
    </div>
    <section className="panel table-panel customer-table-panel">
      <div className="panel-heading customer-tools"><div><p className="eyebrow">Your register</p><h2>Job details</h2></div><div className="customer-filters"><label className="filter-select"><span>Party</span><select value={party} onChange={(event) => setParty(event.target.value)}><option value="">All parties</option>{parties.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><div className="search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search job details..." /></div></div></div>
      {error && <div className="alert">{error}</div>}
      <div className="table-wrap"><table><thead><tr><th>Date</th><th>Party</th><th>GSM</th><th>Paper</th><th>Qty</th><th>Counter</th><th>Job details</th></tr></thead><tbody>{loading ? <tr><td colSpan="7" className="empty">Loading details...</td></tr> : jobs.length === 0 ? <tr><td colSpan="7" className="empty">No customer details found.</td></tr> : jobs.map((job) => <tr key={job.id}><td>{new Date(job.date).toLocaleDateString('en-IN')}</td><td>{job.partyName}</td><td>{job.gsm}</td><td>{job.paperType}</td><td>{Number(job.quantity).toLocaleString('en-IN')}</td><td>{Number(job.counter).toLocaleString('en-IN')}</td><td>{job.jobDetails}</td></tr>)}</tbody></table></div>
    </section>
  </>
}

function CustomerPage() {
  return <main className="customer-page"><header className="customer-page-header"><div className="brand"><div className="brand-mark">O</div><div><strong>OMLATA</strong><span>OFFSET REGISTER</span></div></div><span className="customer-page-label">Customer portal</span></header><div className="customer-page-content"><CustomerPanel /></div></main>
}

function CatalogView({ catalog, reload }) {
  const [selected, setSelected] = useState('parties'); const [name, setName] = useState(''); const [value, setValue] = useState(''); const [amount, setAmount] = useState(''); const [rule, setRule] = useState({ paperTypeId: '', sizeId: '', printingSideId: '', quantityId: '' }); const [message, setMessage] = useState('')
  const config = resourceConfig.find((item) => item[0] === selected); const items = catalog[selected] || []; const numeric = config?.[2] === 'value'
  async function addOption(event) { event.preventDefault(); try { await request(`/api/catalog/admin/${selected}`, { method: 'POST', body: numeric ? { value: Number(value), label: value } : { name } }); setName(''); setValue(''); setMessage('Option added.'); reload() } catch (error) { setMessage(error.message) } }
  async function toggle(item) { await request(`/api/catalog/admin/${selected}/${item.id}`, { method: 'PUT', body: { active: !item.active } }); reload() }
  async function remove(id) { if (window.confirm('Delete this catalog option?')) { await request(`/api/catalog/admin/${selected}/${id}`, { method: 'DELETE' }); reload() } }
  async function saveRule(event) { event.preventDefault(); try { await request('/api/catalog/admin/price-rules', { method: 'POST', body: { ...rule, amount: Number(amount) } }); setAmount(''); setMessage('Price rule saved.'); reload() } catch (error) { setMessage(error.message) } }
  async function removeRule(id) { await request(`/api/catalog/admin/price-rules/${id}`, { method: 'DELETE' }); reload() }
  return <div className="catalog-layout"><aside className="catalog-nav">{resourceConfig.map(([key, label]) => <button key={key} className={selected === key ? 'active' : ''} onClick={() => setSelected(key)}>{label}</button>)}<button className={selected === 'price-rules' ? 'active' : ''} onClick={() => setSelected('price-rules')}>Price rules</button></aside><main className="catalog-main">{selected !== 'price-rules' ? <><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Catalog control</p><h2>{config[1]} options</h2></div></div><form className="inline-form" onSubmit={addOption}>{numeric ? <input type="number" min="1" value={value} onChange={(event) => setValue(event.target.value)} placeholder={`${config[1]} value`} required /> : <input value={name} onChange={(event) => setName(event.target.value)} placeholder={`${config[1]} name`} required />}<button className="button primary" type="submit"><Plus size={17} /> Add option</button></form>{message && <p className="form-message">{message}</p>}</section><section className="panel"><div className="option-list">{items.map((item) => <div className="option-row" key={item.id}><span>{item.name ?? item.label ?? item.value}</span><span className="row-actions"><button className="text-button" onClick={() => toggle(item)}>{item.active ? 'Active' : 'Inactive'}</button><button className="danger-button" onClick={() => remove(item.id)}><Trash2 size={15} /></button></span></div>)}</div></section></> : <><section className="panel"><div className="panel-heading"><div><p className="eyebrow">Pricing matrix</p><h2>Configure a rate</h2></div></div><form className="form-grid" onSubmit={saveRule}><Select label="Paper type" value={rule.paperTypeId} onChange={(v) => setRule({ ...rule, paperTypeId: v })} options={catalog['paper-types']} required /><Select label="Size" value={rule.sizeId} onChange={(v) => setRule({ ...rule, sizeId: v })} options={catalog.sizes} required /><Select label="Printing side" value={rule.printingSideId} onChange={(v) => setRule({ ...rule, printingSideId: v })} options={catalog['printing-sides']} required /><Select label="Quantity" value={rule.quantityId} onChange={(v) => setRule({ ...rule, quantityId: v })} options={catalog.quantities} labelKey="label" required /><label className="field"><span>Amount (Rs.)</span><input type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label><div className="field action-field"><button className="button primary" type="submit">Save rate</button></div></form>{message && <p className="form-message">{message}</p>}</section><section className="panel"><div className="option-list">{(catalog.priceRules || []).map((item) => <div className="option-row" key={item.id}><span>{item.paperTypeId.slice(0, 6)} / {item.sizeId.slice(0, 6)} / {item.quantityId.slice(0, 6)}</span><span className="row-actions"><strong>Rs. {Number(item.amount).toLocaleString('en-IN')}</strong><button className="danger-button" onClick={() => removeRule(item.id)}><Trash2 size={15} /></button></span></div>)}</div></section></>}</main></div>
}

function App() {
  const isCustomerPage = window.location.pathname.startsWith('/customer')
  const [view, setView] = useState('jobs'); const [catalog, setCatalog] = useState(null); const [error, setError] = useState('')
  async function loadCatalog() { try { setCatalog(await request('/api/catalog')); setError('') } catch (e) { setError(e.message) } }
  useEffect(() => { if (!isCustomerPage) loadCatalog() }, [isCustomerPage])
  if (isCustomerPage) return <CustomerPage />
  if (!catalog) return <div className="loading"><RefreshCw className="spin" /> Loading Omlata Offset...</div>
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">O</div><div><strong>OMLATA</strong><span>OFFSET REGISTER</span></div></div><nav><button className={view === 'jobs' ? 'active' : ''} onClick={() => setView('jobs')}><LayoutDashboard size={18} /> Production board</button><button className={view === 'catalog' ? 'active' : ''} onClick={() => setView('catalog')}><Database size={18} /> Catalog & rates</button></nav><div className="sidebar-foot"><span>Admin workspace</span><button className="icon-button" onClick={loadCatalog} title="Refresh catalog"><RefreshCw size={17} /></button></div></aside><main className="content"><header className="topbar"><div><p className="eyebrow">Omlata Offset / Administration</p><h1>{view === 'jobs' ? 'Job register' : 'Catalog control room'}</h1></div></header>{error && <div className="alert">{error}</div>}{view === 'jobs' ? <JobsView catalog={catalog} refreshCatalog={loadCatalog} /> : <CatalogView catalog={catalog} reload={loadCatalog} />}</main></div>
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
