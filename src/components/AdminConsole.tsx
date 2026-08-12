import { useState } from 'react';
import { AuditLog } from '../types/database';
import { loadSheetJS, parseCSV } from '../utils/excelParser';
import { Upload, ShieldCheck, Database, RefreshCw, History, FileSpreadsheet } from 'lucide-react';

interface AdminConsoleProps {
  updateDatabase: () => Promise<void>;
  auditLogs: AuditLog[];
}

const AdminConsole = ({ updateDatabase, auditLogs = [] }: AdminConsoleProps) => {
  // Files to ingest
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [ingestMonth, setIngestMonth] = useState('2026-06');



  // Status and log info
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState('');



  const parseFileToRows = async (file: File): Promise<any[]> => {
    const isCsv = file.name.endsWith('.csv');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      if (isCsv) {
        reader.onload = (e) => {
          try {
            const text = e.target?.result as string;
            const rows = parseCSV(text);
            resolve(rows);
          } catch (err: any) {
            reject(new Error(`CSV error: ${err.message}`));
          }
        };
        reader.readAsText(file);
      } else {
        // Excel file
        reader.onload = async (e) => {
          try {
            const XLSX = await loadSheetJS();
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet);
            resolve(rows);
          } catch (err: any) {
            reject(new Error(`Excel error: ${err.message}`));
          }
        };
        reader.readAsArrayBuffer(file);
      }
    });
  };

  const handleIngestion = async () => {
    if (!selectedFile) {
      alert("Please choose an Excel or CSV file to load.");
      return;
    }

    setLoading(true);
    setLogs([]);
    setSuccessMsg('');
    const newLogs: string[] = ["Initializing ingestion pipeline..."];

    try {
      newLogs.push(`Reading file "${selectedFile.name}"...`);
      const rows = await parseFileToRows(selectedFile);
      newLogs.push(`Extracted ${rows.length} rows from file.`);
      
      newLogs.push("Transmitting payload to backend for local schema alignment & primary key linking...");
      
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileName: selectedFile.name,
          month: ingestMonth,
          rows: rows
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Ingestion request failed");
      }

      const result = await response.json();
      newLogs.push(`✅ Category Classified: [${result.category.toUpperCase()}]`);
      newLogs.push(`✅ Saved version month: [${result.versionMonth}]`);
      newLogs.push(`✅ Records merged: ${result.rowsAffected}`);
      newLogs.push(`Success: ${result.message}`);

      setLogs(newLogs);
      setSuccessMsg(`Spreadsheet successfully ingested! Synced ${result.rowsAffected} records to month ${result.versionMonth}.`);
      setSelectedFile(null);

      // Refresh database in main App component
      await updateDatabase();
    } catch (err: any) {
      newLogs.push(`🚨 Ingestion failed: ${err.message}`);
      setLogs(newLogs);
      alert(`Ingestion failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetDatabase = () => {
    if (confirm("Are you sure you want to clear custom data? (SQLite state will be seeded from defaults on server reload)")) {
      // Direct reset could be implemented or user is guided to reload the server
      alert("Default seeded database will be restored next time the server is restarted.");
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Introduction Card */}
      <div className="glass-panel" style={{ borderLeft: '3px solid var(--accent-cyan)' }}>
        <h3 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Database size={20} style={{ color: 'var(--accent-cyan)' }} />
          SQL Administration Console
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 10, lineHeight: '1.5rem' }}>
          Upload any monthly spreadsheet or CSV log. The backend **Ingestion Engine** uses a local schema mapper to align headers and link records across tables using primary keys.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        {/* Upload Form Panel */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h4 className="panel-title" style={{ fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10 }}>
            📤 Ingest Spreadsheet Data
          </h4>

          {/* Target Month Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
              1. Target Reporting Period (Month)
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. 2026-06"
              value={ingestMonth}
              onChange={(e) => setIngestMonth(e.target.value)}
              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
            />
          </div>

          {/* File Ingest */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
              2. Select Spreadsheet File (.xlsx, .xls, .csv)
            </label>
            <div className="form-group" style={{ position: 'relative' }}>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                id="ingest-file-input"
                style={{ display: 'none' }}
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              <label
                htmlFor="ingest-file-input"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px dashed rgba(255,255,255,0.15)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  transition: 'border-color 0.2s'
                }}
              >
                <Upload size={16} style={{ color: 'var(--accent-cyan)' }} />
                <span style={{ color: selectedFile ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {selectedFile ? selectedFile.name : "Choose Excel/CSV..."}
                </span>
              </label>
            </div>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10 }}
            onClick={handleIngestion}
            disabled={loading}
          >
            {loading ? <RefreshCw className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
            {loading ? "Parsing Data..." : "Load & Ingest Data"}
          </button>
        </div>

        {/* Console Log Panel */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <h4 className="panel-title" style={{ fontSize: '1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10 }}>
            🛠️ Ingestion Pipeline Terminal
          </h4>

          {/* Logs Terminal */}
          <div
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderRadius: '6px',
              padding: '14px',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              color: '#38bdf8',
              height: '180px',
              overflowY: 'auto',
              border: '1px solid rgba(255,255,255,0.04)'
            }}
          >
            {logs.length === 0 ? (
              <span style={{ color: 'var(--text-muted)' }}>Console idle. Select file and click Load.</span>
            ) : (
              logs.map((log, i) => (
                <div key={i} style={{ marginBottom: 4 }}>
                  {log.startsWith('🚨') ? (
                    <span style={{ color: 'var(--accent-rose)' }}>{log}</span>
                  ) : log.startsWith('✅') || log.startsWith('Success') ? (
                    <span style={{ color: 'var(--accent-emerald)' }}>{log}</span>
                  ) : (
                    log
                  )}
                </div>
              ))
            )}
          </div>

          {successMsg && (
            <div style={{ color: 'var(--accent-emerald)', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', gap: 6, alignItems: 'center' }}>
              <ShieldCheck size={16} /> {successMsg}
            </div>
          )}

          <button
            className="btn btn-secondary"
            style={{ color: 'var(--accent-rose)', borderColor: 'rgba(244,63,94,0.2)' }}
            onClick={handleResetDatabase}
          >
            Clear SQLite Cache
          </button>
        </div>
      </div>

      {/* Audit Logs Section */}
      <div className="glass-panel">
        <h4 className="panel-title" style={{ fontSize: '1rem', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <History size={18} style={{ color: 'var(--accent-cyan)' }} />
          Database Edit History & Ingestion Audit Log ({auditLogs.length})
        </h4>
        {auditLogs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No ingestion history recorded yet.</p>
        ) : (
          <div className="table-container">
            <table className="custom-table" style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action performed</th>
                  <th>Source File</th>
                  <th>Rows Changed</th>
                  <th>Technical details</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log, i) => (
                  <tr key={log.id || i}>
                    <td style={{ whiteSpace: 'nowrap' }}>{log.timestamp}</td>
                    <td><strong style={{ color: 'var(--text-primary)' }}>{log.action}</strong></td>
                    <td style={{ color: 'var(--accent-indigo)' }}>
                      {log.fileName ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <FileSpreadsheet size={14} /> {log.fileName}
                        </span>
                      ) : 'N/A'}
                    </td>
                    <td style={{ fontWeight: 'bold', color: 'var(--accent-cyan)' }}>{log.rowsAffected}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.details}>
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminConsole;
