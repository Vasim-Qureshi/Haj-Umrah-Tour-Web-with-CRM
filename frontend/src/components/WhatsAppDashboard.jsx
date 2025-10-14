import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

// WhatsAppDashboard.jsx
// Single-file React component (default export) built with TailwindCSS utility classes.
// Connects to the Express API from your app.js (assumes server at same origin).

const WhatsAppDashboard = () => {
  const [status, setStatus] = useState({ connected: false, user: null });
  const [number, setNumber] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const [csvFile, setCsvFile] = useState(null);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);

  const [logs, setLogs] = useState([]);

  // Poll server status every 3s
  useEffect(() => {
    let mounted = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch('http://localhost:5000/status');
        const data = await res.json();
        if (mounted) setStatus(data);
      } catch (err) {
        if (mounted) setStatus({ connected: false, user: null });
      }
    };

    fetchStatus();
    const id = setInterval(fetchStatus, 3000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  // Real-time socket connection
  useEffect(() => {
    const socket = io("http://localhost:5000", {
      transports: ["websocket"], // ensure websocket fallback
    });

    socket.on("connect", () => {
      console.log("🟢 Socket connected to server!");
      addLog("Socket connected to backend.");
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err.message);
      addLog(`Socket error: ${err.message}`);
    });

    socket.on('log', (msg) => {
      setLogs((l) => [
        { ts: new Date().toLocaleTimeString(), text: msg },
        ...l.slice(0, 199),
      ]);
    });

    return () => socket.disconnect();
  }, []);

  const addLog = (msg) => setLogs((l) => [
    { ts: new Date().toLocaleTimeString(), text: msg },
    ...l.slice(0, 199)
  ]);

  // Send single message
  const handleSend = async (e) => {
    e.preventDefault();
    if (!number || !message) return addLog('Number and message are required');
    setIsSending(true);
    try {
      const res = await fetch('http://localhost:5000/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: number.replace(/[^0-9]/g, ''), message }),
      });
      const data = await res.json();
      if (data.success) {
        addLog(`Sent message to ${number}`);
      } else {
        addLog(`Failed to send: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      addLog(`Error: ${err.message}`);
    } finally { setIsSending(false); }
  };

  // Preview CSV (reads first 10 rows client-side)
  const handleCsvSelect = (f) => {
    setCsvFile(f);
    setPreviewRows([]);
    if (!f) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result; // entire file text
      const lines = text.split(/\r?\n/).filter(Boolean); // non-empty lines
      // Parse first 10 rows
      const rows = lines.slice(0, 10).map((ln) => {
        // Simple CSV parse (no quotes handling)
        const cols = ln.split(',');
        // Trim spaces
        return cols.map((c) => c.trim());
      });
      setPreviewRows(rows);
    };
    reader.readAsText(f);
  };

  // Broadcast via /broadcast (multipart/form-data)
  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!csvFile || !broadcastMsg) return addLog('CSV file and message required for broadcast');
    setBroadcasting(true);
    try {
      const form = new FormData();
      form.append('file', csvFile);
      form.append('message', broadcastMsg);
      // If you want to attach media from server, provide mediaPath field (optional)
      // form.append('mediaPath', './files/flyer.jpg');

      const res = await fetch('http://localhost:5000/broadcast', { method: 'POST', body: form });
      const data = await res.json();
      if (data.success) {
        addLog(`Broadcast started: ${csvFile.name} (${previewRows.length || 'unknown'} previewed)`);
      } else {
        addLog(`Broadcast error: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      addLog(`Broadcast exception: ${err.message}`);
    } finally { setBroadcasting(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">🕌 WhatsApp Automation — Dashboard</h1>
          <div className="text-sm">
            <div>Status: <span className={`${status.connected ? 'text-green-600' : 'text-red-500'}`}>{status.connected ? 'Connected' : 'Disconnected'}</span></div>
            {status.user && <div className="text-xs">User: {status.user.pushname || status.user.named || status.user.me || '—'}</div>}
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Single message card */}
          <section className="bg-white p-5 rounded-2xl shadow-sm">
            <h2 className="font-semibold mb-2">Send Single Message</h2>
            <form onSubmit={handleSend} className="space-y-3">
              <label className="block text-xs text-gray-600">Mobile Number (country code + number, e.g. 919876543210)</label>
              <input value={number} onChange={(e) => setNumber(e.target.value)} className="w-full border px-3 py-2 rounded-md" placeholder="919876543210" />

              <label className="block text-xs text-gray-600">Message</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="w-full border px-3 py-2 rounded-md" placeholder="Message text"></textarea>

              <div className="flex items-center gap-3">
                <button disabled={isSending} className="bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-md">{isSending ? 'Sending...' : 'Send'}</button>
                <button type="button" onClick={() => { setNumber(''); setMessage(''); }} className="px-3 py-2 border rounded-md">Clear</button>
              </div>
            </form>
          </section>

          {/* Broadcast card */}
          <section className="bg-white p-5 rounded-2xl shadow-sm">
            <h2 className="font-semibold mb-2">Broadcast (CSV)</h2>
            <form onSubmit={handleBroadcast} className="space-y-3">
              <label className="block text-xs text-gray-600">Upload CSV (columns: number,name)</label>
              <input type="file" accept=".csv" onChange={(e) => handleCsvSelect(e.target.files[0])} className="" />

              {previewRows.length > 0 && (
                <div className="max-h-32 overflow-auto bg-gray-100 p-2 rounded-md text-xs">
                  <div className="font-medium mb-1">Preview (first {previewRows.length} rows):</div>
                  <table className="w-full text-left text-xs">
                    <tbody>
                      {previewRows.map((r, i) => (
                        <tr key={i} className="odd:bg-white even:bg-gray-50">
                          {r.map((c, j) => <td key={j} className="pr-3">{c}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <label className="block text-xs text-gray-600">Broadcast Message</label>
              <textarea value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)} rows={4} className="w-full border px-3 py-2 rounded-md" placeholder="Message to broadcast"></textarea>

              <div className="flex items-center gap-3">
                <button disabled={broadcasting} className="bg-green-600 disabled:opacity-50 text-white px-4 py-2 rounded-md">{broadcasting ? 'Starting...' : 'Start Broadcast'}</button>
                <button type="button" onClick={() => { setCsvFile(null); setPreviewRows([]); setBroadcastMsg(''); }} className="px-3 py-2 border rounded-md">Reset</button>
              </div>

              <div className="text-xs text-gray-500 pt-2">Tip: CSV rows should contain phone numbers in international format (e.g. 919876543210). Server will read `number` column.</div>
            </form>
          </section>

          {/* Status & Media actions */}
          <section className="bg-white p-5 rounded-2xl shadow-sm md:col-span-2">
            <h2 className="font-semibold mb-2">Server Status & Logs</h2>
            <div className="flex gap-6">
              <div className="flex-1">
                <div className="text-sm mb-2">Connection</div>
                <pre className="bg-gray-100 p-3 rounded-md text-xs overflow-auto h-28">{JSON.stringify(status, null, 2)}</pre>
              </div>

              <div className="flex-1">
                <div className="text-sm mb-2">Activity Logs</div>
                <div className="bg-black text-white p-3 rounded-md h-28 overflow-auto text-xs">
                  {logs.length === 0 && <div className="text-gray-300">No activity yet.</div>}
                  {logs.map((l, idx) => (
                    <div key={idx} className="mb-1"><strong>[{l.ts}]</strong> {l.text}</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 text-xs text-gray-600">Notes:
              <ul className="list-disc pl-5">
                <li>QR login is shown in the server console (whatsapp.js). Scan it once to persist session via LocalAuth.</li>
                <li>If you want to send media from the dashboard, upload files to your server `./files/` and pass the server path as `mediaPath` when calling /broadcast or adjust the backend to accept media uploads.</li>
              </ul>
            </div>
          </section>
        </div>

        <footer className="mt-6 text-center text-xs text-gray-500">Built for <strong>Safar Makkah Hajj Umrah Travels</strong> — Connects to your Express API at <code>/send-message</code> and <code>/broadcast</code>.</footer>
      </div>
    </div>
  );
}

export default WhatsAppDashboard;