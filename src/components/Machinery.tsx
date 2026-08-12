import { useState } from 'react';
import { Wrench, Clock, MapPin, DollarSign, Shield } from 'lucide-react';
import { DatabaseState } from '../types/database';

interface MachineryProps {
  database: DatabaseState;
}

const Machinery = ({ database }: MachineryProps) => {
  const { machines = [], inventory = [], breakdowns = [] } = database;
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterSite, setFilterSite] = useState('All');

  const resolveMachineName = (id: string) => {
    const mac = machines.find(m => m.id === id);
    return mac ? mac.name : id;
  };

  const resolvePartName = (id: string) => {
    const part = inventory.find(p => p.partId === id);
    return part ? part.name : id;
  };

  // Get list of unique sites for filters
  const uniqueSites = Array.from(new Set(machines.map(m => m.siteName || "Default Site"))).filter(Boolean);

  const filteredMachines = machines.filter(m => {
    const matchesStatus = filterStatus === 'All' || m.status === filterStatus;
    const matchesSite = filterSite === 'All' || (m.siteName || "Default Site") === filterSite;
    return matchesStatus && matchesSite;
  });

  return (
    <div>
      {/* Fleet Controls */}
      <div className="panel-header" style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        {/* Status filters */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['All', 'Operating', 'Breakdown', 'Maintenance'].map(status => (
            <button
              key={status}
              className={`btn ${filterStatus === status ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.85rem' }}
              onClick={() => setFilterStatus(status)}
            >
              {status} ({status === 'All' ? machines.length : machines.filter(m => m.status === status).length})
            </button>
          ))}
        </div>

        {/* Site Filter Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Filter by Site:</span>
          <select
            value={filterSite}
            onChange={(e) => setFilterSite(e.target.value)}
            style={{
              backgroundColor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '4px',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              padding: '6px 12px',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="All">All Operating Sites</option>
            {uniqueSites.map(site => (
              <option key={site} value={site}>{site}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Machinery Fleet Profiles */}
      <div className="glass-panel" style={{ marginBottom: 28 }}>
        <div className="panel-header">
          <h3 className="panel-title">🚚 Machinery Fleet Status, Deployments & Costs</h3>
        </div>
        <div className="table-container">
          {filteredMachines.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No rigs match the selected status/site filters.</p>
          ) : (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Machine ID</th>
                  <th>Location (Site)</th>
                  <th>Hour Meter / Working</th>
                  <th>Fuel & Stoppage</th>
                  <th>Uptime (Availability)</th>
                  <th>Operating Cost</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredMachines.map(m => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.id}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{m.type}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 'bold' }}>
                        <MapPin size={12} style={{ color: 'var(--accent-cyan)' }} />
                        {m.siteName || "Default Site"}
                      </div>
                    </td>
                    <td>
                      <div>Hour Meter: <strong>{m.hourMeter} hrs</strong></div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Working: {m.workingHours} hrs</div>
                    </td>
                    <td>
                      {m.engineOperated ? (
                        <div>Fuel: <strong>{m.fuelRate} L/h</strong></div>
                      ) : (
                        <div style={{ color: 'var(--accent-cyan)', fontSize: '0.8rem' }}>Electric Motor</div>
                      )}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Idle: {m.idleHours || 0} hrs | BD: {m.breakdownHours || 0} hrs
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Shield size={12} style={{ color: (m.availability ?? 100) > 95 ? 'var(--accent-emerald)' : 'var(--accent-amber)' }} />
                        <strong>{m.availability ?? 100}%</strong>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Maint: {m.maintenanceHours || 0} hrs
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontWeight: 'bold' }}>
                        <DollarSign size={12} style={{ color: 'var(--accent-indigo)' }} />
                        {(m.totalExpense ?? 0).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Spares: ${(m.itemExpense ?? 0).toLocaleString()} | Fuel: ${(m.fuelExpense ?? 0).toLocaleString()}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${m.status.toLowerCase()}`}>
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Breakdown Incident Logs */}
      <div className="glass-panel">
        <div className="panel-header">
          <h3 className="panel-title" style={{ color: 'var(--accent-rose)' }}>
            <Wrench size={18} /> Historic Breakdown Incident Register
          </h3>
        </div>
        <div className="table-container">
          {breakdowns.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No breakdown incidents logged.</p>
          ) : (
            <table className="custom-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Machine</th>
                  <th>Part Replaced</th>
                  <th>Downtime</th>
                  <th>Severity</th>
                  <th>Filing Date</th>
                  <th>Fault Reason</th>
                </tr>
              </thead>
              <tbody>
                {breakdowns.map(b => (
                  <tr key={b.id}>
                    <td><strong>{b.id}</strong></td>
                    <td>{resolveMachineName(b.machineId)}</td>
                    <td>{resolvePartName(b.partId)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} style={{ color: 'var(--accent-rose)' }} /> {b.downHours} hrs
                      </div>
                    </td>
                    <td>
                      <span
                        className="status-badge"
                        style={{
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          backgroundColor: b.severity === 'Critical' ? 'rgba(244,63,94,0.2)' : 'rgba(245,158,11,0.15)',
                          color: b.severity === 'Critical' ? 'var(--accent-rose)' : 'var(--accent-amber)',
                          borderColor: b.severity === 'Critical' ? 'rgba(244,63,94,0.4)' : 'rgba(245,158,11,0.3)'
                        }}
                      >
                        {b.severity}
                      </span>
                    </td>
                    <td>{b.date}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{b.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Machinery;
