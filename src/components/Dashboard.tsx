import {
  Wrench,
  Activity,
  Droplet,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  MapPin
} from 'lucide-react';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { DatabaseState } from '../types/database';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

interface DashboardProps {
  database: DatabaseState;
  setActiveTab: (tab: string) => void;
  onQuickQuery: (query: string) => void;
}

const Dashboard = ({ database, setActiveTab, onQuickQuery }: DashboardProps) => {
  const { machines = [], inventory = [], breakdowns = [] } = database;

  // Calculations
  const totalMachines = machines.length;
  const activeBreakdowns = machines.filter(m => m.status === 'Breakdown').length;
  const underMaintenance = machines.filter(m => m.status === 'Maintenance').length;

  // Average Uptime / Availability across the fleet
  const avgUptime = totalMachines > 0 
    ? (machines.reduce((sum, m) => sum + (m.availability ?? 100), 0) / totalMachines).toFixed(1)
    : "100.0";

  // Total cumulative telemetry rates
  const totalFuelRate = machines
    .filter(m => m.status === 'Operating' && m.engineOperated)
    .reduce((sum, m) => sum + (m.fuelRate ?? 0), 0);

  // Financial aggregates
  const totalExpenses = machines.reduce((sum, m) => sum + (m.totalExpense ?? 0), 0);
  const totalItemExpenses = machines.reduce((sum, m) => sum + (m.itemExpense ?? 0), 0);
  const totalFuelExpenses = machines.reduce((sum, m) => sum + (m.fuelExpense ?? 0), 0);

  // Group machines by Operating Site
  const siteMachineCount: Record<string, { total: number; operating: number; breakdown: number }> = {};
  machines.forEach(m => {
    const site = m.siteName || "Default Site";
    if (!siteMachineCount[site]) {
      siteMachineCount[site] = { total: 0, operating: 0, breakdown: 0 };
    }
    siteMachineCount[site].total++;
    if (m.status === 'Operating') siteMachineCount[site].operating++;
    if (m.status === 'Breakdown') siteMachineCount[site].breakdown++;
  });



  // Chart 2: Fuel Rate vs Productivity (slice to top 20 for graph layout readability if database is large)
  const dieselMachines = machines.filter(m => m.engineOperated).slice(0, 20);
  const fuelVsProductivityData = {
    labels: dieselMachines.map(m => m.id),
    datasets: [
      {
        label: 'Productivity (%)',
        data: dieselMachines.map(m => m.productivity),
        backgroundColor: 'rgba(16, 185, 129, 0.6)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 1,
        yAxisID: 'y',
      },
      {
        label: 'Fuel Consumption (L/h)',
        data: dieselMachines.map(m => m.fuelRate),
        backgroundColor: 'rgba(6, 182, 212, 0.6)',
        borderColor: 'rgb(6, 182, 212)',
        borderWidth: 1,
        yAxisID: 'y1',
      }
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#94a3b8',
          font: { family: 'Inter' }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { family: 'Inter' } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { family: 'Inter' } }
      }
    }
  };

  const multiAxisOptions = {
    ...chartOptions,
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8' }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#10b981' },
        title: { display: true, text: 'Productivity %', color: '#10b981' }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        grid: { drawOnChartArea: false },
        ticks: { color: '#06b6d4' },
        title: { display: true, text: 'Fuel Rate L/h', color: '#06b6d4' }
      }
    }
  };

  const activeDownMachines = machines.filter(m => m.status === 'Breakdown');
  const criticalLowInventory = inventory.filter(p => p.quantity <= p.minVal);

  return (
    <div>
      {/* Critical Stock Alert Bar */}
      {criticalLowInventory.length > 0 && (
        <div className="stock-alert-bar" style={{ marginBottom: 20 }}>
          <div className="alert-message">
            <AlertTriangle size={18} />
            <span>
              <strong>Inventory Alert:</strong> {criticalLowInventory.length} store items are at or below minimum threshold levels.
            </span>
          </div>
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            onClick={() => setActiveTab('inventory')}
          >
            Review Inventory
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="kpi-grid" style={{ marginBottom: 24 }}>
        <div className="glass-panel kpi-card">
          <div className="kpi-icon-wrapper accent-cyan-bg">
            <Activity size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{avgUptime}%</span>
            <span className="kpi-label">Fleet Availability</span>
          </div>
        </div>

        <div className="glass-panel kpi-card">
          <div className="kpi-icon-wrapper accent-rose-bg">
            <Wrench size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{activeBreakdowns}</span>
            <span className="kpi-label">Active Breakdowns</span>
          </div>
        </div>

        <div className="glass-panel kpi-card">
          <div className="kpi-icon-wrapper accent-amber-bg">
            <TrendingUp size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{underMaintenance}</span>
            <span className="kpi-label">In Maintenance</span>
          </div>
        </div>

        <div className="glass-panel kpi-card">
          <div className="kpi-icon-wrapper accent-emerald-bg">
            <Droplet size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{totalFuelRate.toFixed(1)} L/h</span>
            <span className="kpi-label">Fuel Burn Rate</span>
          </div>
        </div>
      </div>

      {/* Finance and Sites Aggregates Card */}
      <div className="kpi-grid" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <div className="glass-panel kpi-card" style={{ borderLeft: '3px solid var(--accent-indigo)' }}>
          <div className="kpi-icon-wrapper" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--accent-indigo)' }}>
            <DollarSign size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">${totalExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            <span className="kpi-label">Total Fleet Expenses</span>
          </div>
        </div>
        <div className="glass-panel kpi-card">
          <div className="kpi-info">
            <span className="kpi-value" style={{ fontSize: '1.25rem' }}>${totalItemExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            <span className="kpi-label">Maintenance & Spares Expense</span>
          </div>
        </div>
        <div className="glass-panel kpi-card">
          <div className="kpi-info">
            <span className="kpi-value" style={{ fontSize: '1.25rem' }}>${totalFuelExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            <span className="kpi-label">Diesel Fuel Expense</span>
          </div>
        </div>
      </div>

      {/* Charts & Sites Layout Grid */}
      <div className="dashboard-grid-2" style={{ marginBottom: 24 }}>
        <div className="glass-panel">
          <div className="panel-header">
            <h3 className="panel-title">
              <Droplet size={18} className="brand-icon" /> Diesel Telemetry: Productivity vs Fuel Rate
            </h3>
          </div>
          <div style={{ height: '300px', position: 'relative' }}>
            {machines.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: 100 }}>No telemetry records available</p>
            ) : (
              <Bar data={fuelVsProductivityData} options={multiAxisOptions as any} />
            )}
          </div>
        </div>

        {/* Operating Sites Table */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header">
            <h3 className="panel-title">
              <MapPin size={18} className="brand-icon" style={{ color: 'var(--accent-cyan)' }} /> Active Site Deployments ({Object.keys(siteMachineCount).length})
            </h3>
          </div>
          <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
            {Object.keys(siteMachineCount).length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: 80 }}>No site records parsed</p>
            ) : (
              <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Site Location Name</th>
                    <th>Rigs Deployed</th>
                    <th>Operating</th>
                    <th>Outages (BD)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(siteMachineCount).map(([siteName, metrics]) => (
                    <tr key={siteName}>
                      <td><strong>{siteName}</strong></td>
                      <td>{metrics.total}</td>
                      <td style={{ color: 'var(--accent-emerald)', fontWeight: 'bold' }}>{metrics.operating}</td>
                      <td style={{ color: metrics.breakdown > 0 ? 'var(--accent-rose)' : 'inherit', fontWeight: metrics.breakdown > 0 ? 'bold' : 'normal' }}>
                        {metrics.breakdown}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Lists Summary Grid */}
      <div className="dashboard-grid-equal" style={{ marginBottom: 24 }}>
        {/* Active Breakdowns */}
        <div className="glass-panel">
          <div className="panel-header">
            <h3 className="panel-title" style={{ color: 'var(--accent-rose)' }}>
              🚨 Active Outage Register ({activeDownMachines.length})
            </h3>
            <button
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
              onClick={() => setActiveTab('machinery')}
            >
              Manage Fleet
            </button>
          </div>
          {activeDownMachines.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>All machinery fully operational. No active outages.</p>
          ) : (
            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Machine</th>
                    <th>Failure Reason</th>
                    <th>Downtime</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDownMachines.map(m => {
                    const latestBd = breakdowns.find(b => b.machineId === m.id);
                    return (
                      <tr key={m.id}>
                        <td>
                          <strong>{m.id}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.model}</div>
                        </td>
                        <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {latestBd ? latestBd.reason : 'Unspecified Outage'}
                        </td>
                        <td>{m.breakdownHours} hrs</td>
                        <td>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            onClick={() => onQuickQuery(`Why did ${m.id} break down?`)}
                          >
                            Diagnose
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Warehouse Inventory Alerts */}
        <div className="glass-panel">
          <div className="panel-header">
            <h3 className="panel-title" style={{ color: 'var(--accent-amber)' }}>
              ⚠️ Low Stock Items ({criticalLowInventory.length})
            </h3>
            <button
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.8rem' }}
              onClick={() => setActiveTab('inventory')}
            >
              Order Parts
            </button>
          </div>
          {criticalLowInventory.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>All warehouse stock levels healthy.</p>
          ) : (
            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Part ID</th>
                    <th>Name</th>
                    <th>Qty</th>
                    <th>Min/Max</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {criticalLowInventory.slice(0, 4).map(p => (
                    <tr key={p.partId}>
                      <td><strong>{p.partId}</strong></td>
                      <td>{p.name}</td>
                      <td style={{ color: p.quantity === 0 ? 'var(--accent-rose)' : 'var(--accent-amber)', fontWeight: 'bold' }}>
                        {p.quantity}
                      </td>
                      <td>{p.minVal} / {p.maxVal}</td>
                      <td>
                        <span className={`status-badge ${p.quantity === 0 ? 'breakdown' : 'maintenance'}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                          {p.quantity === 0 ? 'Out' : 'Low'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
