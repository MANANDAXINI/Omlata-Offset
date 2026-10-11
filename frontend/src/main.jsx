import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowLeft, ClipboardList, Database, FilePlus2, LayoutDashboard, Plus, ReceiptText, RefreshCw, Search, Trash2, X } from 'lucide-react'
import './styles.css'
import './customer.css'
import './portal.css'
import './mobile.css'
import './admin.css'
import './bills.css'

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
      const jobData = { ...form }
      delete jobData.counterOptionId
      const saved = await request(editing ? `/api/jobs/${editing.id}` : '/api/jobs', { method: editing ? 'PUT' : 'POST', body: jobData })
      setMessage(editing ? 'Job updated.' : `Job saved. Serial no. ${saved.serialNumber}.`)
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
      <label className="field"><span>Counter</span><input type="number" min="0" step="1" value={form.counter ?? ''} onChange={(event) => set('counter', event.target.value)} placeholder="Type counter" required /></label>
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
    <section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">Live register</p><h2>Job records</h2></div><div className="search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search party, paper, job..." /></div></div><div className="table-wrap"><table><thead><tr><th>S.N</th><th>Date</th><th>Party</th><th>GSM</th><th>Paper</th><th>Qty</th><th>Counter</th><th>Job details</th><th></th></tr></thead><tbody>{loading ? <tr><td colSpan="9" className="empty">Loading records...</td></tr> : jobs.length === 0 ? <tr><td colSpan="9" className="empty">No jobs found.</td></tr> : jobs.map((job) => <tr key={job.id}><td>{job.serialNumber ?? '-'}</td><td>{new Date(job.date).toLocaleDateString('en-IN')}</td><td>{job.partyName}</td><td>{job.gsm}</td><td>{job.paperType}</td><td>{job.quantity.toLocaleString('en-IN')}</td><td>{job.counter.toLocaleString('en-IN')}</td><td>{job.jobDetails}</td><td><div className="row-actions"><button className="text-button" onClick={() => setEditing(job)}>Edit</button><button className="danger-button" onClick={() => remove(job.id)} title="Delete"><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div></section>
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

  return <>
    <section className="panel table-panel customer-table-panel">
      <div className="panel-heading customer-tools"><div><p className="eyebrow">Your register</p><h2>Job details</h2></div><div className="customer-filters"><label className="filter-select"><span>Party</span><select value={party} onChange={(event) => setParty(event.target.value)}><option value="">All parties</option>{parties.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><div className="search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search job details..." /></div></div></div>
      {error && <div className="alert">{error}</div>}
      <div className="table-wrap"><table><thead><tr><th>Sr. No.</th><th>Date</th><th>Party</th><th>GSM</th><th>Paper</th><th>Qty</th><th>Counter</th><th>Job details</th></tr></thead><tbody>{loading ? <tr><td colSpan="8" className="empty">Loading details...</td></tr> : jobs.length === 0 ? <tr><td colSpan="8" className="empty">No customer details found.</td></tr> : jobs.map((job) => <tr key={job.id}><td>{job.serialNumber ?? '-'}</td><td>{new Date(job.date).toLocaleDateString('en-IN')}</td><td>{job.partyName}</td><td>{job.gsm}</td><td>{job.paperType}</td><td>{Number(job.quantity).toLocaleString('en-IN')}</td><td>{Number(job.counter).toLocaleString('en-IN')}</td><td>{job.jobDetails}</td></tr>)}</tbody></table></div>
    </section>
  </>
}

function CustomerPage() {
  return <main className="customer-page"><header className="customer-page-header"><div className="brand"><div className="brand-mark">O</div><div><strong>OMLATA</strong><span>OFFSET REGISTER</span></div></div><span className="customer-page-label">Customer portal</span></header><div className="customer-page-content"><CustomerPanel /></div></main>
}

function BillForm({ catalog, onBack, onSaved }) {
  const [date, setDate] = useState(today)
  const [partyOptionId, setPartyOptionId] = useState('')
  const [voucherNumber, setVoucherNumber] = useState('')
  const [narration, setNarration] = useState('')
  const [parcelCharges, setParcelCharges] = useState('0')
  const [settledAmount, setSettledAmount] = useState('0')
  const [items, setItems] = useState([{ item: '', quantity: '1', unit: '', price: '' }])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const selectedParty = catalog.parties.find((party) => party.id === partyOptionId)
  const itemsTotal = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.price || 0), 0)
  const total = itemsTotal + Number(parcelCharges || 0)
  const balance = Math.max(0, total - Number(settledAmount || 0))
  const money = (amount) => Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  function updateItem(index, key, value) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item))
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    try {
      const bill = await request('/api/bills', {
        method: 'POST',
        body: { date, partyName: selectedParty?.name, voucherNumber, narration, parcelCharges: Number(parcelCharges), settledAmount: Number(settledAmount), items },
      })
      setMessage(`Bill saved. Serial no. ${bill.serialNumber}.`)
      setVoucherNumber('')
      setNarration('')
      setParcelCharges('0')
      setSettledAmount('0')
      setItems([{ item: '', quantity: '1', unit: '', price: '' }])
      onSaved()
    } catch (error) {
      setMessage(error.message)
    } finally {
      setSaving(false)
    }
  }

  return <section className="panel bill-entry-panel">
    <div className="panel-heading bill-heading"><div><p className="eyebrow">Sales entry</p><h2>Create bill record</h2></div><button className="button secondary" type="button" onClick={onBack}><ArrowLeft size={16} /> Back to choices</button></div>
    <form onSubmit={submit}>
      <div className="bill-meta-grid">
        <label className="field"><span>Date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        <Select label="Party" value={partyOptionId} onChange={setPartyOptionId} options={catalog.parties} required />
        <label className="field"><span>Voucher no.</span><input value={voucherNumber} onChange={(event) => setVoucherNumber(event.target.value)} placeholder="Optional" /></label>
      </div>
      <label className="field bill-narration"><span>Narration</span><textarea value={narration} onChange={(event) => setNarration(event.target.value)} rows="2" placeholder="Bill description or notes" /></label>
      <div className="table-wrap bill-items-wrap"><table className="bill-items-table"><thead><tr><th>S.N</th><th>Item</th><th>Qty.</th><th>Unit</th><th>Price</th><th>Amount</th><th></th></tr></thead><tbody>{items.map((item, index) => {
        const amount = Number(item.quantity || 0) * Number(item.price || 0)
        return <tr key={index}><td>{index + 1}</td><td><input aria-label={`Item ${index + 1}`} value={item.item} onChange={(event) => updateItem(index, 'item', event.target.value)} required /></td><td><input aria-label={`Quantity ${index + 1}`} type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} required /></td><td><input aria-label={`Unit ${index + 1}`} value={item.unit} onChange={(event) => updateItem(index, 'unit', event.target.value)} placeholder="pcs" /></td><td><input aria-label={`Price ${index + 1}`} type="number" min="0" step="0.01" value={item.price} onChange={(event) => updateItem(index, 'price', event.target.value)} required /></td><td className="bill-line-amount">{money(amount)}</td><td><button className="danger-button" type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={items.length === 1} title="Remove item"><Trash2 size={15} /></button></td></tr>
      })}</tbody></table></div>
      <button className="text-button bill-add-item" type="button" onClick={() => setItems((current) => [...current, { item: '', quantity: '1', unit: '', price: '' }])}><Plus size={16} /> Add item row</button>
      <div className="bill-bottom-grid">
        <div className="bill-note-summary"><span>Bill amount</span><strong>Rs. {money(itemsTotal)}</strong><small>Items before parcel charges</small></div>
        <div className="bill-totals">
          <label><span>Parcel charges</span><input type="number" min="0" step="0.01" value={parcelCharges} onChange={(event) => setParcelCharges(event.target.value)} /></label>
          <label><span>Settlement</span><input type="number" min="0" step="0.01" value={settledAmount} onChange={(event) => setSettledAmount(event.target.value)} /></label>
          <div className="bill-total-row"><span>Total amount</span><strong>Rs. {money(total)}</strong></div>
          <div className="bill-balance-row"><span>Balance due</span><strong>Rs. {money(balance)}</strong></div>
        </div>
      </div>
      {message && <p className="form-message">{message}</p>}
      <div className="form-footer bill-submit-footer"><span>{selectedParty ? `Party: ${selectedParty.name}` : 'Choose a party to prepare this bill.'}</span><button className="button primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save bill record'}</button></div>
    </form>
  </section>
}

function BillsView({ catalog, onBack }) {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const money = (amount) => Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  async function load() {
    setLoading(true)
    try {
      const result = await request('/api/bills')
      setBills(result.data)
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function remove(bill) {
    if (!window.confirm(`Delete bill serial no. ${bill.serialNumber}?`)) return
    try {
      await request(`/api/bills/${bill.id}`, { method: 'DELETE' })
      await load()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return <>
    <BillForm catalog={catalog} onBack={onBack} onSaved={load} />
    <section className="panel table-panel"><div className="panel-heading"><div><p className="eyebrow">Saved vouchers</p><h2>Bill records</h2></div></div>{error && <div className="alert">{error}</div>}<div className="table-wrap"><table><thead><tr><th>S.N</th><th>Date</th><th>Party</th><th>Voucher no.</th><th>Items</th><th>Total</th><th>Settlement</th><th>Balance</th><th></th></tr></thead><tbody>{loading ? <tr><td colSpan="9" className="empty">Loading bills...</td></tr> : bills.length === 0 ? <tr><td colSpan="9" className="empty">No bill records yet.</td></tr> : bills.map((bill) => <tr key={bill.id}><td>{bill.serialNumber}</td><td>{new Date(bill.date).toLocaleDateString('en-IN')}</td><td>{bill.partyName}</td><td>{bill.voucherNumber || '-'}</td><td>{bill.items.length}</td><td>Rs. {money(bill.totalAmount)}</td><td>Rs. {money(bill.settledAmount)}</td><td>Rs. {money(Math.max(0, Number(bill.totalAmount) - Number(bill.settledAmount)))}</td><td><button className="danger-button" type="button" onClick={() => remove(bill)} title="Delete bill"><Trash2 size={15} /></button></td></tr>)}</tbody></table></div></section>
  </>
}

function AdminHome({ onCreateJob, onCreateBill }) {
  return <section className="admin-home"><p className="eyebrow">Omlata Offset / Administration</p><h1>What would you like to create?</h1><div className="admin-choice-grid"><button className="admin-choice" onClick={onCreateJob}><span className="admin-choice-icon"><FilePlus2 size={24} /></span><span><strong>Create Job Record</strong><small>Open the production register and enter job specifications.</small></span><span className="admin-choice-arrow">→</span></button><button className="admin-choice admin-choice-bill" onClick={onCreateBill}><span className="admin-choice-icon"><ReceiptText size={24} /></span><span><strong>Create Bill Record</strong><small>Enter a sales voucher, items, charges and settlement.</small></span><span className="admin-choice-arrow">→</span></button></div></section>
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
  const [view, setView] = useState('home'); const [catalog, setCatalog] = useState(null); const [error, setError] = useState('')
  async function loadCatalog() { try { setCatalog(await request('/api/catalog')); setError('') } catch (e) { setError(e.message) } }
  useEffect(() => { if (!isCustomerPage) loadCatalog() }, [isCustomerPage])
  if (isCustomerPage) return <CustomerPage />
  if (!catalog) return <div className="loading"><RefreshCw className="spin" />{error ? <><span>{error}</span><button className="button secondary" onClick={loadCatalog}>Try again</button></> : 'Loading Omlata Offset...'}</div>
  const titles = { home: 'Admin home', jobs: 'Job register', bills: 'Bill records', catalog: 'Catalog control room' }
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark">O</div><div><strong>OMLATA</strong><span>OFFSET REGISTER</span></div></div><nav><button className={view === 'home' ? 'active' : ''} onClick={() => setView('home')}><LayoutDashboard size={18} /> Admin home</button><button className={view === 'jobs' ? 'active' : ''} onClick={() => setView('jobs')}><ClipboardList size={18} /> Job register</button><button className={view === 'bills' ? 'active' : ''} onClick={() => setView('bills')}><ReceiptText size={18} /> Bill records</button><button className={view === 'catalog' ? 'active' : ''} onClick={() => setView('catalog')}><Database size={18} /> Catalog & rates</button></nav><div className="sidebar-foot"><span>Admin workspace</span><button className="icon-button" onClick={loadCatalog} title="Refresh catalog"><RefreshCw size={17} /></button></div></aside><main className="content"><header className="topbar"><div><p className="eyebrow">Omlata Offset / Administration</p><h1>{titles[view]}</h1></div></header>{error && <div className="alert">{error}</div>}{view === 'home' ? <AdminHome onCreateJob={() => setView('jobs')} onCreateBill={() => setView('bills')} /> : view === 'jobs' ? <JobsView catalog={catalog} refreshCatalog={loadCatalog} /> : view === 'bills' ? <BillsView catalog={catalog} onBack={() => setView('home')} /> : <CatalogView catalog={catalog} reload={loadCatalog} />}</main></div>
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
