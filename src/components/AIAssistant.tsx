import { useState, useEffect, useRef } from 'react';
import { Send, Terminal, HelpCircle, Sparkles } from 'lucide-react';
import { DatabaseState } from '../types/database';
import { parseAIQuery, AIQueryResult } from '../aiEngine';
import { Bar } from 'react-chartjs-2';

interface AIAssistantProps {
  database: DatabaseState;
  quickQuery: string;
  setQuickQuery: (q: string) => void;
}

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  result?: AIQueryResult;
}

const AIAssistant = ({ database, quickQuery, setQuickQuery }: AIAssistantProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Hello! I am your ForeSite support assistant. How can I help you manage your fleet, check breakdowns, or track parts procurement today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      result: {
        text: 'Hello! I am your ForeSite support assistant. How can I help you manage your fleet, check breakdowns, or track parts procurement today?'
      }
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const chatHistoryRef = useRef<HTMLDivElement>(null);

  const suggestedQueries = [
    { label: 'Fuel Guzzler', text: 'Which machine consumes the most fuel?' },
    { label: 'WL-003 Outage', text: 'Why did WL-003 break down?' },
    { label: 'Low Stock Parts', text: 'List items below minimum stock' },
    { label: 'Track Order', text: 'Track PO-2026-002' },
    { label: 'Store Indents', text: 'List pending indents' },
    { label: 'Most Productive', text: 'Which machine is most productive?' }
  ];

  const handleSend = (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');

    // Simulate small latency for premium AI assistant feel
    setTimeout(() => {
      const result = parseAIQuery(text, database);
      const botMsg: Message = {
        id: `msg-${Date.now()}-bot`,
        sender: 'bot',
        text: result.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        result: result
      };
      setMessages(prev => [...prev, botMsg]);
    }, 300);
  };

  // Scroll to bottom on new message
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle quickQuery passed from dashboard
  useEffect(() => {
    if (quickQuery) {
      handleSend(quickQuery);
      setQuickQuery(''); // Reset quick query so it doesn't trigger repeatedly
    }
  }, [quickQuery]);

  const renderMessageContent = (msg: Message) => {
    const result = msg.result;
    if (!result) {
      return <p style={{ whiteSpace: 'pre-line' }}>{msg.text}</p>;
    }

    // Format bold text and lists in bot response
    const formatBotText = (text: string) => {
      return text.split('\n').map((line, idx) => {
        let content: React.ReactNode = line;
        
        // Match lists e.g. "1. **Cap**"
        const listMatch = line.match(/^(\d+\.\s+|\*|-|\+)\s*(.*)$/);
        if (listMatch) {
          const listPrefix = listMatch[1];
          const listText = listMatch[2];
          content = (
            <span style={{ display: 'inline-flex', paddingLeft: '8px' }}>
              <span style={{ marginRight: '8px', color: 'var(--accent-cyan)' }}>{listPrefix}</span>
              <span>{formatBold(listText)}</span>
            </span>
          );
        } else {
          content = formatBold(line);
        }

        return <div key={idx} style={{ marginBottom: '6px', minHeight: '1.2rem' }}>{content}</div>;
      });
    };

    const formatBold = (str: string) => {
      const parts = str.split(/\*\*(.*?)\*\*/g);
      return parts.map((part, index) => {
        if (index % 2 === 1) {
          return <strong key={index} style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{part}</strong>;
        }
        // Also handle inline code style like `text`
        const codeParts = part.split(/`(.*?)`/g);
        return codeParts.map((cp, cIdx) => {
          if (cIdx % 2 === 1) {
            return (
              <code
                key={cIdx}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  color: 'var(--accent-cyan)'
                }}
              >
                {cp}
              </code>
            );
          }
          return cp;
        });
      });
    };

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: '#94a3b8',
            font: { family: 'Inter', size: 10 }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', font: { family: 'Inter', size: 9 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', font: { family: 'Inter', size: 9 } }
        }
      }
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ whiteSpace: 'pre-line' }}>{formatBotText(result.text)}</div>

        {/* Structured Data Table */}
        {result.structuredData && result.structuredData.length > 0 && (
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="custom-table" style={{ fontSize: '0.8rem', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <thead>
                <tr>
                  {Object.keys(result.structuredData[0]).map(key => (
                    <th key={key} style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.structuredData.map((row, idx) => (
                  <tr key={idx}>
                    {Object.values(row).map((val, cIdx) => (
                      <td key={cIdx} style={{ padding: '8px 12px', borderBottom: idx === (result.structuredData?.length ?? 0) - 1 ? 'none' : '1px solid rgba(255,255,255,0.04)' }}>
                        {val === null || val === undefined ? 'N/A' : val.toString()}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Chart representation */}
        {result.chart && result.chart.labels && (
          <div className="message-chart" style={{ height: '220px', marginTop: 16 }}>
            <Bar
              data={{
                labels: result.chart.labels,
                datasets: result.chart.datasets.map(ds => ({
                  label: result.chart?.label || 'Value',
                  data: ds.data,
                  backgroundColor: ds.backgroundColor || 'rgba(6, 182, 212, 0.6)',
                  borderColor: ds.borderColor || 'rgb(6, 182, 212)',
                  borderWidth: 1
                }))
              }}
              options={chartOptions as any}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="chat-viewport glass-panel" style={{ height: 'calc(100vh - 145px)', padding: 0, overflow: 'hidden' }}>
      {/* Left Chat Area */}
      <div className="chat-left">
        {/* Chat Messages Log */}
        <div className="chat-history" ref={chatHistoryRef}>
          {messages.map(msg => (
            <div key={msg.id} className={`chat-message ${msg.sender}`}>
              <div className="message-meta">
                {msg.sender === 'user' ? 'You' : 'ForeSite'} • {msg.timestamp}
              </div>
              <div className="message-bubble">
                {msg.sender === 'user' ? msg.text : renderMessageContent(msg)}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Input Area */}
        <div className="chat-input-area">
          <div className="suggested-chips">
            {suggestedQueries.map((q, idx) => (
              <button
                key={idx}
                className="suggested-chip"
                onClick={() => handleSend(q.text)}
                style={{ outline: 'none' }}
              >
                {q.label}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(inputValue);
            }}
            className="chat-input-wrapper"
          >
            <input
              type="text"
              className="form-control chat-input"
              placeholder="Ask anything about rigs, breakdowns, stock levels, or tracking PO/PRs..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              style={{ paddingRight: 40 }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '48px', height: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>

      {/* Right Sidebar Capabilities Panel */}
      <div className="chat-right-panel" style={{ background: 'rgba(0,0,0,0.1)', borderLeft: '1px solid var(--border-card)' }}>
        <h4 className="panel-title" style={{ color: 'var(--accent-cyan)', marginBottom: 12 }}>
          <Terminal size={18} /> Engine Capabilities
        </h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.3rem', marginBottom: 16 }}>
          ForeSite parses natural language queries and cross-references them against active machinery metrics, outages, and inventory databases in real-time.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-cyan)' }}>
              <Sparkles size={14} />
            </div>
            <div>
              <h5 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Diagnostics</h5>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>"Why did rig WL-003 fail?"</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)' }}>
              <HelpCircle size={14} />
            </div>
            <div>
              <h5 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Telemetry</h5>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>"Which machines burn the most diesel?"</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-indigo)' }}>
              <Send size={14} />
            </div>
            <div>
              <h5 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Procurement</h5>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>"Track Purchase Order PO-2026-002"</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
