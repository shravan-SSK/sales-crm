import { useState, useRef } from 'react'
import { X, Upload, Download, CheckCircle, AlertCircle } from 'lucide-react'
import { importApi } from '../api'

const CONFIGS = {
  deals: {
    label: 'Deals',
    apiMethod: 'importPipeline',
    columns: ['name', 'stage', 'value', 'probability', 'close_date', 'source', 'notes'],
    required: ['name'],
    hints: { stage: 'lead|qualified|proposal|negotiation|closed_won', value: 'number', probability: '0-100', close_date: 'YYYY-MM-DD' },
  },
  contacts: {
    label: 'Contacts',
    apiMethod: 'importContacts',
    columns: ['first_name', 'last_name', 'email', 'phone', 'title', 'linkedin_url', 'notes'],
    required: ['first_name', 'last_name'],
    hints: {},
  },
  accounts: {
    label: 'Accounts',
    apiMethod: 'importAccounts',
    columns: ['name', 'website', 'industry', 'company_size', 'phone', 'address', 'notes'],
    required: ['name'],
    hints: {},
  },
  sources: {
    label: 'Sources',
    apiMethod: 'importSources',
    columns: ['name', 'color', 'is_active'],
    required: ['name'],
    hints: { color: 'hex e.g. #3B82F6', is_active: '1 or 0' },
  },
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).map(line => {
    const vals = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    vals.push(cur.trim())
    const obj = {}
    headers.forEach((h, i) => { obj[h] = vals[i] !== undefined ? vals[i] : '' })
    return obj
  }).filter(r => Object.values(r).some(v => v !== ''))
  return { headers, rows }
}

export default function BulkUploadModal({ type, onClose, onSuccess }) {
  const cfg = CONFIGS[type]
  const [step, setStep] = useState('upload')
  const [parsed, setParsed] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const downloadTemplate = () => {
    const csv = cfg.columns.join(',') + '\n' + cfg.columns.map(c => cfg.hints[c] || '').join(',')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = type + '-template.csv'
    a.click()
  }

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const { headers, rows } = parseCSV(ev.target.result)
      const missing = cfg.required.filter(r => !headers.includes(r))
      if (missing.length) {
        setError('Missing required columns: ' + missing.join(', '))
        setParsed(null)
      } else {
        setError(null)
        setParsed({ headers, rows })
        setStep('preview')
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!parsed) return
    setImporting(true)
    setError(null)
    try {
      const res = await importApi[cfg.apiMethod](parsed.rows)
      setResult(res)
      setStep('done')
      if (onSuccess) onSuccess()
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Import {cfg.label} via CSV</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {step === 'upload' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">Upload a CSV file with your {cfg.label.toLowerCase()} data. Required columns: <span className="font-medium text-gray-800">{cfg.required.join(', ')}</span></p>
                <button onClick={downloadTemplate} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50">
                  <Download className="w-4 h-4" /> Template
                </button>
              </div>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-indigo-300 transition-colors">
                <Upload className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 mb-3">Drag and drop or click to select a CSV file</p>
                <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
                <button onClick={() => fileRef.current?.click()} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Choose CSV File</button>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-medium text-gray-600 mb-2">Expected columns:</p>
                <div className="flex flex-wrap gap-2">
                  {cfg.columns.map(col => (
                    <span key={col} className={`text-xs px-2 py-1 rounded-full ${cfg.required.includes(col) ? 'bg-indigo-100 text-indigo-700 font-medium' : 'bg-gray-100 text-gray-600'}`}>
                      {col}{cfg.required.includes(col) ? ' *' : ''}{cfg.hints[col] ? ' (' + cfg.hints[col] + ')' : ''}
                    </span>
                  ))}
                </div>
              </div>
              {error && <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}</div>}
            </div>
          )}

          {step === 'preview' && parsed && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600"><span className="font-semibold text-gray-900">{parsed.rows.length}</span> records found. Review before importing.</p>
                <button onClick={() => { setStep('upload'); setParsed(null); if (fileRef.current) fileRef.current.value = '' }} className="text-sm text-gray-500 hover:text-gray-700">Change file</button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>{parsed.headers.map(h => <th key={h} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsed.rows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {parsed.headers.map(h => <td key={h} className="px-3 py-2 text-gray-700 max-w-[150px] truncate">{row[h]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.rows.length > 10 && <div className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">+{parsed.rows.length - 10} more rows not shown</div>}
              </div>
              {error && <div className="flex items-start gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}</div>}
            </div>
          )}

          {step === 'done' && result && (
            <div className="text-center py-6 space-y-3">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              <h3 className="text-lg font-semibold text-gray-900">Import Complete!</h3>
              <p className="text-sm text-gray-600">
                {result.imported !== undefined ? result.imported : parsed?.rows?.length} {cfg.label.toLowerCase()} imported successfully.
                {result.errors?.length ? ` ${result.errors.length} rows had errors.` : ''}
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            {step === 'done' ? 'Close' : 'Cancel'}
          </button>
          {step === 'preview' && (
            <button onClick={handleImport} disabled={importing} className="px-5 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {importing ? 'Importing…' : `Import ${parsed?.rows?.length ?? ''} Records`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
