import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import WhatsAppDashboard from "./components/WhatsAppDashboard.jsx";
import Dashboard from "./components/Dashboard.jsx";
import AuthModal from "./pages/AuthModal.jsx";
import PaymentDetails from "./components/PaymentDetails.jsx";
import PackageDetailTable from "./components/PackageDetails.jsx";
import LeadDetailPage from "./pages/LeadDetailPage.jsx";
import TicketDetails from "./components/TicketDeatails.jsx";

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
        <Link to="/login" className="text-blue-600 hover:underline">
          Login
        </Link>
      </nav>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/leaddetail" element={<LeadDetailPage />} />
        <Route path="/ticket" element={<TicketDetails />} />
        <Route path="/whatsapp" element={<WhatsAppDashboard />} />
        <Route path="/login" element={<AuthModal />} />
      </Routes>
    </Router>
  );
}

export default App;
