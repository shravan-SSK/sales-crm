import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { contactsApi, accountsApi } from '../api'
import { Plus, Search, Users, Linkedin, Trash2, ChevronRight, ExternalLink } from 'lucide-react'
import Modal from '../components/Modal'

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
      <div><label className="label">LinkedIn URL</label>
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

function ContactDetail({ contact, onClose }) {
  const qc = useQueryClient()
  const [linkedinUrl, setLinkedinUrl] = useState(contact.linkedin_url || '')
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)

  const scanLinkedIn = async () => {
    if (!linkedinUrl) return
    setScanning(true)
    try {
      const result = await contactsApi.scanLinkedIn(contact.id, linkedinUrl)
      setScanResult(result.profile)
      qc.invalidateQueries(['contacts'])
    } catch (e) {
      setScanResult({ error: e.message })
    }
    setScanning(false)
  }

  const profile = contact.linkedin_data || scanResult

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl font-bold">
          {contact.first_name[0]}{contact.last_name[0]}
        </div>
        <div>
          <h3 className="text-lg font-semibold">{contact.first_name} {contact.last_name}</h3>
          <p className="text-sm text-gray-500">{contact.title} {contact.account_name ? `@ ${contact.account_name}` : ''}</p>
          <p className="text-sm text-blue-600">{contact.email}</p>
        </div>
      </div>

      {/* LinkedIn */}
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Linkedin size={16} className="text-blue-600" />
          <span className="text-sm font-medium">LinkedIn Profile</span>
        </div>
        <div className="flex gap-2">
          <input
            className="input flex-1 text-sm"
            placeholder="https://linkedin.com/in/username"
            value={linkedinUrl}
            onChange={e => setLinkedinUrl(e.target.value)}
          />
          <button onClick={scanLinkedIn} disabled={scanning || !linkedinUrl} className="btn-primary text-sm whitespace-nowrap">
            {scanning ? 'Scanning...' : 'Scan Profile'}
          </button>
        </div>
        {profile && !profile.error && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg">
            {profile.image && <img src={profile.image} alt="" className="w-10 h-10 rounded-full mb-2" />}
            {profile.name && <p className="text-sm font-medium">{profile.name}</p>}
            {profile.headline && <p className="text-sm text-gray-600">{profile.headline}</p>}
            {profile.company && <p className="text-xs text-gray-500">@ {profile.company}</p>}
            {profile.scraped_at && <p className="text-xs text-gray-400 mt-1">Scanned {new Date(profile.scraped_at).toLocaleDateString()}</p>}
          </div>
        )}
        {profile?.error && <p className="mt-2 text-xs text-red-500">{profile.note || profile.error}</p>}
      </div>

      {/* Deals */}
      {contact.deals?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Associated Deals</h4>
          <div className="space-y-2">
            {contact.deals.map(d => (
              <div key={d.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg text-sm">
                <span>{d.name}</span>
                <span className="text-green-600 font-medium">${d.value?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activities */}
      {contact.activities?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2">Recent Activities</h4>
          <div className="space-y-1">
            {contact.activities.slice(0, 5).map(act => (
              <div key={act.id} className="flex items-center gap-2 text-sm text-gray-600 py-1 border-b border-gray-100">
                <span className="text-gray-400">{act.type}</span>
                <span>{act.subject}</span>
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
            <Users size={32} className="mx-auto mb-2 text-gray-300" />
            No contacts yet.
          </div>
        ) : contacts.map(c => (
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
              {c.linkedin_url && <Linkedin size={14} className="text-blue-400 flex-shrink-0" />}
            </div>
            <div className="mt-3 flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
              <button onClick={() => setEditing(c)} className="text-xs text-gray-500 hover:text-blue-600">Edit</button>
              <button onClick={() => { if(window.confirm('Delete?')) deleteMut.mutate(c.id) }} className="text-xs text-red-400 hover:text-red-600">Delete</button>
            </div>
          </div>
        ))}
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
