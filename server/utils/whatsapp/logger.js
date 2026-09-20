// server/utils/whatsapp/logger.js
// Logs to console + the socket.io dashboard WITHOUT importing server.js.
// Importing sendLogToDashboard from server.js creates a circular import:
// server.js -> whatsApp.js -> authHelpers.js -> server.js
// During the top-level await in whatsApp.js the export is still in TDZ, so
// calling it throws "Cannot access 'sendLogToDashboard' before initialization"
// and that error gets swallowed by the empty catch blocks.

export function logToDashboard(msg) {
  console.log(msg);
  try {
    global.io?.emit("log", msg);
  } catch {
    /* socket not up yet — console log is enough */
  }
}

export default logToDashboard;
