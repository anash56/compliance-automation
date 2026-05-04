import { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import Navbar from '../components/Navbar';
import api from '../services/api';
import { RootState } from '../store';
// @ts-ignore
import html2pdf from 'html2pdf.js/dist/html2pdf.bundle.min.js';

export default function ReportsPage() {
  const { companies, selectedCompanyId } = useSelector((state: RootState) => state.company);
  const selectedCompany = companies.find(c => c.id === selectedCompanyId) || null;
  
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState<any>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedCompany) {
      fetchReportData();
    } else {
      setReportData(null);
    }
  }, [selectedCompany?.id, year]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/companies/${selectedCompany?.id}/dashboard?year=${year}`);
      if (response.data.success) {
        setReportData(response.data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    const element = reportRef.current;
    if (!element) return;
    
    const opt = {
      margin: 0.5,
      filename: `Financial_Report_${selectedCompany?.companyName.replace(/\s+/g, '_') || 'Company'}_${year}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save();
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Financial Reports</h1>
              <p className="text-gray-600 mt-1">Comprehensive view of your compliance and tax data</p>
            </div>
            
            <div className="bg-white px-4 py-2 border border-gray-200 rounded-lg shadow-sm flex items-center gap-3">
              <label className="text-sm font-semibold text-gray-700">Financial Year</label>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="border-none bg-transparent focus:ring-0 text-blue-600 font-bold"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}-{String(y + 1).slice(-2)}</option>
                ))}
              </select>
            </div>
          </div>

          {!selectedCompany ? (
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200 text-blue-900">
              Please select or register a workspace to view reports.
            </div>
          ) : loading ? (
            <div className="text-center py-12 text-gray-500">Loading report data...</div>
          ) : reportData ? (
            <div className="space-y-6" ref={reportRef}>
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <p className="text-sm text-gray-500 font-medium">Total Revenue (Invoiced)</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">INR {reportData.totalInvoiceValue.toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <p className="text-sm text-gray-500 font-medium">Total GST Collected</p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">INR {reportData.totalGstCollected.toLocaleString()}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                  <p className="text-sm text-gray-500 font-medium">Estimated Tax Outflow</p>
                  <p className="text-3xl font-bold text-red-600 mt-2">INR {reportData.estimatedComplianceOutflow.toLocaleString()}</p>
                </div>
              </div>

              {/* Detailed Tables */}
              <div className="grid grid-cols-2 gap-6">
                {/* GST Summary */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-bold text-gray-800">GST Compliance Summary</h3>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-gray-600">Total Invoices Generated</span>
                        <span className="font-semibold">{reportData.gstInvoiceCount}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-gray-600">GST Returns Filed</span>
                        <span className="font-semibold text-green-600">{reportData.gstReturnsFiled} Returns</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-gray-600">Total Output Tax (Liability)</span>
                        <span className="font-semibold text-gray-900">INR {reportData.totalGstCollected.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* TDS Summary */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                        <h3 className="font-bold text-gray-800">TDS Compliance Summary</h3>
                  </div>
                  <div className="p-6">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-gray-600">Vendor Payments Recorded</span>
                        <span className="font-semibold">{reportData.tdsRecordCount}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-gray-600">Form 26Q Filed</span>
                        <span className="font-semibold text-green-600">{reportData.tdsReturnsFiled} Quarters</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-100">
                        <span className="text-gray-600">Total TDS Deducted</span>
                        <span className="font-semibold text-gray-900">INR {reportData.totalTdsDeducted.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Action Button */}
              <div className="flex justify-end gap-3 mt-4" data-html2canvas-ignore>
                <button onClick={downloadPDF} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition shadow">
                  Download PDF
                </button>
                <button onClick={() => window.print()} className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-semibold transition shadow">
                  Print Full Report
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}