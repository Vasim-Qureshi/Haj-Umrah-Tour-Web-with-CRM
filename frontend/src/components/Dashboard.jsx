import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";

const URL = import.meta.env.VITE_BASE_URL_V2 || 'http://localhost:5000';
const API_URL = `${URL}/api/bookings`; // 🔗 Backend API base
const SOCKET_URL = URL; // ⚡ Socket.io server URL

const Dashboard = () => {
  const [bookings, setBookings] = useState([]);
  const [sortAsc, setSortAsc] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    plan: "",
    duration: "",
    persons: "",
    email: "",
    message: "",
    leadStage: "New",
    date: new Date(),
  });

  // ✅ Fetch all bookings from API
  const loadBookings = async () => {
    try {
      const res = await fetch(API_URL, { credentials: "include" });
      const data = await res.json();
      setBookings(data);
    } catch (err) {
      console.error("❌ Error fetching leads:", err);
    }
  };

  // ✅ Initial load + Socket setup
  useEffect(() => {
    loadBookings();

    // Connect socket
    const socket = io(SOCKET_URL, { transports: ["websocket"] });
    console.log("🟢 Socket connected");

    // Listen for live updates from server
    socket.on("log", (msg) => {
      console.log("📡 Dashboard Update:", msg);
      loadBookings(); // reload new data automatically
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket Error:", err.message);
    });

    return () => socket.disconnect();
  }, []);

  // ✅ Open Add Lead form
  const handleAddLead = () => {
    setFormData({
      name: "",
      phone: "",
      plan: "",
      duration: "",
      persons: "",
      email: "",
      message: "",
      leadStage: "New",
      date: new Date(),
    });
    setEditingId(null);
    setShowForm(true);
  };

  // ✅ Open Edit Lead form
  const handleEdit = (lead) => {
    setFormData(lead);
    setEditingId(lead._id);
    setShowForm(true);
  };

  // ✅ Delete Lead
  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("क्या आप इस लीड को हटाना चाहते हैं?");
    if (!confirmDelete) return;

    try {
      const res = await fetch(`${API_URL}/${id}`, { method: "DELETE", credentials: "include" });
      if (res.ok) {
        console.log("🗑️ Lead deleted");
      }
    } catch (err) {
      console.error("❌ Error deleting lead:", err);
    }
  };

  // ✅ Sort by date
  const handleSort = () => {
    const sorted = [...bookings].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return sortAsc ? dateA - dateB : dateB - dateA;
    });
    setBookings(sorted);
    setSortAsc(!sortAsc);
  };

  // ✅ Handle input change
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ✅ Submit form (Add / Edit)
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      let res;
      if (editingId) {
        // Edit Lead
        res = await fetch(`${API_URL}/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
          credentials: "include",
        });
      } else {
        // Add Lead
        res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
      }

      if (res.ok) {
        setShowForm(false);
        setEditingId(null);
      }
    } catch (err) {
      console.error("❌ Error submitting form:", err);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-[Noto Sans Devanagari]">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">📋 बुकिंग डैशबोर्ड</h2>
        <div className="flex gap-3">
          <button
            onClick={handleAddLead}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
          >
            ➕ Add Lead
          </button>
          <button
            onClick={handleSort}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            ⇅ Sort by Date
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl shadow">
        <table className="min-w-full border border-gray-200 bg-white text-center">
          <thead className="bg-purple-600 text-white">
            <tr>
              <th className="py-2 px-3 border">नाम</th>
              <th className="py-2 px-3 border">फ़ोन</th>
              <th className="py-2 px-3 border">प्लान</th>
              <th className="py-2 px-3 border">दिन</th>
              <th className="py-2 px-3 border">व्यक्ति</th>
              <th className="py-2 px-3 border">ईमेल</th>
              <th className="py-2 px-3 border">संदेश</th>
              <th className="py-2 px-3 border">Lead Stage</th>
              <th className="py-2 px-3 border">तारीख़</th>
              <th className="py-2 px-3 border">कार्य</th>
            </tr>
          </thead>
          <tbody>
            {bookings.length > 0 ? (
              bookings.map((b, i) => (
                <tr key={b._id || i} className={i % 2 === 0 ? "bg-gray-100" : "bg-white"}>
                  <td className="border py-2 px-3">{b.name}</td>
                  <td className="border py-2 px-3">{b.phone}</td>
                  <td className="border py-2 px-3">{b.plan}</td>
                  <td className="border py-2 px-3">{b.duration}</td>
                  <td className="border py-2 px-3">{b.persons}</td>
                  <td className="border py-2 px-3">{b.email || "-"}</td>
                  <td className="border py-2 px-3">{b.message || "-"}</td>
                  <td className="border py-2 px-3 font-semibold text-purple-700">
                    {b.leadStage}
                  </td>
                  <td className="border py-2 px-3">
                    {new Date(b.date).toLocaleDateString("hi-IN")}
                  </td>
                  <td className="border py-2 px-3 flex justify-center gap-2">
                    <button
                      onClick={() => handleEdit(b)}
                      className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleDelete(b._id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                    >
                      🗑️ Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10" className="py-4 text-gray-500">
                  कोई बुकिंग नहीं मिली।
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-lg">
            <h3 className="text-xl font-bold mb-4">
              {editingId ? "✏️ Edit Lead" : "➕ Add New Lead"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  name="name"
                  placeholder="नाम"
                  value={formData.name}
                  onChange={handleChange}
                  className="border p-2 rounded"
                  required
                />
                <input
                  type="text"
                  name="phone"
                  placeholder="फ़ोन"
                  value={formData.phone}
                  onChange={handleChange}
                  className="border p-2 rounded"
                  required
                />
                <input
                  type="text"
                  name="plan"
                  placeholder="प्लान"
                  value={formData.plan}
                  onChange={handleChange}
                  className="border p-2 rounded"
                />
                <input
                  type="text"
                  name="duration"
                  placeholder="दिन"
                  value={formData.duration}
                  onChange={handleChange}
                  className="border p-2 rounded"
                />
                <input
                  type="number"
                  name="persons"
                  placeholder="व्यक्ति"
                  value={formData.persons}
                  onChange={handleChange}
                  className="border p-2 rounded"
                />
                <input
                  type="email"
                  name="email"
                  placeholder="ईमेल"
                  value={formData.email}
                  onChange={handleChange}
                  className="border p-2 rounded"
                />
              </div>

              <textarea
                name="message"
                placeholder="संदेश"
                value={formData.message}
                onChange={handleChange}
                className="border p-2 rounded w-full"
              />

              <select
                name="leadStage"
                value={formData.leadStage}
                onChange={handleChange}
                className="border p-2 rounded w-full"
              >
                <option>New</option>
                <option>Contacted</option>
                <option>Follow Up</option>
                <option>Converted</option>
                <option>Lost</option>
              </select>

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-gray-300 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
