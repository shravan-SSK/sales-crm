import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { contactsApi, accountsApi } from '../api'
import {
  Plus, Search, Users, Linkedin, Trash2, ExternalLink,
  Clock, CheckCircle, XCircle, Briefcase, GraduationCap, MapPin, RefreshCw
} from 'lucide-react'
import Modal from '../components/Modal'

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
                  {expanded && exp.description && <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{exp.description}</p>}
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
        {data.scraped_at && <p className="text-xs text-gray-400 ml-auto">Scanned {new Date(data.scraped_at).toLocaleDateString()}</p>}
      </div>
    </div>
  )
}

function ContactForm({ initial = {}, accounts = [], onSubmit, onCancel, isLoading }) {
  const [form, setForm] = useState({
    first_name: initial.first_name || '',
    last_name: initial.last_name || '',
    email: initial.email || '',
    phone: initial.phone || '',
    title: initial.title || '',
    account_id: initial.account_id || '',
    linkedin_url: initial.linkedin_url || '',
    notes: initial.notes || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">First Name *</label><input className="input" value={form.first_name} onChange={e => set('first_name', e.target.value)} required /></div>
        <div><label className="label">Last Name *</label><input className="input" value={form.last_name} onChange={e => set('last_name', e.target.value)} required /></div>
      </div>
      <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
        <div><label className="label">Title</label><input className="input" value={form.title} onChange={e => set('title', e.target.value)} /></div>
      </div>
      <div><label className="label">Account</label>
        <select className="input" value={form.account_id} onChange={e => set('account_id', e.target.value)}>
          <option value="">No Account</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label flex items-center gap-1.5"><Linkedin size={13} className="text-[#0a66c2]" />LinkedIn URL</label>
        <input className="input" placeholder="https://linkedin.com/in/..." value={form.linkedin_url} onChange={e => set('linkedin_url', e.target.value)} />
      </div>
      <div><label className="label">Notes</label><textarea className="input" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
      <div className="flex gap-3 justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Contact'}</button>
      </div>
    </form>
  )
}

function ContactDetail({ contact: initialContact, onClose }) {
  const qc = useQueryClient()
  const [linkedinUrl, setLinkedinUrl] = useState(initialContact.linkedin_url || '')
  const [queueMsg, setQueueMsg] = useState(null)
  const [isQueuing, setIsQueuing] = useState(false)

  const { data: contact = initialContact } = useQuery({
    queryKey: ['contact', initialContact.id],
    queryFn: () => contactsApi.get(initialContact.id),
    refetchInterval: (data) => data?.linkedin_scan_status === 'pending' ? 5000 : false,
    initialData: initialContact,
  })

  const scanStatus = contact.linkedin_scan_status
  const linkedinData = contact.linkedin_data && typeof contact.linkedin_data === 'object' ? contact.linkedin_data : null
  const ScanIcon = SCAN_STATUS_ICONS[scanStatus]?.icon

  const queueScan = async () => {
    if (!linkedinUrl) return
    setIsQueuing(true)
    try {
      await contactsApi.requestScan(contact.id, linkedinUrl)
      qc.invalidateQueries(['contacts'])
      qc.invalidateQueries(['contact', contact.id])
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
          {contact.first_name[0]}{contact.last_name[0]}
        </div>
        <div>
          <h3 className="text-lg font-semibold">{contact.first_name} {contact.last_name}</h3>
          <p className="text-sm text-gray-500">{contact.title}{contact.account_name ? ` @ ${contact.account_name}` : ''}</p>
          {contact.email && <p className="text-sm text-blue-600">{contact.email}</p>}
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
        <LinkedInDataCard data={linkedinData} linkedinUrl={contact.linkedin_url} />
      </div>
      {contact.deals?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Associated Deals</h4>
          <div className="space-y-2">
            {contact.deals.map(d => (
              <div key={d.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg text-sm">
                <span>{d.name}</span><span className="text-green-600 font-medium">${d.value?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {contact.activities?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Recent Activities</h4>
          <div className="space-y-1">
            {contact.activities.slice(0, 5).map(act => (
              <div key={act.id} className="flex items-center gap-2 text-sm text-gray-600 py-1 border-b border-gray-100">
                <span className="text-gray-400">{act.type}</span><span>{act.subject}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Contacts() {
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const qc = useQueryClient()

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['contacts', search],
    queryFn: () => contactsApi.getAll({ search }),
  })

  const { data: contactDetail } = useQuery({
    queryKey: ['contact', viewing?.id],
    queryFn: () => contactsApi.get(viewing.id),
    enabled: !!viewing,
  })

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: () => accountsApi.getAll() })

  const createMut = useMutation({ mutationFn: contactsApi.create, onSuccess: () => { qc.invalidateQueries(['contacts']); qc.invalidateQueries(['dashboard']); setShowModal(false) } })
  const updateMut = useMutation({ mutationFn: ({ id, data }) => contactsApi.update(id, data), onSuccess: () => { qc.invalidateQueries(['contacts']); setEditing(null) } })
  const deleteMut = useMutation({ mutationFn: contactsApi.delete, onSuccess: () => { qc.invalidateQueries(['contacts']); qc.invalidateQueries(['dashboard']) } })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Contacts</h1><p className="text-sm text-gray-500">{contacts.length} contacts</p></div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowModal(true)}><Plus size={16} /> Add Contact</button>
      </div>
      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contacts..." className="input pl-8" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-3 text-center py-12 text-gray-400">Loading...</div>
        ) : contacts.length === 0 ? (
          <div className="col-span-3 card p-12 text-center text-gray-400">
            <Users size={32} className="mx-auto mb-2 text-gray-300" />No contacts yet.
          </div>
        ) : contacts.map(c => {
          const ScanIcon = SCAN_STATUS_ICONS[c.linkedin_scan_status]?.icon
          return (
            <div key={c.id} className="card p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setViewing(c)}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {c.first_name[0]}{c.last_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{c.first_name} {c.last_name}</p>
                  <p className="text-xs text-gray-500 truncate">{c.title}</p>
                  {c.account_name && <p className="text-xs text-blue-600 truncate">{c.account_name}</p>}
                  {c.email && <p className="text-xs text-gray-400 truncate">{c.email}</p>}
                </div>
                {c.linkedin_url && (
                  <span title={SCAN_STATUS_ICONS[c.linkedin_scan_status]?.label || 'Has LinkedIn'}>
                    {ScanIcon ? <ScanIcon size={14} className={SCAN_STATUS_ICONS[c.linkedin_scan_status].color} /> : <Linkedin size={14} className="text-[#0a66c2] opacity-50" />}
                  </span>
                )}
              </div>
              <div className="mt-3 flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
                <button onClick={() => setEditing(c)} className="text-xs text-gray-500 hover:text-blue-600">Edit</button>
                <button onClick={() => { if(window.confirm('Delete?')) deleteMut.mutate(c.id) }} className="text-xs text-red-400 hover:text-red-600">Delete</button>
              </div>
            </div>
          )
        })}
      </div>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Contact">
        <ContactForm accounts={accounts} onSubmit={createMut.mutate} onCancel={() => setShowModal(false)} isLoading={createMut.isPending} />
      </Modal>
      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Edit Contact">
        {editing && <ContactForm initial={editing} accounts={accounts} onSubmit={data => updateMut.mutate({ id: editing.id, data })} onCancel={() => setEditing(null)} isLoading={updateMut.isPending} />}
      </Modal>
      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} title="Contact Profile" size="lg">
        {contactDetail && <ContactDetail contact={contactDetail} onClose={() => setViewing(null)} />}
      </Modal>
    </div>
  )
}
