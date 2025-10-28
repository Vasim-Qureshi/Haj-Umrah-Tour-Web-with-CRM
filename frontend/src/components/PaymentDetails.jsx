import React, { useState, useMemo } from "react";

export default function PaymentDetails() {
  const [payments, setPayments] = useState([
    {
      id: 1,
      paySlip: "Slip #001",
      amount: "25000",
      paySource: "Bank Transfer",
      payDateTime: "2025-10-25 11:30 AM",
      updateDateTime: "2025-10-25 11:45 AM",
    },
    {
      id: 2,
      paySlip: "Slip #002",
      amount: "15000",
      paySource: "Cash",
      payDateTime: "2025-10-26 09:15 AM",
      updateDateTime: "2025-10-26 09:20 AM",
    },
    {
      id: 3,
      paySlip: "Slip #003",
      amount: "32000",
      paySource: "Cash Deposit",
      payDateTime: "2025-10-23 02:45 PM",
      updateDateTime: "2025-10-23 03:00 PM",
    },
    {
      id: 4,
      paySlip: "Slip #004",
      amount: "12750",
      paySource: "Credit Card",
      payDateTime: "2025-10-22 05:30 PM",
      updateDateTime: "2025-10-22 05:40 PM",
    },
    {
      id: 5,
      paySlip: "Slip #005",
      amount: "20000",
      paySource: "Bank Transfer",
      payDateTime: "2025-10-21 09:00 AM",
      updateDateTime: "2025-10-21 09:10 AM",
    },
    {
      id: 6,
      paySlip: "Slip #006",
      amount: "15500",
      paySource: "UPI - PhonePe",
      payDateTime: "2025-10-20 07:50 PM",
      updateDateTime: "2025-10-20 08:00 PM",
    },
    {
      id: 7,
      paySlip: "Slip #007",
      amount: "40000",
      paySource: "Cheque",
      payDateTime: "2025-10-19 04:20 PM",
      updateDateTime: "2025-10-19 04:35 PM",
    },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editPayment, setEditPayment] = useState(null);
  const [formData, setFormData] = useState({
    paySlip: "",
    amount: "",
    paySource: "",
    payDateTime: "",
    updateDateTime: "",
  });

  const openAddForm = () => {
    setEditPayment(null);
    setFormData({
      paySlip: "",
      amount: "",
      paySource: "",
      payDateTime: "",
      updateDateTime: "",
    });
    setIsModalOpen(true);
  };

  const openEditForm = (payment) => {
    setEditPayment(payment);
    setFormData(payment);
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    setPayments(payments.filter((p) => p.id !== id));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const updatedData = {
      ...formData,
      amount: formData.amount.toString(),
    };
    if (editPayment) {
      setPayments(
        payments.map((p) => (p.id === editPayment.id ? updatedData : p))
      );
    } else {
      setPayments([...payments, { ...updatedData, id: Date.now() }]);
    }
    setIsModalOpen(false);
  };

  // 🧮 Total calculations using useMemo
  const totalAmount = useMemo(() => {
    return payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
  }, [payments]);

  const totalPayments = payments.length;

  return (
    <div className="max-w-7xl mx-auto bg-white shadow-lg rounded-2xl p-6 mt-10 border border-gray-200">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">
          Lead Payment Details
        </h1>

        {/* Details Section */}
        <div className="mb-6 border-b pb-4">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Payment Information
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border text-sm text-left text-gray-600">
              <thead className="bg-gray-100 text-gray-700 uppercase">
                <tr>
                  <th className="px-4 py-2">Pay Slip</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Pay Source</th>
                  <th className="px-4 py-2">Pay Date & Time</th>
                  <th className="px-4 py-2">Update Date & Time</th>
                  <th className="px-4 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b hover:bg-gray-50 transition-all"
                  >
                    <td className="px-4 py-2">{p.paySlip}</td>
                    <td className="px-4 py-2">₹{p.amount}</td>
                    <td className="px-4 py-2">{p.paySource}</td>
                    <td className="px-4 py-2">{p.payDateTime}</td>
                    <td className="px-4 py-2">{p.updateDateTime}</td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => openEditForm(p)}
                        className="text-blue-600 hover:text-blue-800 font-medium mx-1"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-red-600 hover:text-red-800 font-medium mx-1"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}

                {/* 🧾 Calculation Row */}
                <tr className="bg-gray-100 font-semibold text-gray-800">
                  <td className="px-4 py-3 text-right" colSpan={1}>
                    Total Payments:
                  </td>
                  <td className="px-4 py-3">₹{totalAmount.toLocaleString()}</td>
                  <td className="px-4 py-3" colSpan={4}>
                    Total Entries: {totalPayments}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Button Section */}
        <div className="flex justify-center gap-4">
          <button
            onClick={openAddForm}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow hover:bg-blue-700 transition"
          >
            Add
          </button>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6 animate-fadeIn">
            <h2 className="text-xl font-bold text-gray-800 mb-4">
              {editPayment ? "Edit Payment" : "Add Payment"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {["paySlip", "amount", "paySource", "payDateTime", "updateDateTime"].map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.replace(/([A-Z])/g, " $1")}
                  </label>
                  <input
                    type={field.includes("Date") ? "datetime-local" : "text"}
                    value={formData[field]}
                    onChange={(e) =>
                      setFormData({ ...formData, [field]: e.target.value })
                    }
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    required
                  />
                </div>
              ))}

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editPayment ? "Update" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
