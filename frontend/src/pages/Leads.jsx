import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { leadsApi, sourcesApi } from '../api'
import {
  Plus, Search, UserCheck, ChevronRight, Trash2, ArrowRight,
  Linkedin, Clock, CheckCircle, XCircle, Briefcase, GraduationCap,
  MapPin, RefreshCw, ExternalLink
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
            {(expanded ? data.experience : data.experience.slice(0, 2)).map((exp, i) => (
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
          <p className="text-xs text-gray-400 ml-auto">Scanned {new Date(data.scraped_at).toLocaleDateString()}</p>
        )}
      </div>
    </div>
  )
}

function LeadForm({ initial = {}, onSubmit, onCancel, isLoading }) {
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
          <label className="label">Source{activeSources.length === 0 && <a href="/sources" className="ml-2 text-xs text-blue-500 hover:underline" onClick={e => e.stopPropagation()}>Manage sources →</a>}</label>
          {activeSources.length > 0 ? (
            <select className="input" value={form.source} onChange={e => set('source', e.target.value)}>
              {activeSources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
          ) : (
            <div className="input bg-gray-50 text-gray-400 text-sm cursor-not-allowed">No sources — <a href="/sources" className="text-blue-500 hover:underline">add some</a></div>
          )}
        </div>
      </div>
      <div><label className="label">Status</label>
        <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="unqualified">Unqualified</option>
        </select>
      </div>
      <div>
        <label className="label flex items-center gap-1.5"><Linkedin size={13} className="text-[#0a66c2]" />LinkedIn URL</label>
        <input className="input" placeholder="https://linkedin.com/in/username" value={form.linkedin_url} onChange={e => set('linkedin_url', e.target.value)} />
      </div>
      <div><label className="label">Notes</label><textarea className="input" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
      <div className="flex gap-3 justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Lead'}</button>
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
    refetchInterval: (data) => data?.linkedin_scan_status === 'pending' ? 5000 : false,
  })

  const scanStatus = lead.linkedin_scan_status
  const linkedinData = lead.linkedin_data && typeof lead.linkedin_data === 'object' ? lead.linkedin_data : null
  const ScanIcon = SCAN_STATUS_ICONS[scanStatus]?.icon

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
        </div>
      </div>
      <div className="border border-gray-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Linkedin size={16} className="text-[#0a66c2]" />
          <span className="text-sm font-medium">LinkedIn Profile</span>
          {ScanIcon && scanStatus !== 'none' && (
            <span className={`ml-auto flex items-center gap-1 text-xs ${SCAN_STATUS_ICONS[scanStatus].color}`}>
              <ScanIcon size={12} />{SCAN_STATUS_ICONS[scanStatus].label}
              {scanStatus === 'pending' && <RefreshCw size={10} className="animate-spin ml-0.5" />}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <input className="input flex-1 text-sm" placeholder="https://linkedin.com/in/username" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} />
          <button onClick={queueScan} disabled={isQueuing || !linkedinUrl || scanStatus === 'pending'}
            className="btn-primary text-sm whitespace-nowrap flex items-center gap-1.5">
            <Linkedin size={14} />
            {isQueuing ? 'Queuing...' : scanStatus === 'pending' ? 'Queued...' : 'Scan with Claude'}
          </button>
        </div>
        {queueMsg && (
          <div className={`mt-2 p-2.5 rounded-lg text-xs ${queueMsg.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{queueMsg}</div>
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

export default function Leads() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [importPrefill, setImportPrefill] = useState(null)
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

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
      }
      setImportPrefill(prefill)
      setShowModal(true)
      setSearchParams({})
    }
  }, [])

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', search, statusFilter],
    queryFn: () => leadsApi.getAll({ search, status: statusFilter || undefined }),
  })

  const { data: sources = [] } = useQuery({ queryKey: ['sources'], queryFn: sourcesApi.getAll })

  const createMut = useMutation({
    mutationFn: leadsApi.create,
    onSuccess: () => { qc.invalidateQueries(['leads']); qc.invalidateQueries(['dashboard']); setShowModal(false); setImportPrefill(null) }
  })
  const updateMut = useMutation({ mutationFn: ({ id, data }) => leadsApi.update(id, data), onSuccess: () => { qc.invalidateQueries(['leads']); setEditing(null) } })
  const deleteMut = useMutation({ mutationFn: leadsApi.delete, onSuccess: () => { qc.invalidateQueries(['leads']); qc.invalidateQueries(['dashboard']) } })
  const convertMut = useMutation({ mutationFn: leadsApi.convert, onSuccess: () => { qc.invalidateQueries(['leads']); qc.invalidateQueries(['contacts']); qc.invalidateQueries(['dashboard']) } })

  const sourceColorMap = Object.fromEntries(sources.map(s => [s.name.toLowerCase(), s.color]))
  const getSourceColor = (sourceName) => sourceColorMap[sourceName?.toLowerCase()] || '#6b7280'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Leads</h1><p className="text-sm text-gray-500">{leads.length} leads total</p></div>
        <button className="btn-primary flex items-center gap-2" onClick={() => { setImportPrefill(null); setShowModal(true) }}>
          <Plus size={16} /> Add Lead
        </button>
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..." className="input pl-8" />
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
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Company</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Source</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">
                <UserCheck size={32} className="mx-auto mb-2 text-gray-300" />
                No leads yet. Add your first lead or sync Gmail to auto-import.
              </td></tr>
            ) : leads.map(lead => {
              const ScanIcon = SCAN_STATUS_ICONS[lead.linkedin_scan_status]?.icon
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
                          {ScanIcon ? <ScanIcon size={13} className={SCAN_STATUS_ICONS[lead.linkedin_scan_status].color} /> : <Linkedin size={13} className="text-[#0a66c2] opacity-50" />}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{lead.company || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: getSourceColor(lead.source) }}>
                      {lead.source}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-600'}`}>{lead.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(lead.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {lead.status !== 'converted' && (
                        <button onClick={() => { if(window.confirm('Convert to contact?')) convertMut.mutate(lead.id) }}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Convert to Contact"><ArrowRight size={14} /></button>
                      )}
                      <button onClick={() => setViewing(lead)} className="p-1.5 text-[#0a66c2] hover:bg-blue-50 rounded" title="View LinkedIn profile"><Linkedin size={14} /></button>
                      <button onClick={() => setEditing(lead)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded" title="Edit"><ChevronRight size={14} /></button>
                      <button onClick={() => { if(window.confirm('Delete this lead?')) deleteMut.mutate(lead.id) }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setImportPrefill(null) }} title={importPrefill ? 'Import LinkedIn Lead' : 'Add New Lead'}>
        <LeadForm initial={importPrefill || {}} onSubmit={createMut.mutate} onCancel={() => { setShowModal(false); setImportPrefill(null) }} isLoading={createMut.isPending} />
      </Modal>
      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Edit Lead">
        {editing && <LeadForm initial={editing} onSubmit={data => updateMut.mutate({ id: editing.id, data })} onCancel={() => setEditing(null)} isLoading={updateMut.isPending} />}
      </Modal>
      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title="Lead Profile" size="lg">
        {viewing && <LeadDetail lead={viewing} onClose={() => setViewing(null)} />}
      </Modal>
    </div>
  )
}
