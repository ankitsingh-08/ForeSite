import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Wrench, 
  Package, 
  Cpu, 
  Terminal,
  UserCheck,
  Database
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import Machinery from './components/Machinery';
import Inventory from './components/Inventory';
import AdminConsole from './components/AdminConsole';
import AIAssistant from './components/AIAssistant';
import { DatabaseState, AuditLog } from './types/database';

function App() {
  const [database, setDatabase] = useState<DatabaseState>({
    machines: [],
    inventory: [],
    breakdowns: [],
    procurement: [],
    indents: []
  });
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  
  // Month selector and audit logs
  const [selectedMonth, setSelectedMonth] = useState<string>('cumulative');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [quickQuery, setQuickQuery] = useState<string>('');

  // Fetch functions
  const fetchDatabase = async (month: string) => {
    try {
      const response = await fetch(`/api/database?month=${month}`);
      if (response.ok) {
        const data = await response.json();
        setDatabase(data);
      }
    } catch (e) {
      console.error("Failed to fetch database state:", e);
    }
  };

  const fetchMonths = async () => {
    try {
      const response = await fetch('/api/months');
      if (response.ok) {
        const data = await response.json();
        setAvailableMonths(data);
      }
    } catch (e) {
      console.error("Failed to fetch available months:", e);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const response = await fetch('/api/history');
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data);
      }
    } catch (e) {
      console.error("Failed to fetch audit history:", e);
    }
  };

  // Initial load
  useEffect(() => {
    fetchMonths();
    fetchAuditLogs();
  }, []);

  // Reload database when month selection changes
  useEffect(() => {
    fetchDatabase(selectedMonth);
  }, [selectedMonth]);

  const updateDatabase = async () => {
    // Refresh all state from backend
    await fetchDatabase(selectedMonth);
    await fetchMonths();
    await fetchAuditLogs();
  };


  const getPageTitle = (): string => {
    switch (activeTab) {
      case 'dashboard': return 'Fleet Analytics Dashboard';
      case 'machinery': return 'Machinery & Breakdown Management';
      case 'inventory': return 'Warehouse Parts & Procurement Tracking';
      case 'admin': return 'System Administration Ingest Console';
      case 'terminal': return 'ForeSite AI Assistant Terminal';
      default: return 'ForeSite';
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Cpu className="brand-icon" size={24} />
          <span className="brand-title">ForeSite</span>
        </div>

        <nav className="sidebar-menu">
          <a 
            className={`menu-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </a>
          
          <a 
            className={`menu-item ${activeTab === 'machinery' ? 'active' : ''}`}
            onClick={() => setActiveTab('machinery')}
          >
            <Wrench size={18} />
            <span>Machinery & Logs</span>
          </a>

          <a 
            className={`menu-item ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            <Package size={18} />
            <span>Parts & Procurement</span>
          </a>

          <a 
            className={`menu-item ${activeTab === 'terminal' ? 'active' : ''}`}
            onClick={() => setActiveTab('terminal')}
          >
            <Terminal size={18} style={{ color: 'var(--accent-cyan)' }} />
            <span>AI Assistant</span>
          </a>

          <a 
            className={`menu-item ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            <Database size={18} />
            <span>Data Ingestion</span>
          </a>
        </nav>

        <div className="sidebar-footer">
          <UserCheck size={16} style={{ color: 'var(--accent-cyan)' }} />
          <span>Admin Console (SQL Mode)</span>
        </div>
      </aside>

      {/* Main Viewport */}
      <main className="main-viewport">
        {/* Top Header Bar */}
        <header className="top-bar">
          <h2 className="page-title">{getPageTitle()}</h2>
          <div className="top-bar-actions">
            {/* Reporting Month Selection */}
            <div style={{ display: 'flex', alignItems: 'center', marginRight: 16 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginRight: 8 }}>Period:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  padding: '4px 8px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="cumulative">Cumulative / Overall</option>
                {availableMonths.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Server Time: <strong style={{ color: 'var(--text-primary)' }}>{new Date().toLocaleDateString()}</strong>
            </span>
            <span className="status-badge operating" style={{ fontSize: '0.7rem' }}>
              SQL ONLINE
            </span>
          </div>
        </header>

        {/* Content Body Container */}
        <div className="content-body">
          {activeTab === 'dashboard' && (
            <Dashboard 
              database={database} 
              setActiveTab={setActiveTab} 
              onQuickQuery={(query) => {
                setQuickQuery(query);
                setActiveTab('terminal');
              }}
            />
          )}

          {activeTab === 'machinery' && (
            <Machinery 
              database={database} 
            />
          )}

          {activeTab === 'inventory' && (
            <Inventory 
              database={database} 
            />
          )}

          {activeTab === 'terminal' && (
            <AIAssistant
              database={database}
              quickQuery={quickQuery}
              setQuickQuery={setQuickQuery}
            />
          )}

          {activeTab === 'admin' && (
            <AdminConsole 
              updateDatabase={updateDatabase}
              auditLogs={auditLogs}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
