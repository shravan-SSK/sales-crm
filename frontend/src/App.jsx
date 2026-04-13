import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Deals from './pages/Deals'
import Contacts from './pages/Contacts'
import Accounts from './pages/Accounts'
import AccountDetail from './pages/AccountDetail'
import Pipeline from './pages/Pipeline'
import Activities from './pages/Activities'
import Settings from './pages/Settings'
import EmailThreads from './pages/EmailThreads'
import Sources from './pages/Sources'
import DealDetail from './pages/DealDetail'
import Leads from './pages/Leads'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="deals" element={<Deals />} />
          <Route path="deals/:id" element={<DealDetail />} />
          <Route path="leads" element={<Leads />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="accounts/:id" element={<AccountDetail />} />
          <Route path="pipeline" element={<Pipeline />} />
          <Route path="activities" element={<Activities />} />
          <Route path="emails" element={<EmailThreads />} />
          <Route path="sources" element={<Sources />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
