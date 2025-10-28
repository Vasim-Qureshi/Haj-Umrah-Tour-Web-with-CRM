import React, { useState, useEffect } from "react";

/**
 * TicketDetails.jsx
 *
 * - Single table: one row per client
 * - Each row shows Client Name + 4 ticket columns (each column shows airline | PNR | from → to)
 * - Add / Edit / Delete per client
 * - Popup modal form with labels for adding/editing client + up to 4 tickets
 *
 * Tailwind utility classes used for quick styling.
 */

const emptyTicket = () => ({
  airline: "",
  pnr: "",
  from: "",
  to: "",
});

const initialClients = [
  {
    id: 1,
    name: "Sara Khan",
    tickets: [
      { ...emptyTicket(), airline: "Air India", pnr: "AI1234", from: "Jaipur", to: "Jeddah" },
      { ...emptyTicket(), airline: "IndiGo", pnr: "6E7890", from: "Delhi", to: "Madinah" },
      { ...emptyTicket(), airline: "Saudi Airlines", pnr: "SV4567", from: "Madinah", to: "Jaipur" },
      { ...emptyTicket(), airline: "Air India", pnr: "AI9876", from: "Jeddah", to: "Delhi" },
    ],
  },
  {
    id: 2,
    name: "Amaan Qureshi",
    tickets: [
      { ...emptyTicket(), airline: "Flynas", pnr: "FN6543", from: "Mumbai", to: "Madinah" },
      { ...emptyTicket(), airline: "SpiceJet", pnr: "SJ2312", from: "Delhi", to: "Jeddah" },
      { ...emptyTicket(), airline: "IndiGo", pnr: "6E4455", from: "Jeddah", to: "Delhi" },
      { ...emptyTicket(), airline: "Air India", pnr: "AI9988", from: "Madinah", to: "Mumbai" },
    ],
  },
];

const TicketDetails = () => {
  const [clients, setClients] = useState(initialClients);
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState(null); // null = adding
  const [form, setForm] = useState({
    id: null,
    name: "",
    tickets: [emptyTicket(), emptyTicket(), emptyTicket(), emptyTicket()],
  });

  // open modal for add
  const openAdd = () => {
    setEditingClientId(null);
    setForm({ id: null, name: "", tickets: [emptyTicket(), emptyTicket(), emptyTicket(), emptyTicket()] });
    setModalOpen(true);
  };

  // open modal for edit
  const openEdit = (client) => {
    // deep copy to avoid mutating state accidentally
    const copyTickets = (client.tickets || []).slice(0, 4).map((t) => ({ ...emptyTicket(), ...t }));
    // ensure 4 tickets
    while (copyTickets.length < 4) copyTickets.push({ ...emptyTicket() });
    setEditingClientId(client.id);
    setForm({ id: client.id, name: client.name || "", tickets: copyTickets });
    setModalOpen(true);
  };

  // delete client
  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this client and their tickets?")) {
      setClients((prev) => prev.filter((c) => c.id !== id));
    }
  };

  // form change handlers
  const changeName = (e) => setForm((f) => ({ ...f, name: e.target.value }));
  const changeTicketField = (index, field, value) =>
    setForm((f) => {
      const tickets = f.tickets.map((t, i) => (i === index ? { ...t, [field]: value } : t));
      return { ...f, tickets };
    });

  // Save (add or update)
  const handleSave = () => {
    if (!form.name.trim()) {
      alert("Client Name is required.");
      return;
    }
    // optional: require first 2 departure and 2 arrival? We'll accept any ticket values.
    const payload = {
      id: editingClientId ? form.id : Date.now(),
      name: form.name.trim(),
      // keep exactly 4 tickets (user can leave fields empty)
      tickets: form.tickets.slice(0, 4).map((t) => ({ airline: t.airline || "", pnr: t.pnr || "", from: t.from || "", to: t.to || "" })),
    };

    if (editingClientId) {
      setClients((prev) => prev.map((c) => (c.id === editingClientId ? payload : c)));
    } else {
      setClients((prev) => [...prev, payload]);
    }

    setModalOpen(false);
  };

  // keyboard: close modal on ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-blue-700">Ticket Details (one row per client)</h2>
        <div className="space-x-2">
          <button onClick={openAdd} className="px-4 py-2 bg-blue-600 text-white rounded">Add Client</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-200 text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2 text-left">Client Name</th>
              <th className="border p-2 text-left">Ticket 1</th>
              <th className="border p-2 text-left">Ticket 2</th>
              <th className="border p-2 text-left">Ticket 3</th>
              <th className="border p-2 text-left">Ticket 4</th>
              <th className="border p-2 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="odd:bg-white even:bg-gray-50">
                <td className="border p-2 align-top font-medium">{client.name}</td>

                {Array.from({ length: 4 }).map((_, idx) => {
                  const t = (client.tickets && client.tickets[idx]) || emptyTicket();
                  // show compact info; if empty, show '-'
                  const hasAny = t.airline || t.pnr || t.from || t.to;
                  return (
                    <td key={idx} className="border p-2 align-top">
                      {hasAny ? (
                        <div className="text-xs leading-tight">
                          <div className="font-semibold text-sm">{t.airline || "-"}</div>
                          <div>PNR: {t.pnr || "-"}</div>
                          <div>
                            {t.from ? `${t.from}` : "-"} → {t.to ? `${t.to}` : "-"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  );
                })}

                <td className="border p-2 text-center align-top">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => openEdit(client)}
                      className="px-2 py-1 bg-yellow-500 text-white rounded text-xs"
                      title="Edit"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(client.id)}
                      className="px-2 py-1 bg-red-600 text-white rounded text-xs"
                      title="Delete"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {clients.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">
                  No clients yet. Click <strong>Add Client</strong> to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
          aria-modal="true"
          role="dialog"
        >
          {/* overlay */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setModalOpen(false)}
            aria-hidden="true"
          />

          {/* panel */}
          <div className="relative z-60 w-full max-w-3xl bg-white rounded shadow-lg overflow-auto max-h-[80vh]">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editingClientId ? "Edit Client & Tickets" : "Add Client & Tickets"}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-600 hover:text-gray-800"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Client name */}
              <div>
                <label className="block text-sm text-gray-700 mb-1">Client Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={changeName}
                  className="w-full border p-2 rounded"
                  placeholder="e.g. Sara Khan"
                />
              </div>

              {/* Tickets */}
              <div className="grid gap-4">
                {form.tickets.map((ticket, idx) => (
                  <div key={idx} className="p-3 border rounded">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold">Ticket {idx + 1}</div>
                      <div className="text-xs text-gray-500">Max 4 tickets shown in table</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-gray-600 text-sm">Airline</label>
                        <input
                          type="text"
                          value={ticket.airline}
                          onChange={(e) => changeTicketField(idx, "airline", e.target.value)}
                          className="border p-2 rounded w-full"
                          placeholder="Airline"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-600 text-sm">PNR</label>
                        <input
                          type="text"
                          value={ticket.pnr}
                          onChange={(e) => changeTicketField(idx, "pnr", e.target.value)}
                          className="border p-2 rounded w-full"
                          placeholder="PNR"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-600 text-sm">From</label>
                        <input
                          type="text"
                          value={ticket.from}
                          onChange={(e) => changeTicketField(idx, "from", e.target.value)}
                          className="border p-2 rounded w-full"
                          placeholder="From"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-600 text-sm">To</label>
                        <input
                          type="text"
                          value={ticket.to}
                          onChange={(e) => changeTicketField(idx, "to", e.target.value)}
                          className="border p-2 rounded w-full"
                          placeholder="To"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 rounded"
                >
                  Cancel
                </button>

                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  {editingClientId ? "Update Client" : "Create Client"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketDetails;
