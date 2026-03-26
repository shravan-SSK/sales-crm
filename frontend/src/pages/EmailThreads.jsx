import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gmailApi } from '../api'
import { Mail, RefreshCw, UserCheck, Users, ExternalLink } from 'lucide-react'
import { useState } from 'react'

export default function EmailThreads() {
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const qc = useQueryClient()

  const { data: status } = useQuery({ queryKey: ['gmail-status'], queryFn: gmailApi.getStatus })
  const { data: threads = [], isLoading } = useQuery({ queryKey: ['gmail-threads'], queryFn: gmailApi.getThreads, enabled: !!status?.connected })

  const sync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const result = await gmailApi.sync({ max_results: 50 })
      setSyncResult(result)
      qc.invalidateQueries(['gmail-threads'])
      qc.invalidateQueries(['leads'])
      qc.invalidateQueries(['dashboard'])
    } catch (e) {
      setSyncResult({ error: e.message })
    }
    setSyncing(false)
  }

  if (!status?.connected) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Email Inbox</h1>
        <div className="card p-12 text-center">
          <Mail size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 mb-2">Gmail not connected</p>
          <p className="text-sm text-gray-400 mb-4">Connect Gmail in <a href="/settings" className="text-blue-600 hover:underline">Settings</a> to auto-import leads from your inbox.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Email Inbox</h1>
          <p className="text-sm text-gray-500">Synced from {status.email}</p>
        </div>
        <button onClick={sync} disabled={syncing} className="btn-primary flex items-center gap-2">
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {syncResult && (
        <div className={`p-4 rounded-lg text-sm ${syncResult.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {syncResult.error ? `Sync error: ${syncResult.error}` :
            `Sync complete: ${syncResult.processed} emails processed, ${syncResult.new_leads} new leads, ${syncResult.new_contacts} new contacts`}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Sender</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Subject</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Mapped To</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={4} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : threads.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-12 text-gray-400">
                <Mail size={28} className="mx-auto mb-2 text-gray-300" />
                No emails synced yet. Click "Sync Now" to import from Gmail.
              </td></tr>
            ) : threads.map(t => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium">{t.sender_name}</p>
                  <p className="text-xs text-gray-500">{t.sender_email}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm truncate max-w-xs">{t.subject}</p>
                  <p className="text-xs text-gray-400 truncate max-w-xs">{t.snippet}</p>
                </td>
                <td className="px-4 py-3">
                  {t.contact_name ? (
                    <span className="flex items-center gap-1 text-sm text-blue-600"><Users size={12} /> {t.contact_name}</span>
                  ) : t.lead_name ? (
                    <span className="flex items-center gap-1 text-sm text-yellow-600"><UserCheck size={12} /> {t.lead_name} (Lead)</span>
                  ) : <span className="text-gray-400 text-sm">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{t.received_at ? new Date(t.received_at).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
