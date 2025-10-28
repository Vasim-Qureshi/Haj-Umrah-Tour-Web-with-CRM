import React from "react";
import PackageDetailTable from "../components/PackageDetails.jsx";
import PaymentDetails from "../components/PaymentDetails.jsx";

const LeadDetailPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-7xl mx-auto px-4 space-y-10">
        {/* Page Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800">
            Lead Details Overview
          </h1>
          <p className="text-gray-500 mt-2">
            View family package details, payment information, and manage updates.
          </p>
        </header>

        {/* Family Package Table */}
        <section>
          <PackageDetailTable />
        </section>

        {/* Payment Section */}
        <section>
          <PaymentDetails />
        </section>

        {/* Footer */}
        <footer className="text-center text-gray-400 text-sm mt-10 border-t pt-6">
          <p>
            © {new Date().getFullYear()} Umrah Tour Travels CRM. All rights
            reserved.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default LeadDetailPage;
