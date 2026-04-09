import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { contactsApi, accountsApi } from '../api'
import { Plus, Pencil, Trash2, Mail, Phone, Search, Upload } from 'lucide-react'
import Modal from '../components/Modal'
import BulkUploadModal from '../components/BulkUploadModal'

function ContactForm({ initial = {}, accounts = [], onSubmit, onCancel, isLoading }) {
  const [form, setForm] = useState({
    first_name: initial.first_name || '',
    last_name: initial.last_name || '',
    email: initial.email || '',
    phone: initial.phone || '',
    account_id: initial.account_id || '',
    title: initial.title || '',
    notes: initial.notes || '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">First Name *</label><input className="input" value={form.first_name} onChange={e => set('first_name', e.target.value)} required /></div>
        <div><label className="label">Last Name</label><input className="input" value={form.last_name} onChange={e => set('last_name', e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
        <div><label className="label">Phone</label><input className="input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Company/Account</label>
          <select className="input" value={form.account_id} onChange={e => set('account_id', e.target.value)}>
            <option value="">No Account</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div><label className="label">Job Title</label><input className="input" value={form.title} onChange={e => set('title', e.target.value)} /></div>
      </div>
      <div><label className="label">Notes</label><textarea className="input" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
      <div className="flex gap-3 justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Contact'}</button>
      </div>
    </form>
  )
}

export default function Contacts() {
  const [showModal, setShowModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const [search, setSearch] = useState('')
  const qc = useQueryClient()

  const { data: contacts = [], isLoading } = useQuery({ queryKey: ['contacts'], queryFn: contactsApi.getAll })
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: accountsApi.getAll })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return contacts
    return contacts.filter(c =>
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.title?.toLowerCase().includes(q) ||
      accounts.find(a => a.id === c.account_id)?.name?.toLowerCase().includes(q)
    )
  }, [contacts, accounts, search])

  const createMut = useMutation({
    mutationFn: contactsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setShowModal(false)
    }
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => contactsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setEditingContact(null)
    }
  })

  const deleteMut = useMutation({
    mutationFn: contactsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    }
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-sm text-gray-500">{contacts.length} contact{contacts.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50" onClick={() => setShowImport(true)}><Upload size={16} /> Import CSV</button>
          <button className="btn-primary flex items-center gap-2" onClick={() => { setEditingContact(null); setShowModal(true) }}><Plus size={16} /> New Contact</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search contacts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Loading contacts...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {contacts.length === 0 ? 'No contacts yet. Create one to get started.' : 'No contacts match your search.'}
        </div>
      ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Phone</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Company/Account</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Job Title</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(contact => {
                const account = accounts.find(a => a.id === contact.account_id)
                return (
                  <tr
                    key={contact.id}
                    onClick={() => setEditingContact(contact)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{contact.first_name} {contact.last_name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {contact.email ? (
                        <a href={`mailto:${contact.email}`} onClick={e => e.stopPropagation()} className="text-blue-600 hover:text-blue-800 flex items-center gap-1">
                          <Mail size={14} />
                          {contact.email}
                        </a>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {contact.phone ? (
                        <a href={`tel:${contact.phone}`} onClick={e => e.stopPropagation()} className="text-blue-600 hover:text-blue-800 flex items-center gap-1">
                          <Phone size={14} />
                          {contact.phone}
                        </a>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{account?.name || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{contact.title || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingContact(contact) }}
                          className="text-blue-600 hover:text-blue-800 p-1"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteMut.mutate(contact.id) }}
                          className="text-red-600 hover:text-red-800 p-1"
                          disabled={deleteMut.isPending}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
      )}
      </div>

      {/* Add Contact Modal */}
      {showImport && <BulkUploadModal type="contacts" onClose={() => setShowImport(false)} onSuccess={() => { qc.invalidateQueries({ queryKey: ['contacts'] }); setShowImport(false) }} />}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Contact" size="lg">
        <ContactForm
          accounts={accounts}
          onSubmit={createMut.mutate} onCancel={() => setShowModal(false)} isLoading={createMut.isPending}
        />
      </Modal>

      {/* Edit Contact Modal */}
      <Modal isOpen={!!editingContact} onClose={() => setEditingContact(null)} title="Edit Contact" size="lg">
        {editingContact && <ContactForm
          initial={editingContact} accounts={accounts}
          onSubmit={data => updateMut.mutate({ id: editingContact.id, data })}
          onCancel={() => setEditingContact(null)} isLoading={updateMut.isPending}
        />}
      </Modal>
    </div>
  )
}
