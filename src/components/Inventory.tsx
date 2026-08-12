import { useState } from 'react';
import { Package, ShoppingBag, Send, CheckCircle2 } from 'lucide-react';
import { DatabaseState } from '../types/database';

interface InventoryProps {
  database: DatabaseState;
  updateDatabase?: <K extends keyof DatabaseState>(key: K, data: DatabaseState[K]) => void;
}

const Inventory = ({ database }: InventoryProps) => {
  const { inventory, procurement, indents } = database;
  const [activeSubTab, setActiveSubTab] = useState<'stock' | 'procurement' | 'indents'>('stock');

  // Stepper helper for Procurement pipeline tracker
  const getPipelineProgress = (status: string) => {
    const steps = [
      { name: "PR Created", activeStatus: "PR_Created", key: 1 },
      { name: "Approved", activeStatus: "PR_Approved", key: 2 },
      { name: "PO Issued", activeStatus: "PO_Issued", key: 3 },
      { name: "Shipped", activeStatus: "Shipped", key: 4 },
      { name: "Receipted", activeStatus: "Acquisition_Completed", key: 5 }
    ];

    let currentStep = 1;
    if (status === "PR_Approved") currentStep = 2;
    if (status === "PO_Issued") currentStep = 3;
    if (status === "Shipped") currentStep = 4;
    if (status === "Acquisition_Completed") currentStep = 5;

    return { steps, currentStep };
  };

  return (
    <div>
      {/* Sub tabs navigation */}
      <div className="panel-header" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className={`btn ${activeSubTab === 'stock' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('stock')}
          >
            <Package size={16} /> Parts Stock Levels
          </button>
          <button
            className={`btn ${activeSubTab === 'procurement' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('procurement')}
          >
            <ShoppingBag size={16} /> Procurement Pipeline Tracker
          </button>
          <button
            className={`btn ${activeSubTab === 'indents' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveSubTab('indents')}
          >
            <Send size={16} /> Store Indents
          </button>
        </div>


      </div>



      {/* View 1: Stock Levels */}
      {activeSubTab === 'stock' && (
        <div className="glass-panel">
          <div className="panel-header">
            <h3 className="panel-title">📦 Parts & Inventory Catalog</h3>
          </div>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Part ID</th>
                  <th>Part Description</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Safety Thresholds (Min/Max)</th>
                  <th>Unit Price</th>
                  <th>Compatible Machinery</th>
                  <th>Alert Status</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map(p => {
                  const isLow = p.quantity <= p.minVal;
                  const isOut = p.quantity === 0;
                  return (
                    <tr key={p.partId}>
                      <td><strong>{p.partId}</strong></td>
                      <td>{p.name}</td>
                      <td><span className="status-badge operating" style={{ fontSize: '0.7rem', padding: '2px 8px', color: '#f8fafc', backgroundColor: 'rgba(255,255,255,0.04)' }}>{p.category}</span></td>
                      <td style={{ fontWeight: 'bold', color: isOut ? 'var(--accent-rose)' : (isLow ? 'var(--accent-amber)' : 'var(--accent-emerald)') }}>
                        {p.quantity} units
                      </td>
                      <td>{p.minVal} / {p.maxVal}</td>
                      <td>${p.unitPrice.toFixed(2)}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.machineCompat}
                      </td>
                      <td>
                        {isOut ? (
                          <span className="status-badge breakdown" style={{ fontSize: '0.7rem' }}>Out of Stock</span>
                        ) : (isLow ? (
                          <span className="status-badge maintenance" style={{ fontSize: '0.7rem' }}>Low stock</span>
                        ) : (
                          <span className="status-badge operating" style={{ fontSize: '0.7rem' }}>Adequate</span>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View 2: Procurement Tracker */}
      {activeSubTab === 'procurement' && (
        <div className="glass-panel">
          <div className="panel-header">
            <h3 className="panel-title">🚚 Active Requisition & Purchase Pipeline (PR &rarr; PO &rarr; Acquisition)</h3>
          </div>
          {procurement.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No active procurement records found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {procurement.map((p, index) => {
                const { steps, currentStep } = getPipelineProgress(p.status);
                return (
                  <div key={index} className="glass-panel clickable" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {/* Record metadata */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PR NUMBER: </span>
                        <strong style={{ color: 'var(--accent-indigo)' }}>{p.prId}</strong>
                        {p.poId && (
                          <>
                            <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>|</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PO NUMBER: </span>
                            <strong style={{ color: 'var(--accent-cyan)' }}>{p.poId}</strong>
                          </>
                        )}
                      </div>

                      <div style={{ fontSize: '0.9rem' }}>
                        <span>Est Cost: <strong>${p.totalAmount}</strong></span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}> ({p.quantity} x ${p.unitPrice})</span>
                      </div>

                      {p.status === 'Acquisition_Completed' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-emerald)', fontSize: '0.85rem', fontWeight: 'bold' }}>
                          <CheckCircle2 size={16} /> Acquisition Completed (Receipted)
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
                          Status: {p.status.replace("_", " ")}
                        </div>
                      )}
                    </div>

                    {/* Part & Vendor info */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20, fontSize: '0.85rem' }}>
                      <div>Item: <strong>{p.partName}</strong> (Code: {p.partId})</div>
                      <div>Vendor: <strong>{p.vendor}</strong></div>
                      <div>Requested by: <strong>{p.requestedBy}</strong> on {p.requestedDate}</div>
                    </div>

                    {/* Horizontal progress bar / stepper */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', marginTop: 12, padding: '0 10px' }}>
                      {/* Gray line behind */}
                      <div style={{ position: 'absolute', left: '20px', right: '20px', height: '2px', backgroundColor: 'rgba(255,255,255,0.06)', zIndex: 1 }} />

                      {/* Active green/blue line progress */}
                      <div style={{
                        position: 'absolute',
                        left: '20px',
                        width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
                        height: '2px',
                        backgroundColor: currentStep === 5 ? 'var(--accent-emerald)' : 'var(--accent-cyan)',
                        transition: 'all 0.3s ease',
                        zIndex: 1
                      }} />

                      {steps.map(s => {
                        const isDone = s.key < currentStep;
                        const isActive = s.key === currentStep;
                        return (
                          <div key={s.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, position: 'relative' }}>
                            <div style={{
                              width: '16px',
                              height: '16px',
                              borderRadius: '50%',
                              backgroundColor: isDone ? 'var(--accent-emerald)' : (isActive ? 'var(--accent-cyan)' : 'var(--bg-secondary)'),
                              border: `2px solid ${isDone ? 'var(--accent-emerald)' : (isActive ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.08)')}`,
                              transition: 'all 0.3s ease'
                            }} />
                            <span style={{
                              fontSize: '0.7rem',
                              marginTop: 6,
                              fontWeight: isActive || isDone ? '600' : '400',
                              color: isDone ? 'var(--accent-emerald)' : (isActive ? 'var(--accent-cyan)' : 'var(--text-muted)')
                            }}>{s.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* View 3: Store Indents */}
      {activeSubTab === 'indents' && (
        <div className="glass-panel">
          <div className="panel-header">
            <h3 className="panel-title">📝 Store Indent Ledger</h3>
          </div>
          {indents.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No active store indents logged.</p>
          ) : (
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Indent ID</th>
                    <th>Department</th>
                    <th>Requested Part</th>
                    <th>Qty Requested</th>
                    <th>Date Filed</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...indents].reverse().map(i => (
                    <tr key={i.indentId}>
                      <td><strong>{i.indentId}</strong></td>
                      <td>{i.department}</td>
                      <td>{i.partName} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({i.partId})</span></td>
                      <td style={{ fontWeight: 'bold' }}>{i.quantity}</td>
                      <td>{i.date}</td>
                      <td>
                        <span className={`status-badge ${i.status.toLowerCase() === 'issued' ? 'operating' : (i.status.toLowerCase() === 'approved' ? 'maintenance' : 'breakdown')}`} style={{ fontSize: '0.7rem' }}>
                          {i.status}
                        </span>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Inventory;
