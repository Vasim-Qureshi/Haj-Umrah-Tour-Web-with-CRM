import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import WhatsAppDashboard from "./components/WhatsAppDashboard.jsx";
import Dashboard from "./components/Dashboard.jsx";

function App() {
  return (
    <Router>
      <nav className="p-4 bg-gray-100 shadow-md flex gap-4">
        <Link to="/" className="text-blue-600 hover:underline">
          Dashboard
        </Link>
        <Link to="/whatsapp" className="text-blue-600 hover:underline">
          WhatsApp Dashboard
        </Link>
      </nav>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/whatsapp" element={<WhatsAppDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
