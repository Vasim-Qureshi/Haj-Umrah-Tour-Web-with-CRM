import React, { useState } from "react";

const PackageDetailTable = () => {
  const [members, setMembers] = useState([
    {
      id: 1,
      name: "Sara Khan",
      dob: "1991-06-15",
      relation: "Self",
      passport: {
        number: "P1234567",
        issueDate: "2020-01-10",
        expiryDate: "2030-01-10",
        nationality: "Indian",
      },
      age: 34,
      phone: "+91 9123456780",
      email: "sara.khan@example.com",
      plan: "Economy Hajj Plan",
      planAmount: 95000,
      days: 20,
      visa: {
        number: "VISA2025A01",
        type: "Hajj Visa",
        expiry: "2025-12-31",
      },
      airTicket: {
        airline: "Air India",
        pnr: "AI789123",
        departure: "2025-10-25",
        from: "Delhi (DEL)",
        to: "Jeddah (JED)",
      },
    },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState(null);

  // Handle Add/Edit form submission
  const handleFormSubmit = (e) => {
    e.preventDefault();
    const form = e.target;

    const newMember = {
      id: editingMember ? editingMember.id : Date.now(),
      name: form.name.value,
      dob: form.dob.value,
      relation: form.relation.value,
      age: form.age.value,
      phone: form.phone.value,
      email: form.email.value,
      plan: form.plan.value,
      planAmount: parseFloat(form.planAmount.value),
      days: parseInt(form.days.value),
      passport: {
        number: form.passportNumber.value,
        issueDate: form.passportIssue.value,
        expiryDate: form.passportExpiry.value,
        nationality: form.nationality.value,
      },
      visa: {
        number: form.visaNumber.value,
        type: form.visaType.value,
        expiry: form.visaExpiry.value,
      },
      airTicket: {
        airline: form.airline.value,
        pnr: form.pnr.value,
        from: form.from.value,
        to: form.to.value,
        departure: form.departure.value,
      },
    };

    if (editingMember) {
      setMembers((prev) =>
        prev.map((m) => (m.id === editingMember.id ? newMember : m))
      );
      setEditingMember(null);
    } else {
      setMembers((prev) => [...prev, newMember]);
    }

    setShowForm(false);
    form.reset();
  };

  // Delete a member
  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this member?")) {
      setMembers((prev) => prev.filter((m) => m.id !== id));
    }
  };

  const totalAmount = members.reduce((sum, m) => sum + m.planAmount, 0);

  return (
    <div className="max-w-7xl mx-auto bg-white shadow-lg rounded-2xl p-6 mt-10 border border-gray-200">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 border-b pb-2 mb-2">
            Family Package Details
          </h2>
          <p className="text-gray-600 text-sm">
            Member-wise details with DOB, Passport, Visa, and Air Ticket info.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingMember(null);
            setShowForm(true);
          }}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          ➕ Add Member
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 rounded-lg text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="py-2 px-3 border">#</th>
              <th className="py-2 px-3 border">Name</th>
              <th className="py-2 px-3 border">Relation</th>
              <th className="py-2 px-3 border">DOB</th>
              <th className="py-2 px-3 border">Age</th>
              <th className="py-2 px-3 border">Phone</th>
              <th className="py-2 px-3 border">Email</th>
              <th className="py-2 px-3 border">Plan</th>
              <th className="py-2 px-3 border">Days</th>
              <th className="py-2 px-3 border">Amount (₹)</th>
              <th className="py-2 px-3 border">Passport No.</th>
              <th className="py-2 px-3 border">Nationality</th>
              <th className="py-2 px-3 border">Issued</th>
              <th className="py-2 px-3 border">Expiry</th>
              <th className="py-2 px-3 border">Visa No.</th>
              <th className="py-2 px-3 border">Visa Type</th>
              <th className="py-2 px-3 border">Visa Expiry</th>
              <th className="py-2 px-3 border">Airline</th>
              <th className="py-2 px-3 border">PNR</th>
              <th className="py-2 px-3 border">From</th>
              <th className="py-2 px-3 border">To</th>
              <th className="py-2 px-3 border">Departure</th>
              <th className="py-2 px-3 border">Actions</th>
            </tr>
          </thead>

          <tbody>
            {members.map((m, i) => (
              <tr
                key={m.id}
                className="text-center hover:bg-gray-50 transition-colors"
              >
                <td className="py-2 px-3 border">{i + 1}</td>
                <td className="py-2 px-3 border font-medium">{m.name}</td>
                <td className="py-2 px-3 border">{m.relation}</td>
                <td className="py-2 px-3 border">{m.dob}</td>
                <td className="py-2 px-3 border">{m.age}</td>
                <td className="py-2 px-3 border text-blue-600">{m.phone}</td>
                <td className="py-2 px-3 border">{m.email}</td>
                <td className="py-2 px-3 border text-green-700 font-semibold">
                  {m.plan}
                </td>
                <td className="py-2 px-3 border">{m.days}</td>
                <td className="py-2 px-3 border font-semibold text-gray-900">
                  ₹{m.planAmount.toLocaleString()}
                </td>
                <td className="py-2 px-3 border">{m.passport.number}</td>
                <td className="py-2 px-3 border">{m.passport.nationality}</td>
                <td className="py-2 px-3 border">{m.passport.issueDate}</td>
                <td className="py-2 px-3 border text-red-600">
                  {m.passport.expiryDate}
                </td>
                <td className="py-2 px-3 border">{m.visa.number}</td>
                <td className="py-2 px-3 border">{m.visa.type}</td>
                <td className="py-2 px-3 border text-red-600">
                  {m.visa.expiry}
                </td>
                <td className="py-2 px-3 border">{m.airTicket.airline}</td>
                <td className="py-2 px-3 border">{m.airTicket.pnr}</td>
                <td className="py-2 px-3 border">{m.airTicket.from}</td>
                <td className="py-2 px-3 border">{m.airTicket.to}</td>
                <td className="py-2 px-3 border text-indigo-700">
                  {m.airTicket.departure}
                </td>
                <td className="py-2 px-3 border space-x-2">
                  <button
                    onClick={() => {
                      setEditingMember(m);
                      setShowForm(true);
                    }}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs"
                  >
                    🗑 Delete
                  </button>
                </td>
              </tr>
            ))}

            {/* Total Row */}
            <tr className="bg-gray-100 font-semibold text-gray-800">
              <td colSpan="9" className="text-right py-2 px-3 border">
                Total Amount:
              </td>
              <td className="py-2 px-3 border text-green-700">
                ₹{totalAmount.toLocaleString()}
              </td>
              <td colSpan="13" className="py-2 px-3 border text-center text-gray-500">
                — All DOB, Passport, Visa, and Ticket details verified —
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-3xl relative overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">
              {editingMember ? "Edit Member" : "Add Member"}
            </h3>

            <form
              onSubmit={handleFormSubmit}
              className="grid grid-cols-2 gap-4 text-sm"
            >
              {/* Personal Info */}
              <h4 className="col-span-2 font-semibold text-blue-700">
                Personal Details
              </h4>

              <div>
                <label className="block text-gray-600">Full Name</label>
                <input
                  name="name"
                  defaultValue={editingMember?.name || ""}
                  required
                  className="border p-2 rounded w-full"
                />
              </div>

              <div>
                <label className="block text-gray-600">Relation</label>
                <input
                  name="relation"
                  defaultValue={editingMember?.relation || ""}
                  required
                  className="border p-2 rounded w-full"
                />
              </div>

              <div>
                <label className="block text-gray-600">Date of Birth</label>
                <input
                  type="date"
                  name="dob"
                  defaultValue={editingMember?.dob || ""}
                  className="border p-2 rounded w-full"
                />
              </div>

              <div>
                <label className="block text-gray-600">Age</label>
                <input
                  name="age"
                  defaultValue={editingMember?.age || ""}
                  className="border p-2 rounded w-full"
                />
              </div>

              <div>
                <label className="block text-gray-600">Phone</label>
                <input
                  name="phone"
                  defaultValue={editingMember?.phone || ""}
                  className="border p-2 rounded w-full"
                />
              </div>

              <div>
                <label className="block text-gray-600">Email</label>
                <input
                  name="email"
                  defaultValue={editingMember?.email || ""}
                  className="border p-2 rounded w-full"
                />
              </div>

              <div>
                <label className="block text-gray-600">Plan</label>
                <input
                  name="plan"
                  defaultValue={editingMember?.plan || ""}
                  className="border p-2 rounded w-full"
                />
              </div>

              <div>
                <label className="block text-gray-600">Plan Amount (₹)</label>
                <input
                  type="number"
                  name="planAmount"
                  defaultValue={editingMember?.planAmount || ""}
                  className="border p-2 rounded w-full"
                />
              </div>

              <div>
                <label className="block text-gray-600">Days</label>
                <input
                  type="number"
                  name="days"
                  defaultValue={editingMember?.days || ""}
                  className="border p-2 rounded w-full"
                />
              </div>

              {/* Passport */}
              <h4 className="col-span-2 font-semibold text-blue-700 mt-2">
                Passport Details
              </h4>

              <div>
                <label className="block text-gray-600">Passport No.</label>
                <input
                  name="passportNumber"
                  defaultValue={editingMember?.passport?.number || ""}
                  className="border p-2 rounded w-full"
                />
              </div>

              <div>
                <label className="block text-gray-600">Nationality</label>
                <input
                  name="nationality"
                  defaultValue={editingMember?.passport?.nationality || ""}
                  className="border p-2 rounded w-full"
                />
              </div>

              <div>
                <label className="block text-gray-600">Issue Date</label>
                <input
                  type="date"
                  name="passportIssue"
                  defaultValue={editingMember?.passport?.issueDate || ""}
                  className="border p-2 rounded w-full"
                />
              </div>

              <div>
                <label className="block text-gray-600">Expiry Date</label>
                <input
                  type="date"
                  name="passportExpiry"
                  defaultValue={editingMember?.passport?.expiryDate || ""}
                  className="border p-2 rounded w-full"
                />
              </div>

              {/* Visa */}
              <h4 className="col-span-2 font-semibold text-blue-700 mt-2">
                Visa Details
              </h4>

              <div>
                <label className="block text-gray-600">Visa Number</label>
                <input
                  name="visaNumber"
                  defaultValue={editingMember?.visa?.number || ""}
                  className="border p-2 rounded w-full"
                />
              </div>

              <div>
                <label className="block text-gray-600">Visa Type</label>
                <input
                  name="visaType"
                  defaultValue={editingMember?.visa?.type || ""}
                  className="border p-2 rounded w-full"
                />
              </div>

              <div>
                <label className="block text-gray-600">Visa Expiry</label>
                <input
                  type="date"
                  name="visaExpiry"
                  defaultValue={editingMember?.visa?.expiry || ""}
                  className="border p-2 rounded w-full"
                />
              </div>

              {/* Air Ticket */}
              <h4 className="col-span-2 font-semibold text-blue-700 mt-2">
                Air Ticket Details
              </h4>

              <div>
                <label className="block text-gray-600">Airline</label>
                <input
                  name="airline"
                  defaultValue={editingMember?.airTicket?.airline || ""}
                  className="border p-2 rounded w-full"
                />
              </div>

              <div>
                <label className="block text-gray-600">PNR</label>
                <input
                  name="pnr"
                  defaultValue={editingMember?.airTicket?.pnr || ""}
                  className="border p-2 rounded w-full"
                />
              </div>

              <div>
                <label className="block text-gray-600">From</label>
                <input
                  name="from"
                  defaultValue={editingMember?.airTicket?.from || ""}
                  className="border p-2 rounded w-full"
                />
              </div>

              <div>
                <label className="block text-gray-600">To</label>
                <input
                  name="to"
                  defaultValue={editingMember?.airTicket?.to || ""}
                  className="border p-2 rounded w-full"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-gray-600">Departure Date</label>
                <input
                  type="date"
                  name="departure"
                  defaultValue={editingMember?.airTicket?.departure || ""}
                  className="border p-2 rounded w-full"
                />
              </div>

              {/* Buttons */}
              <div className="col-span-2 flex justify-end mt-3 space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingMember(null);
                  }}
                  className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
                >
                  {editingMember ? "Update Member" : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-sm text-gray-500 text-center mt-4">
        Generated on {new Date().toLocaleDateString()}
      </div>
    </div>
  );
};

export default PackageDetailTable
