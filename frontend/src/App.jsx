import React, { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Overview from './pages/Overview'
import EDA from './pages/EDA'
import ModelLab from './pages/ModelLab'
import ComparisonLab from './pages/ComparisonLab'
import DeploymentLab from './pages/DeploymentLab'
import { healthCheck } from './utils/api'

export default function App() {
  const [serverStatus, setServerStatus] = useState('connecting')

  useEffect(() => {
    const check = () => {
      healthCheck()
        .then(() => setServerStatus('online'))
        .catch(() => setServerStatus('offline'))
    }
    check()
    const interval = setInterval(check, 10000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="layout">
      <Sidebar serverStatus={serverStatus} />
      <main className="main-content">
        {serverStatus === 'offline' && (
          <div className="alert alert-warn" style={{ marginBottom: 24 }}>
            <span>⚠</span>
            <div>
              Backend server is not responding. EDA and Overview work in offline mode with static data.
              To enable full features: <code style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: 4,
              }}>uvicorn main:app --reload</code>
            </div>
          </div>
        )}
        <Routes>
          <Route path="/overview"   element={<Overview />} />
          <Route path="/"           element={<EDA />} />
          <Route path="/model"      element={<ModelLab />} />
          <Route path="/comparison" element={<ComparisonLab />} />
          <Route path="/deploy"     element={<DeploymentLab />} />
        </Routes>
      </main>
    </div>
  )
}