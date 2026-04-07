import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { gmailApi } from '../api'
import api from '../api'
import { Mail, CheckCircle2, XCircle, ExternalLink, AlertTriangle, Copy, Check, BookMarked, Kanban, Plus, Trash2, GripVertical, Save } from 'lucide-react'

// Build the LinkedIn bookmarklet JS
function buildBookmarklet(crmUrl) {
  const fn = `(function(){
  try{
    var u=window.location.href;
    if(!u.includes('linkedin.com/in/')){alert('Please navigate to a LinkedIn profile page first.');return;}
    var n=document.querySelector('h1')||document.querySelector('.top-card-layout__title');
    var name=n?n.innerText.trim():'';
    var h=document.querySelector('.text-body-medium,.top-card-layout__headline,.pv-text-details__left-panel h2');
    var headline=h?h.innerText.trim().split('\\n')[0]:'';
    var c=document.querySelector('.pv-text-details__right-panel .hoverable-link-text,.top-card-layout__first-subline');
    var company=c?c.innerText.trim().split('\\n')[0]:'';
    var params=new URLSearchParams({import:'1',name:name,title:headline,company:company,linkedin_url:u});
    window.open('${crmUrl}/deals?'+params.toString(),'_blank');
  }catch(e){alert('Could not extract profile data. Please try again on a LinkedIn profile page.');}
  })()`;
  return 'javascript:' + fn.replace(/\s+/g, ' ');
}

const DEFAULT_STAGES = [
  'Prospecting',
  'Qualification',
  'Proposal',
  'Negotiation',
  'Closed Won',
  'Closed Lost',
]

function PipelineStagesSection() {
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newStage, setNewStage] = useState('')

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
  })

  // Parse stages from settings or use defaults
  const rawStages = settings?.pipeline_stages
  let stages = DEFAULT_STAGES
  try {
    if (rawStages) stages = JSON.parse(rawStages)
  } catch {}

  const [localStages, setLocalStages] = useState(null)
  const displayStages = localStages !== null ? localStages : stages

  // Sync localStages when settings load
  if (localStages === null && rawStages !== undefined && !isLoading) {
    try {
      setLocalStages(rawStages ? JSON.parse(rawStages) : DEFAULT_STAGES)
    } catch { setLocalStages(DEFAULT_STAGES) }
  }

  const saveStages = async () => {
    setSaving(true)
    try {
      await api.put('/settings', { pipeline_stages: JSON.stringify(displayStages) })
      qc.invalidateQueries(['settings'])
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
    setSaving(false)
  }

  const addStage = () => {
    const s = newStage.trim()
    if (!s || displayStages.includes(s)) return
    setLocalStages([...displayStages, s])
    setNewStage('')
  }

  const removeStage = (i) => {
    const next = [...displayStages]
    next.splice(i, 1)
    setLocalStages(next)
  }

  const moveStage = (i, dir) => {
    const next = [...displayStages]
    const j = i + dir
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    setLocalStages(next)
  }

  const resetToDefault = () => setLocalStages([...DEFAULT_STAGES])

  if (isLoading) return <div className="text-sm text-gray-400 py-4">Loading stages...</div>

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Define and order the stages for your pipeline. Changes here update the pipeline board column order.
      </p>

      <div className="space-y-2">
        {displayStages.map((stage, i) => (
          <div key={i} className="flex items-center gap-2 group">
            <div className="flex flex-col gap-0.5">
              <button onClick={() => moveStage(i, -1)} disabled={i === 0} className="text-gray-300 hover:text-gray-500 disabled:opacity-20 leading-none text-xs">▲</button>
              <button onClick={() => moveStage(i, 1)} disabled={i === displayStages.length - 1} className="text-gray-300 hover:text-gray-500 disabled:opacity-20 leading-none text-xs">▼</button>
            </div>
            <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-medium flex-shrink-0">{i + 1}</span>
              <input
                className="flex-1 text-sm bg-transparent border-none outline-none"
                value={stage}
                onChange={e => {
                  const next = [...displayStages]
                  next[i] = e.target.value
                  setLocalStages(next)
                }}
              />
            </div>
            <button onClick={() => removeStage(i)} className="p-1.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Add new stage..."
          value={newStage}
          onChange={e => setNewStage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addStage()}
        />
        <button onClick={addStage} disabled={!newStage.trim()} className="btn-secondary flex items-center gap-1.5">
          <Plus size={14} /> Add
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={saveStages} disabled={saving} className="btn-primary flex items-center gap-2">
          <Save size={14} />
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Stages'}
        </button>
        <button onClick={resetToDefault} className="text-sm text-gray-400 hover:text-gray-600">
          Reset to defaults
        </button>
      </div>
    </div>
  )
}

export default function Settings() {
  const qc = useQueryClient()
  const { data: status, refetch: refetchStatus } = useQuery({ queryKey: ['gmail-status'], queryFn: gmailApi.getStatus })

  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [saving, setSaving] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [bookmarkletCopied, setBookmarkletCopied] = useState(false)

  const crmUrl = window.location.origin
  const bookmarklet = buildBookmarklet(crmUrl)

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

  const copyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarklet).then(() => {
      setBookmarkletCopied(true)
      setTimeout(() => setBookmarkletCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-gray-500">Configure integrations and preferences</p>
      </div>

      {/* Pipeline Stage Management */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Kanban size={20} className="text-blue-500" />
          </div>
          <div>
            <h2 className="font-semibold">Pipeline Stages</h2>
            <p className="text-sm text-gray-500">Manage and reorder your deal pipeline stages</p>
          </div>
        </div>
        <PipelineStagesSection />
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

      {/* LinkedIn Bookmarklet */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#e8f0fe' }}>
            <svg viewBox="0 0 24 24" fill="#0a66c2" className="w-5 h-5">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </div>
          <div>
            <h2 className="font-semibold">LinkedIn Browser Scanner</h2>
            <p className="text-sm text-gray-500">Import deals directly from LinkedIn profiles — no API required</p>
          </div>
        </div>

        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 mb-4">
          <h3 className="text-sm font-semibold text-indigo-900 mb-1">How it works</h3>
          <p className="text-xs text-indigo-700 mb-3">
            Install the bookmarklet below in your browser. When you visit any LinkedIn profile, click it and the deal will be imported directly into your CRM — using <strong>your own browser session</strong>, with no external APIs.
          </p>
          <ol className="text-xs text-indigo-700 space-y-1.5 list-decimal list-inside">
            <li>Drag the button below to your browser bookmarks bar, <em>or</em> copy the code and create a bookmark manually.</li>
            <li>Navigate to any LinkedIn profile in your browser (you must be logged in to LinkedIn).</li>
            <li>Click the bookmarklet — it will open the Add Deal form in your CRM with the profile pre-filled.</li>
            <li>Review the data and click <strong>Save Deal</strong>.</li>
          </ol>
        </div>

        <div className="flex items-center gap-3 mb-3">
          <a
            href={bookmarklet}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-white text-sm font-semibold shadow-sm cursor-grab active:cursor-grabbing select-none"
            style={{ backgroundColor: '#0a66c2' }}
            onClick={e => { e.preventDefault(); alert('Drag this button to your bookmarks bar to install it.') }}
            draggable="true"
          >
            <BookMarked size={15} />
            Import to CRM
          </a>
          <span className="text-xs text-gray-400">← drag this to your bookmarks bar</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyBookmarklet}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            {bookmarkletCopied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
            {bookmarkletCopied ? 'Copied!' : 'Copy bookmarklet code'}
          </button>
          <span className="text-xs text-gray-400">
            Paste as the URL of a new bookmark if drag-drop doesn't work.
          </span>
        </div>

        <div className="mt-4 bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-700">
          <strong>Tip:</strong> The bookmarklet reads name, title/headline, and company from the LinkedIn page DOM.
          It works best when you're logged in to LinkedIn. All data is editable before saving.
        </div>
      </div>

      {/* About */}
      <div className="card p-6">
        <h2 className="font-semibold mb-3">About</h2>
        <div className="text-sm text-gray-600 space-y-1">
          <p className="font-medium">STC Sales Engine v1.0</p>
          <p className="text-gray-500">Built for Seventh Triangle by Claude</p>
          <p className="text-gray-400 text-xs mt-2">Powered by React + Node.js + Supabase (PostgreSQL)</p>
        </div>
      </div>
    </div>
  )
}
