import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gmailApi } from '../api'
import { Mail, CheckCircle2, XCircle, ExternalLink, AlertTriangle } from 'lucide-react'

export default function Settings() {
  const qc = useQueryClient()
  const { data: status, refetch: refetchStatus } = useQuery({ queryKey: ['gmail-status'], queryFn: gmailApi.getStatus })

  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const saveCreds = async () => {
    setSaving(true)
    try {
      await gmailApi.saveCredentials({ client_id: clientId, client_secret: clientSecret })
      setMessage({ type: 'success', text: 'Credentials saved. Now click "Connect Gmail".' })
      refetchStatus()
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.error || e.message })
    }
    setSaving(false)
  }

  const connectGmail = async () => {
    setAuthLoading(true)
    try {
      const { url } = await gmailApi.getAuthUrl()
      const popup = window.open(url, '_blank', 'width=500,height=600')
      // Poll for popup close
      const interval = setInterval(() => {
        if (popup.closed) {
          clearInterval(interval)
          refetchStatus()
          qc.invalidateQueries(['gmail-status'])
          setAuthLoading(false)
        }
      }, 500)
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.error || e.message })
      setAuthLoading(false)
    }
  }

  const disconnect = async () => {
    if (!window.confirm('Disconnect Gmail?')) return
    await gmailApi.disconnect()
    qc.invalidateQueries(['gmail-status'])
    refetchStatus()
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-gray-500">Configure integrations and preferences</p>
      </div>

      {/* Gmail Integration */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
            <Mail size={20} className="text-red-500" />
          </div>
          <div>
            <h2 className="font-semibold">Gmail Integration</h2>
            <p className="text-sm text-gray-500">Auto-import leads and contacts from your inbox</p>
          </div>
          <div className="ml-auto">
            {status?.connected ? (
              <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                <CheckCircle2 size={16} /> Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-gray-400">
                <XCircle size={16} /> Not connected
              </span>
            )}
          </div>
        </div>

        {status?.connected ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-700">Connected as <strong>{status.email}</strong></p>
              <p className="text-xs text-green-600 mt-1">Go to Email Inbox to sync messages and auto-create leads.</p>
            </div>
            <button onClick={disconnect} className="btn-secondary text-red-600 border-red-300 hover:bg-red-50">
              Disconnect Gmail
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
              <p className="font-medium text-blue-800 mb-2">Setup Instructions</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-700 text-xs">
                <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></li>
                <li>Create a new project (or select existing)</li>
                <li>Enable the Gmail API</li>
                <li>Create OAuth 2.0 credentials (Desktop/Web App)</li>
                <li>Add <code className="bg-blue-100 px-1 rounded">http://localhost:3001/api/gmail/callback</code> as an authorized redirect URI</li>
                <li>Copy Client ID and Client Secret below</li>
              </ol>
            </div>

            {!status?.configured && (
              <div className="space-y-4">
                <div>
                  <label className="label">Google OAuth Client ID</label>
                  <input className="input" placeholder="xxxxx.apps.googleusercontent.com" value={clientId} onChange={e => setClientId(e.target.value)} />
                </div>
                <div>
                  <label className="label">Google OAuth Client Secret</label>
                  <input className="input" type="password" placeholder="GOCSPX-..." value={clientSecret} onChange={e => setClientSecret(e.target.value)} />
                </div>
                <button onClick={saveCreds} disabled={saving || !clientId || !clientSecret} className="btn-primary">
                  {saving ? 'Saving...' : 'Save Credentials'}
                </button>
              </div>
            )}

            {status?.configured && (
              <button onClick={connectGmail} disabled={authLoading} className="btn-primary flex items-center gap-2">
                <Mail size={16} />
                {authLoading ? 'Opening auth window...' : 'Connect Gmail'}
              </button>
            )}
          </div>
        )}

        {message && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}
      </div>

      {/* LinkedIn Note */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-blue-600">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </div>
          <div>
            <h2 className="font-semibold">LinkedIn Profile Scanner</h2>
            <p className="text-sm text-gray-500">Enrich contact profiles from LinkedIn</p>
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
          <AlertTriangle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-700">
            <p className="font-medium">Public profile data only</p>
            <p className="text-xs mt-1">The LinkedIn scanner extracts publicly available info (name, headline, company) from profile URLs. For full enrichment, consider a service like <a href="https://nubela.co/proxycurl" target="_blank" rel="noopener noreferrer" className="underline">Proxycurl API</a> which provides authenticated access to LinkedIn data.</p>
            <p className="text-xs mt-1">To scan a contact, open their profile from the Contacts page and paste their LinkedIn URL.</p>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="card p-6">
        <h2 className="font-semibold mb-3">About</h2>
        <div className="text-sm text-gray-600 space-y-1">
          <p>Sales CRM v1.0</p>
          <p>Built with React + Node.js + SQLite</p>
          <p className="text-gray-400 text-xs mt-2">Database stored at: <code>backend/crm.db</code></p>
        </div>
      </div>
    </div>
  )
}
