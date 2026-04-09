import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { accountsApi } from '../api'
import { Plus, Search, Building2, Trash2, Pencil, Globe } from 'lucide-react'
import Modal from '../components/Modal'

const INDUSTRIES = ['Technology','Finance','Healthcare','Retail','Manufacturing','Education','Real Estate','Consulting','Media','Other']

function AccountForm({ initial = {}, onSubmit, onCancel, isLoading }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    website: initial.website || '',
    industry: initial.industry || '',
    company_size: initial.company_size || '',
    phone: initial.phone || '',
    address: initial.address || '',
    notes: initial.notes || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
      <div><label className="label">Account Name *</label><input className="input" value={form.name} onChange={e => set('name', e.target.value)} required /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Website</label><input className="input" placeholder="https://..." value={form.website} onChange={e => set('website', e.target.value)} /></div>
        <div><label className="label">Industry</label>
          <select className="input" value={form.industry} onChange={e => set('industry', e.target.value)}>
            <option value="">Select Industry</option>
            {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label">Company Size</label>
          <select className="input" value={form.company_size} onChange={e => set('company_size', e.target.value)}>
            <option value="">Select Size</option>
            <option>1-10</option><option>11-50</option><option>51-200</option>
            <option>201-1000</option><option>1000+</option>
          </select>
        </div>
        <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
      </div>
      <div><label className="label">Address</label><input className="input" value={form.address} onChange={e => set('address', e.target.value)} /></div>
      <div><label className="label">Notes</label><textarea className="input" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
      <div className="flex gap-3 justify-end">
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Account'}</button>
      </div>
    </form>
  )
}

export default function Accounts() {
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts', search],
    queryFn: () => accountsApi.getAll({ search }),
  })

  const createMut = useMutation({
    mutationFn: accountsApi.create,
    onSuccess: () => { qc.invalidateQueries(['accounts']); qc.invalidateQueries(['dashboard']); setShowModal(false) }
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }) => accountsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries(['accounts']); setEditing(null) }
  })
  const deleteMut = useMutation({
    mutationFn: accountsApi.delete,
    onSuccess: () => { qc.invalidateQueries(['accounts']); qc.invalidateQueries(['dashboard']) }
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Accounts</h1><p className="text-sm text-gray-500">{accounts.length} accounts</p></div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowModal(true)}><Plus size={16} /> Add Account</button>
      </div>
      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accounts..." className="input pl-8" />
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Account</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Industry</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Contacts</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Deals</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Pipeline</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : accounts.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">
                <Building2 size={32} className="mx-auto mb-2 text-gray-300" />
                No accounts yet.
              </td></tr>
            ) : accounts.map(acc => (
              <tr
                key={acc.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate('/accounts/' + acc.id)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-green-100 text-green-600 flex items-center justify-center font-bold text-sm">
                      {acc.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{acc.name}</p>
                      {acc.website && (
                        <a href={acc.website} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-500 flex items-center gap-1"
                          onClick={e => e.stopPropagation()}>
                          <Globe size={10} /> {acc.website.replace(/https?:\/\//,'')}
                        </a>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{acc.industry || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{acc.contact_count}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{acc.deal_count}</td>
                <td className="px-4 py-3 text-sm font-medium text-green-600">${(acc.pipeline_value || 0).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={e => { e.stopPropagation(); setEditing(acc) }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); if(window.confirm('Delete this account?')) deleteMut.mutate(acc.id) }}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Account">
        <AccountForm onSubmit={createMut.mutate} onCancel={() => setShowModal(false)} isLoading={createMut.isPending} />
      </Modal>
      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Edit Account">
        {editing && <AccountForm initial={editing} onSubmit={data => updateMut.mutate({ id: editing.id, data })} onCancel={() => setEditing(null)} isLoading={updateMut.isPending} />}
      </Modal>
    </div>
  )
}
