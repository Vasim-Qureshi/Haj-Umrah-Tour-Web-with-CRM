import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";

// ✅ QRCode fix for React 19 + Vite
import * as QRCodeModule from "qrcode.react";
const QRCode =
  QRCodeModule.default ||
  QRCodeModule.QRCodeCanvas ||
  QRCodeModule.QRCodeSVG ||
  QRCodeModule.QRCode;

const WhatsAppDashboard = () => {
  const [status, setStatus] = useState({ connected: false, user: null });
  const [number, setNumber] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null); // ✅ single message media
  const [isSending, setIsSending] = useState(false);

  const [csvFile, setCsvFile] = useState(null);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastFile, setBroadcastFile] = useState(null); // ✅ broadcast media
  const [broadcasting, setBroadcasting] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);

  const [logs, setLogs] = useState([]);
  const [qr, setQr] = useState(null);

  const URL = import.meta.env.VITE_BASE_URL_V2 || "http://localhost:5000";

  // 🧩 Poll server status every 3 seconds
  useEffect(() => {
    let active = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${URL}/status`);
        const data = await res.json();
        if (active) setStatus(data);
      } catch {
        if (active) setStatus({ connected: false, user: null });
      }
    };
    fetchStatus();
    const timer = setInterval(fetchStatus, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  // 🔌 Socket.io connection
  useEffect(() => {
    const socket = io(URL, { transports: ["websocket"] });

    socket.on("connect", () => addLog("🟢 Connected to backend via Socket.io"));
    socket.on("disconnect", () => addLog("🔴 Disconnected from server"));
    socket.on("connect_error", (err) =>
      addLog(`❌ Socket error: ${err.message}`)
    );

    socket.on("qr", (qrData) => {
      setQr(qrData);
      addLog("📱 QR Code received — please scan to login.");
    });
    socket.on("log", (msg) => addLog(msg));

    return () => socket.disconnect();
  }, []);

  const addLog = (msg) =>
    setLogs((prev) => [
      { ts: new Date().toLocaleTimeString(), text: msg },
      ...prev.slice(0, 199),
    ]);

  // ─── Send Single Message (with optional media) ─────────────────────
  const handleSend = async (e) => {
    e.preventDefault();
    if (!number || !message)
      return addLog("⚠️ Number and message required.");

    setIsSending(true);
    try {
      const form = new FormData();
      form.append("number", number.replace(/[^0-9]/g, ""));
      form.append("message", message);
      if (file) form.append("file", file);

      const res = await fetch(`${URL}/send-media`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();

      if (data.success)
        addLog(`✅ Message${file ? " + media" : ""} sent to ${number}`);
      else addLog(`❌ Send failed: ${JSON.stringify(data)}`);
    } catch (err) {
      addLog(`Error: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // ─── Broadcast CSV (with optional media) ───────────────────────────
  const handleCsvSelect = (file) => {
    setCsvFile(file);
    setPreviewRows([]);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).filter(Boolean);
      const rows = lines
        .slice(0, 10)
        .map((line) => line.split(",").map((c) => c.trim()));
      setPreviewRows(rows);
    };
    reader.readAsText(file);
  };

  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!csvFile || !broadcastMsg)
      return addLog("⚠️ CSV file and message required.");

    setBroadcasting(true);
    try {
      const form = new FormData();
      form.append("file", csvFile);
      form.append("message", broadcastMsg);
      if (broadcastFile) form.append("mediaFile", broadcastFile); // ✅ attach media

      const res = await fetch(`${URL}/broadcast`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();

      if (data.success)
        addLog(
          `🚀 Broadcast started (${csvFile.name})${broadcastFile ? " + media" : ""
          }`
        );
      else addLog(`❌ Broadcast error: ${JSON.stringify(data)}`);
    } catch (err) {
      addLog(`Error: ${err.message}`);
    } finally {
      setBroadcasting(false);
    }
  };

  // ─── Render ──────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold">
            🕌 WhatsApp Automation — Dashboard
          </h1>

          <div className="text-sm text-right">
            <div>
              Status:{" "}
              <span
                className={`${status.connected ? "text-green-600" : "text-red-500"
                  }`}
              >
                {status.connected ? "Connected ✅" : "Disconnected ❌"}
              </span>
            </div>
            {status.user && (
              <div className="text-xs">
                User: {status.user.pushname || status.user.me || "—"}
              </div>
            )}
          </div>
        </header>

        {/* QR Display */}
        {qr && (
          <div className="bg-white p-6 rounded-2xl shadow-sm mb-6 flex flex-col items-center">
            <h2 className="font-semibold mb-2">📱 Scan to Login WhatsApp</h2>
            {QRCode ? (
              <QRCode value={qr} size={256} />
            ) : (
              <p className="text-red-500 text-sm">QR Component missing</p>
            )}
            <p className="text-sm text-gray-600 mt-3">
              Open WhatsApp → Linked Devices → Scan this QR
            </p>
          </div>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Single Message */}
          <section className="bg-white p-5 rounded-2xl shadow-sm">
            <h2 className="font-semibold mb-2">Send Single Message</h2>
            <form onSubmit={handleSend} className="space-y-3">
              <label className="block text-xs text-gray-600">
                Mobile Number
              </label>
              <input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="w-full border px-3 py-2 rounded-md"
                placeholder="919876543210"
              />

              <label className="block text-xs text-gray-600">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full border px-3 py-2 rounded-md"
                placeholder="Message text"
              />

              {/* ✅ Media Upload */}
              <label className="block text-xs text-gray-600 mt-3">
                Attach Media (optional)
              </label>
              <input
                type="file"
                accept="image/*,application/pdf,video/*"
                onChange={(e) => setFile(e.target.files[0])}
              />
              {file && (
                <p className="text-xs text-gray-500 mt-1">
                  Selected: {file.name}
                </p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  disabled={isSending}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md disabled:opacity-50"
                >
                  {isSending ? "Sending..." : "Send Message"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNumber("");
                    setMessage("");
                    setFile(null);
                  }}
                  className="px-3 py-2 border rounded-md"
                >
                  Clear
                </button>
              </div>
            </form>
          </section>

          {/* Broadcast Section */}
          <section className="bg-white p-5 rounded-2xl shadow-sm">
            <h2 className="font-semibold mb-2">Broadcast (CSV + Media)</h2>
            <form onSubmit={handleBroadcast} className="space-y-3">
              <label className="block text-xs text-gray-600">
                Upload CSV (number,name)
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => handleCsvSelect(e.target.files[0])}
              />

              {previewRows.length > 0 && (
                <div className="bg-gray-100 p-2 rounded-md text-xs max-h-32 overflow-auto">
                  <div className="font-medium mb-1">
                    Preview ({previewRows.length} rows)
                  </div>
                  <table className="w-full text-left text-xs">
                    <tbody>
                      {previewRows.map((r, i) => (
                        <tr key={i} className="odd:bg-white even:bg-gray-50">
                          {r.map((c, j) => (
                            <td key={j} className="pr-3">
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <label className="block text-xs text-gray-600 mt-2">
                Broadcast Message
              </label>
              <textarea
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value)}
                rows={4}
                className="w-full border px-3 py-2 rounded-md"
                placeholder="Message to broadcast"
              />

              {/* ✅ Broadcast Media Upload */}
              <label className="block text-xs text-gray-600 mt-3">
                Attach Media for Broadcast (optional)
              </label>
              <input
                type="file"
                accept="image/*,application/pdf,video/*"
                onChange={(e) => setBroadcastFile(e.target.files[0])}
              />
              {broadcastFile && (
                <p className="text-xs text-gray-500 mt-1">
                  Selected: {broadcastFile.name}
                </p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  disabled={broadcasting}
                  className="bg-green-600 text-white px-4 py-2 rounded-md disabled:opacity-50"
                >
                  {broadcasting ? "Starting..." : "Start Broadcast"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCsvFile(null);
                    setPreviewRows([]);
                    setBroadcastMsg("");
                    setBroadcastFile(null);
                  }}
                  className="px-3 py-2 border rounded-md"
                >
                  Reset
                </button>
              </div>
            </form>
          </section>

          {/* Logs */}
          <section className="bg-white p-5 rounded-2xl shadow-sm md:col-span-2">
            <h2 className="font-semibold mb-2">Server Logs</h2>
            <div className="bg-black text-white p-3 rounded-md h-56 overflow-auto text-xs">
              {logs.length === 0 && (
                <div className="text-gray-400">No activity yet.</div>
              )}
              {logs.map((l, i) => (
                <div key={i}>
                  <strong>[{l.ts}]</strong> {l.text}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppDashboard;
