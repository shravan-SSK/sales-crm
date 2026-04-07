import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { leadsApi, sourcesApi, importApi } from '../api'
import {
  Plus, Search, UserCheck, ChevronRight, Trash2, ArrowRight,
  Linkedin, Clock, CheckCircle, XCircle, Briefcase, GraduationCap,
  MapPin, RefreshCw, ExternalLink, Upload, Download, X, AlertCircle, CheckCircle2
} from 'lucide-react'
import Modal from '../components/Modal'

const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-yellow-100 text-yellow-700',
  qualified: 'bg-green-100 text-green-700',
  unqualified: 'bg-gray-100 text-gray-600',
  converted: 'bg-purple-100 text-purple-700',
}

const SCAN_STATUS_ICONS = {
  pending: { icon: Clock, color: 'text-amber-500', label: 'Scan queued' },
  done: { icon: CheckCircle, color: 'text-green-500', label: 'Scanned' },
  failed: { icon: XCircle, color: 'text-red-400', label: 'Scan failed' },
}

const DEAL_CATEGORIES = [
  { key: '', label: 'All Deals', color: 'text-gray-600' },
  { key: 'tech_milestone', label: 'Tech Milestone Deals', color: 'text-blue-600', bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-700' },
  { key: 'tech_retainer', label: 'Tech Retainer Deals', color: 'text-indigo-600', bg: 'bg-indigo-50', badge: 'bg-indigo-100 text-indigo-700' },
  { key: 'marketing', label: 'Marketing Leads', color: 'text-pink-600', bg: 'bg-pink-50', badge: 'bg-pink-100 text-pink-700' },
  { key: 'cro', label: 'CRO Leads', color: 'text-orange-600', bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700' },
]

function getCategoryBadge(key) {
  const cat = DEAL_CATEGORIES.find(c => c.key === key)
  return cat ? { label: cat.label, badge: cat.badge } : null
}

// Parse CSV text into array of objects
function parseCSV(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase().replace(/\s+/g, '_'))
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = []
    let cur = '', inQuotes = false
    for (const ch of line) {
      if (ch === '"') inQuotes = !inQuotes
      else if (ch === ',' && !inQuotes) { values.push(cur.trim()); cur = '' }
      else cur += ch
    }
    values.push(cur.trim())
    return Object.fromEntries(headers.map((h, i) => [h, values[i] || '']))
  })
}

function CSVImportModal({ onClose }) {
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef()
  const qc = useQueryClient()

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setResult(null)
    setError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result)
      setRows(parsed)
    }
    reader.readAsText(f)
  }

  const doImport = async () => {
    if (!rows.length) return
    setImporting(true)
    setError(null)
    try {
      const res = await importApi.importLeads(rows)
      setResult(res)
      qc.invalidateQueries(['leads'])
      qc.invalidateQueries(['dashboard'])
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    }
    setImporting(false)
  }

  const downloadTemplate = () => {
    const csv = 'first_name,last_name,email,phone,company,title,source,status,notes,linkedin_url,deal_category\nJohn,Doe,john@example.com,+1234567890,Acme Inc,CEO,LinkedIn,new,,https://linkedin.com/in/johndoe,tech_milestone'
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'deals_import_template.csv'
    a.click()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">Import deals/leads from a CSV file. Download the template to see the required format.</p>
        </div>
      </div>

      <button onClick={downloadTemplate} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
        <Download size={14} /> Download CSV Template
      </button>

      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
        <strong>deal_category options:</strong> tech_milestone, tech_retainer, marketing, cro (or leave blank for unclassified)
      </div>

      <div
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
        onClick={() => fileRef.current?.click()}
      >
        <Upload size={24} className="mx-auto mb-2 text-gray-400" />
        <p className="text-sm font-medium text-gray-600">{file ? file.name : 'Click to choose CSV file'}</p>
        <p className="text-xs text-gray-400 mt-1">CSV format, UTF-8 encoding</p>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
      </div>

      {rows.length > 0 && !result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">{rows.length} rows detected</p>
            <button onClick={() => { setRows([]); setFile(null) }} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-auto max-h-48">
            <table className="text-xs w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{Object.keys(rows[0]).map(k => <th key={k} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{k}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {Object.values(row).map((v, j) => <td key={j} className="px-3 py-1.5 text-gray-700 max-w-24 truncate">{v}</td>)}
                  </tr>
                ))}
                {rows.length > 5 && <tr><td colSpan={Object.keys(rows[0]).length} className="px-3 py-2 text-gray-400 text-center">...and {rows.length - 5} more rows</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={18} className="text-green-600" />
            <span className="font-medium text-green-800">Import complete!</span>
          </div>
          <p className="text-sm text-green-700">{result.imported} of {result.total} records imported successfully.</p>
          {result.errors?.length > 0 && <p className="text-xs text-red-600 mt-1">{result.errors.length} rows skipped due to errors.</p>}
        </div>
      )}

      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="btn-secondary">
          {result ? 'Done' : 'Cancel'}
        </button>
        {!result && rows.length > 0 && (
          <button onClick={doImport} disabled={importing} className="btn-primary flex items-center gap-2">
            <Upload size={14} />
            {importing ? `Importing ${rows.length} rows...` : `Import ${rows.length} rows`}
          </button>
        )}
      </div>
    </div>
  )
}

function LinkedInDataCard({ data, linkedinUrl }) {
  const [expanded, setExpanded] = useState(false)
  if (!data) return null

  return (
    <div className="mt-3 border border-blue-100 rounded-xl overflow-hidden bg-gradient-to-b from-blue-50 to-white">
      <div className="flex items-start gap-3 p-4 pb-3">
        {data.image && (
          <img src={data.image} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-white shadow" />
        )}
        <div className="flex-1 min-w-0">
          {data.name && <p className="text-sm font-semibold text-gray-800">{data.name}</p>}
          {data.headline && <p className="text-xs text-gray-600 mt-0.5">{data.headline}</p>}
          {data.location && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin size={11} className="text-gray-400" />
              <p className="text-xs text-gray-500">{data.location}</p>
            </div>
          )}
        </div>
        {linkedinUrl && (
          <a href={linkedinUrl} target="_blank" rel="noopener noreferrer"
            className="text-[#0a66c2] hover:opacity-80 flex-shrink-0" title="Open LinkedIn profile">
            <ExternalLink size={14} />
          </a>
        )}
      </div>

      {data.about && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">{data.about}</p>
        </div>
      )}

      {data.experience?.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Briefcase size={12} className="text-gray-400" />
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Experience</p>
          </div>
          <div className="space-y-2">
            x(expanded ? data.experience : data.experience.slice(0, 2)).map((exp, i) => (
              <div key={i} className="flex gap-2">
                <div className="w-1 bg-blue-200 rounded-full flex-shrink-0 mt-1" />
                <div>
                  <p className="text-xs font-medium text-gray-700">{exp.title}</p>
                  <p className="text-xs text-gray-500">{exp.company}{exp.date_range ? ` · ${exp.date_range}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.education?.length > 0 && expanded && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <GraduationCap size={12} className="text-gray-400" />
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Education</p>
          </div>
          <div className="space-y-1.5">
            {data.education.slice(0, 3).map((edu, i) => (
              <div key={i} className="flex gap-2">
                <div className="w-1 bg-green-200 rounded-full flex-shrink-0 mt-1" />
                <div>
                  <p className="text-xs font-medium text-gray-700">{edu.school}</p>
                  {edu.degree && <p className="text-xs text-gray-500">{edu.degree}{edu.date_range ? ` · ${edu.date_range}` : ''}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.skills?.length > 0 && expanded && (
        <div className="px-4 pb-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Skills</p>
          <div className="flex flex-wrap gap-1">
            {data.skills.slice(0, 8).map((skill, i) => (
              <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">{skill}</span>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 py-2.5 border-t border-blue-100 bg-blue-50/50 flex items-center justify-between">
        {(data.experience?.length > 2 || data.education?.length > 0 || data.skills?.length > 0) && (
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-blue-600 hover:underline">
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
        {data.scraped_at && (
          <p className="text-xs text-gray-400 ml-auto">
            Scanned {new Date(data.scraped_at).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  )
}

function DealForm({ initial = {}, onSubmit, onCancel, isLoading }) {
  const [form, setForm] = useState({
    first_name: initial.first_name || '',
    last_name: initial.last_name || '',
    email: initial.email || '',
    phone: initial.phone || '',
    company: initial.company || '',
    title: initial.title || '',
    source: initial.source || '',
    status: initial.status || 'new',
    notes: initial.notes || '',
    linkedin_url: initial.linkedin_url || '',
    deal_category: initial.deal_category || '',
  })

  const { data: sources = [] } = useQuery({ queryKey: ['sources'], queryFn: sourcesApi.getAll })

  useEffect(() => {
    if (sources.length > 0 && !form.source) {
      const active = sources.filter(s => s.is_active)
      if (active.length > 0) setForm(f => ({ ...f, source: active[0].name }))
    }
  }, [sources])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const activeSources = sources.filter(s => s.is_active)

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
      {/* Deal Category */}
      <div>
        <label className="label">Deal Category</label>
        <select className="input" value={form.deal_category} onChange={e => set('deal_category', e.target.value)}>
          <option value="">— Unclassified —</option>
          <option value="tech_milestone">Tech Milestone Deals</option>
          <option value="tech_retainer">Tech Retainer Deals</option>
          <option value="marketing">Marketing Leads</option>
          <option value="cro">CRO Leads</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">First Name *</label><input className="input" value={form.first_name} onChange={e => set('first_name', e.target.value)} required /></div>
        <div><label className="label">Last Name *</label><input className="input" value={form.last_name} onChange={e => set('last_name', e.target.value)} required /></div>
      </div>
      <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
        <div><label className="label">Company</label><input className="input" value={form.company} onChange={e => set('company', e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Title</label><input className="input" value={form.title} onChange={e => set('title', e.target.value)} /></div>
        <div>
          <label className="label">
            Source
            {activeSources.length === 0 && (
              <a href="/sources" className="ml-2 text-xs text-blue-500 hover:underline" onClick={e => e.stopPropagation()}>
                Manage sources →
              </a>
            )}
          </label>
          {activeSources.length > 0 ? (
            <select className="input" value={form.source} onChange={e => set('source', e.target.value)}>
              {activeSources.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          ) : (
            <div className="input bg-gray-50 text-gray-400 text-sm cursor-not-allowed">
              No sources configured — <a href="/sources" className="text-blue-500 hover:underline">add some</a>
            </div>
          )}
        </div>
      </div>
      <div>
        <label className="label">Status</label>
        <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="unqualified">Unqualified</option>
        </select>
      </div>
      <div>
        <label className="label flex items-center gap-1.5">
          <Linkedin size={13} className="text-[#0a66c2]" />
          LinkedIn URL
        </label>
        <input className="input" placeholder="https://linkedin.com/in/username" value={form.linkedin_url} onChange={e => set('linkedin_url', e.target.value)} />
      </div>
      <div><label className="label">Notes</label><textarea className="input" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
      <div className="flex gap-3 justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Deal'}</button>
      </div>
    </form>
  )
}

function LeadDetail({ lead: initialLead, onClose }) {
  const qc = useQueryClient()
  const [linkedinUrl, setLinkedinUrl] = useState(initialLead.linkedin_url || '')
  const [queueMsg, setQueueMsg] = useState(null)
  const [isQueuing, setIsQueuing] = useState(false)

  const { data: lead = initialLead } = useQuery({
    queryKey: ['lead', initialLead.id],
    queryFn: () => leadsApi.get(initialLead.id),
    refetchInterval: lead?.linkedin_scan_status === 'pending' ? 5000 : false,
  })

  const scanStatus = lead.linkedin_scan_status
  const linkedinData = lead.linkedin_data && typeof lead.linkedin_data === 'object'
    ? lead.linkedin_data
    : (lead.linkedin_data ? (() => { try { return JSON.parse(lead.linkedin_data) } catch { return null } })() : null)

  const queueScan = async () => {
    if (!linkedinUrl) return
    setIsQueuing(true)
    try {
      await leadsApi.requestScan(lead.id, linkedinUrl)
      qc.invalidateQueries(['leads'])
      qc.invalidateQueries(['lead', lead.id])
      setQueueMsg('✓ Scan queued! Go to your Cowork chat and ask Claude to "scan pending LinkedIn profiles" to complete it.')
    } catch (e) {
      setQueueMsg('⚠ ' + (e.response?.data?.error || e.message))
    }
    setIsQueuing(false)
  }

  const ScanIcon = SCAN_STATUS_ICONS[scanStatus]?.icon

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold">
          {lead.first_name[0]}{lead.last_name[0]}
        </div>
        <div>
          <h3 className="text-lg font-semibold">{lead.first_name} {lead.last_name}</h3>
          <p className="text-sm text-gray-500">{lead.title}{lead.company ? ` @ ${lead.company}` : ''}</p>
          {lead.email && <p className="text-sm text-blue-600">{lead.email}</p>}
          {lead.deal_category && (
            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryBadge(lead.deal_category)?.badge || 'bg-gray-100 text-gray-600'}`}>
              {getCategoryBadge(lead.deal_category)?.label || lead.deal_category}
            </span>
          )}
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Linkedin size={16} className="text-[#0a66c2]" />
          <span className="text-sm font-medium">LinkedIn Profile</span>
          {ScanIcon && scanStatus !== 'none' && (
            <span className={`ml-auto flex items-center gap-1 text-xs ${SCAN_STATUS_ICONS[scanStatus].color}`}>
              <ScanIcon size={12} />
              {SCAN_STATUS_ICONS[scanStatus].label}
              {scanStatus === 'pending' && <RefreshCw size={10} className="animate-spin ml-0.5" />}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <input className="input flex-1 text-sm" placeholder="https://linkedin.com/in/username" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} />
          <button onClick={queueScan} disabled={isQueuing || !linkedinUrl || scanStatus === 'pending'} className="btn-primary text-sm whitespace-nowrap flex items-center gap-1.5">
            <Linkedin size={14} />
            {isQueuing ? 'Queuing...' : scanStatus === 'pending' ? 'Queued...' : 'Scan with Claude'}
          </button>
        </div>

        {queueMsg && (
          <div className={`mt-2 p-2.5 rounded-lg text-xs ${queueMsg.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
            {queueMsg}
          </div>
        )}

        {scanStatus === 'pending' && !queueMsg && (
          <div className="mt-2 p-2.5 bg-amber-50 rounded-lg text-xs text-amber-700 flex items-center gap-2">
            <RefreshCw size={12} className="animate-spin flex-shrink-0" />
            Scan queued — ask Claude in your Cowork chat to "scan pending LinkedIn profiles". This page will update automatically.
          </div>
        )}

        <LinkedInDataCard data={linkedinData} linkedinUrl={lead.linkedin_url} />
      </div>
    </div>
  )
}

export default function Deals() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [importPrefill, setImportPrefill] = useState(null)
  const [showImport, setShowImport] = useState(false)
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  // Handle bookmarklet imports via URL params
  useEffect(() => {
    if (searchParams.get('import') === '1') {
      const name = searchParams.get('name') || ''
      const nameParts = name.trim().split(' ')
      const prefill = {
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' ') || '',
        title: searchParams.get('title') || '',
        company: searchParams.get('company') || '',
        linkedin_url: searchParams.get('linkedin_url') || '',
        notes: '',
        source: 'LinkedIn',
        status: 'new',
        deal_category: '',
      }
      setImportPrefill(prefill)
      setShowModal(true)
      setSearchParams({})
    }
  }, [])

  const { data: allLeads = [], isLoading } = useQuery({
    queryKey: ['leads', search, statusFilter],
    queryFn: () => leadsApi.getAll({ search, status: statusFilter || undefined }),
  })

  const { data: sources = [] } = useQuery({ queryKey: ['sources'], queryFn: sourcesApi.getAll })

  // Filter by active category in frontend
  const leads = activeCategory
    ? allLeads.filter(l => (l.deal_category || '') === activeCategory)
    : allLeads

  const createMut = useMutation({
    mutationFn: leadsApi.create,
    onSuccess: () => { qc.invalidateQueries(['leads']); qc.invalidateQueries(['dashboard']); setShowModal(false); setImportPrefill(null) }
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => leadsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries(['leads']); setEditing(null) }
  })
  const deleteMut = useMutation({ mutationFn: leadsApi.delete, onSuccess: () => { qc.invalidateQueries(['leads']); qc.invalidateQueries(['dashboard']) } })
  const convertMut = useMutation({ mutationFn: leadsApi.convert, onSuccess: () => { qc.invalidateQueries(['leads']); qc.invalidateQueries(['contacts']); qc.invalidateQueries(['dashboard']) } })

  const sourceColorMap = Object.fromEntries(sources.map(s => [s.name.toLowerCase(), s.color]))
  const getSourceColor = (sourceName) => sourceColorMap[sourceName?.toLowerCase()] || '#6b7280'

  // Count per category
  const categoryCounts = DEAL_CATEGORIES.reduce((acc, cat) => {
    acc[cat.key] = cat.key === '' ? allLeads.length : allLeads.filter(l => (l.deal_category || '') === cat.key).length
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Deals</h1>
          <p className="text-sm text-gray-500">{leads.length} {activeCategory ? DEAL_CATEGORIES.find(c => c.key === activeCategory)?.label : 'total deals'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary flex items-center gap-2" onClick={() => setShowImport(true)}>
            <Upload size={14} /> Import CSV
          </button>
          <button className="btn-primary flex items-center gap-2" onClick={() => { setImportPrefill(null); setShowModal(true) }}>
            <Plus size={16} /> Add Deal
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {DEAL_CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeCategory === cat.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {cat.label}
            <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
              activeCategory === cat.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {categoryCounts[cat.key] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search deals..." className="input pl-8" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input w-auto">
          <option value="">All Status</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="unqualified">Unqualified</option>
          <option value="converted">Converted</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Company</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Source</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">
                <UserCheck size={32} className="mx-auto mb-2 text-gray-300" />
                No deals in this category yet.
              </td></tr>
            ) : leads.map(lead => {
              const ScanIcon = SCAN_STATUS_ICONS[lead.linkedin_scan_status]?.icon
              const catInfo = getCategoryBadge(lead.deal_category)
              return (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                        {lead.first_name[0]}{lead.last_name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{lead.first_name} {lead.last_name}</p>
                        <p className="text-xs text-gray-500">{lead.email}</p>
                      </div>
                      {lead.linkedin_url && (
                        <span title={SCAN_STATUS_ICONS[lead.linkedin_scan_status]?.label || 'Has LinkedIn'}>
                          {ScanIcon
                            ? <ScanIcon size={13} className={SCAN_STATUS_ICONS[lead.linkedin_scan_status].color} />
                            : <Linkedin size={13} className="text-[#0a66c2] opacity-50" />
                          }
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {catInfo ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${catInfo.badge}`}>{catInfo.label}</span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{lead.company || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: getSourceColor(lead.source) }}
                    >
                      {lead.source}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-600'}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(lead.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {lead.status !== 'converted' && (
                        <button onClick={() => { if(window.confirm('Convert to contact?')) convertMut.mutate(lead.id) }}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Convert to Contact">
                          <ArrowRight size={14} />
                        </button>
                      )}
                      <button onClick={() => setViewing(lead)} className="p-1.5 text-[#0a66c2] hover:bg-blue-50 rounded" title="View LinkedIn profile">
                        <Linkedin size={14} />
                      </button>
                      <button onClick={() => setEditing(lead)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title="Edit">
                        <ChevronRight size={14} />
                      </button>
                      <button onClick={() => { if(window.confirm('Delete this deal?')) deleteMut.mutate(lead.id) }}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setImportPrefill(null) }} title={importPrefill ? 'Import LinkedIn Deal' : 'Add New Deal'}>
        <DealForm
          initial={importPrefill || { deal_category: activeCategory }}
          onSubmit={createMut.mutate}
          onCancel={() => { setShowModal(false); setImportPrefill(null) }}
          isLoading={createMut.isPending}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Edit Deal">
        {editing && <DealForm initial={editing} onSubmit={data => updateMut.mutate({ id: editing.id, data })} onCancel={() => setEditing(null)} isLoading={updateMut.isPending} />}
      </Modal>

      {/* LinkedIn Detail Modal */}
      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title="Deal Profile" size="lg">
        {viewing && <LeadDetail lead={viewing} onClose={() => setViewing(null)} />}
      </Modal>

      {/* CSV Import Modal */}
      <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="Import Deals from CSV" size="lg">
        <CSVImportModal onClose={() => setShowImport(false)} />
      </Modal>
    </div>
  )
}
