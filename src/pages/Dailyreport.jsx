"use client";

import { useState, useEffect, useContext } from "react";
import { toast, Toaster } from "react-hot-toast";
import { Download, Search, X, Filter, Calendar, User, Building } from "lucide-react";
import { AuthContext } from "../App";
import supabase from "../SupaabseClient";

const DailyReport = () => {
  const [trackingData, setTrackingData] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dealerFilter, setDealerFilter] = useState("");
  const [salesPersonFilter, setSalesPersonFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Get user authentication context
  const { currentUser, isAuthenticated } = useContext(AuthContext);

  const userRole = currentUser?.role || "User";
  const currentUserSalesPersonName = currentUser?.salesPersonName || "Unknown User";

  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Updated column mapping based on your tracking_history schema
  const COLUMN_MAPPINGS = {
    "Timestamp": "created_at",
    "Dealer Name": "deler_distributer_site_name",
    "Sales Person Name": "sales_person_name",
    "Remark": "what_did_customer_says",
    "Next Action": "next_action",
    "Status": "status",
    "Stage": "stage",
    "Customer Action": "what_did_customer_says",
    "Order Products": "order_products",
    "Order Value": "value_of_order"
  };

  // Select which columns to display in the table
  const DISPLAY_HEADERS = [
    { id: 'created_at', label: 'Timestamp' },
    { id: 'deler_distributer_site_name', label: 'Dealer Name' },
    { id: 'sales_person_name', label: 'Sales Person' },
    { id: 'what_did_customer_says', label: 'Remark' },
    { id: 'next_action', label: 'Next Action' },
  ];

  // Mobile display headers (shorter)
  const MOBILE_HEADERS = [
    { id: 'created_at', label: 'Time' },
    { id: 'deler_distributer_site_name', label: 'Dealer' },
    { id: 'what_did_customer_says', label: 'Remark' },
  ];

  // Format date with time
  const formatDate = (dateValue) => {
    if (!dateValue) return "—";
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) {
        return dateValue;
      }
      
      // Format as DD/MM/YYYY HH:MM
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch (error) {
      console.error('Date formatting error:', error, 'Original value:', dateValue);
      return dateValue;
    }
  };

  const formatCellValue = (value, headerLabel = '') => {
    if (headerLabel.toLowerCase().includes('date') || headerLabel.toLowerCase().includes('time')) {
      return formatDate(value);
    }
    return value || "—";
  };

  // Set today's date as default filter
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setDateFilter(today);
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isAuthenticated) {
        console.log("Not authenticated. Skipping data fetch for Daily Report.");
        setIsLoading(false);
        return;
      }

      console.log("🔄 Fetching data from Supabase tracking_history table...");

      // Build query based on user role - select all available columns
      let query = supabase
        .from('tracking_history')
        .select('*')
        .order('created_at', { ascending: false });

      // If user is not admin, only show their records
      if (userRole.toLowerCase() !== 'admin') {
        query = query.eq('sales_person_name', currentUserSalesPersonName);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      console.log("✅ Tracking data loaded successfully from Supabase:", data);

      // Format the data for display
      const formattedData = data.map((item, index) => {
        const formattedItem = {
          _id: item.id || `${index}-${Math.random().toString(36).substr(2, 9)}`,
          _rowIndex: index + 1,
          // Include all original data for detail view
          ...item
        };

        // Format display columns
        DISPLAY_HEADERS.forEach(header => {
          const value = item[header.id];
          formattedItem[header.id] = formatCellValue(value, header.label);
        });

        return formattedItem;
      });

      console.log('Formatted data:', formattedData.length, 'records');
      console.log('Sample record:', formattedData[0]);
      setTrackingData(formattedData);
      
      // toast.success(`Loaded ${formattedData.length} records successfully`, {
      //   duration: 3000,
      //   position: "top-right",
      // });

    } catch (err) {
      console.error("❌ Error fetching tracking data:", err);
      setError(err.message);
      toast.error(`Failed to load data: ${err.message}`, {
        duration: 4000,
        position: "top-right",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      fetchData();
    } else if (!isAuthenticated) {
      setIsLoading(false);
      setError("Please log in to view daily reports.");
    }
  }, [isAuthenticated, currentUser]);

  // Parse date for filtering - handles DD/MM/YYYY format with time
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      if (typeof dateStr === 'string' && dateStr.includes('/')) {
        const parts = dateStr.split(' ')[0].split('/'); // Take only date part before space
        if (parts.length === 3) {
          // DD/MM/YYYY format
          return new Date(parts[2], parts[1] - 1, parts[0]);
        }
      }
      return new Date(dateStr);
    } catch {
      return null;
    }
  };

  // Filter data by selected date first, then get dropdown options
  const todaysData = trackingData.filter((item) => {
    if (dateFilter && item.created_at) {
      const itemDate = parseDate(item.created_at);
      const filterDate = new Date(dateFilter);
      
      if (itemDate) {
        return itemDate.toDateString() === filterDate.toDateString();
      }
    }
    return !dateFilter; // If no date filter, return all
  });

  // Get dropdown options from today's data only
  const uniqueDealers = [...new Set(todaysData.map(item => item.deler_distributer_site_name).filter(Boolean))];
  const uniqueSalesPersons = [...new Set(todaysData.map(item => item.sales_person_name).filter(Boolean))];

  // Apply additional filters on today's data
  const filteredTrackingData = todaysData.filter((item) => {
    const term = searchTerm.toLowerCase();
    
    // Search term filter - search across all displayed columns
    const matchesSearchTerm = !searchTerm || DISPLAY_HEADERS.some(header => {
      const value = item[header.id];
      return value && String(value).toLowerCase().includes(term);
    });

    // Dealer filter
    const matchesDealer = !dealerFilter || item.deler_distributer_site_name === dealerFilter;

    // Sales person filter
    const matchesSalesPerson = !salesPersonFilter || item.sales_person_name === salesPersonFilter;

    return matchesSearchTerm && matchesDealer && matchesSalesPerson;
  });

  // PDF download function
  const downloadPDF = async () => {
    if (!filteredTrackingData || filteredTrackingData.length === 0) {
      toast.error("No data to export", { duration: 3000, position: "top-right" });
      return;
    }

    try {
      const loadingToast = toast.loading("Generating PDF...", {
        position: "top-right"
      });

      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const selectedDate = dateFilter ? new Date(dateFilter).toLocaleDateString('en-GB') : 'All dates';

      // Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Daily Report - Tracking History', 20, 20);

      // Meta info
      doc.setFontSize(10);
      doc.text(`Report Date: ${selectedDate}`, 20, 30);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 36);
      doc.text(`Records: ${filteredTrackingData.length}`, 20, 42);

      // Manual table creation
      let yPos = 55;
      const colWidths = [45, 60, 35, 90, 40];
      let xPos = 20;

      // Header row
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      DISPLAY_HEADERS.forEach((header, i) => {
        doc.text(header.label, xPos, yPos);
        xPos += colWidths[i];
      });

      // Data rows
      yPos += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      filteredTrackingData.forEach(item => {
        xPos = 20;
        DISPLAY_HEADERS.forEach((header, i) => {
          const value = String(item[header.id] || '');
          const wrappedText = doc.splitTextToSize(value, colWidths[i] - 2);
          doc.text(wrappedText, xPos, yPos);
          xPos += colWidths[i];
        });

        // Calculate row height based on longest wrapped text
        const maxLines = Math.max(...DISPLAY_HEADERS.map((header, i) => {
          const value = String(item[header.id] || '');
          const wrapped = doc.splitTextToSize(value, colWidths[i] - 2);
          return wrapped.length;
        }));
        yPos += maxLines * 5 + 2;
        
        if (yPos > 180) {
          doc.addPage();
          yPos = 20;
        }
      });

      // Save
      const filename = `Daily_Report_${new Date().toISOString().slice(0,10).replace(/-/g, '_')}.pdf`;
      doc.save(filename);

      toast.dismiss(loadingToast);
      toast.success("PDF downloaded successfully!", {
        duration: 3000,
        position: "top-right"
      });

    } catch (error) {
      console.error("PDF Error:", error);
      toast.error("PDF generation failed.", {
        duration: 4000,
        position: "top-right"
      });
    }
  };

  // Mobile Card Component
  const MobileCardView = ({ items }) => {
    return (
      <div className="flex flex-col h-[calc(100vh-280px)] bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Fixed Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 px-4 py-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
              Records ({items.length})
            </h3>
            <div className="text-xs text-gray-500">
              Scroll to view
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-3 p-4">
            {items.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-500 font-medium">No records found</p>
                <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item._id}
                  className="bg-white rounded-lg border border-gray-200 p-4 space-y-3 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedRecord(item);
                    setIsDialogOpen(true);
                  }}
                >
                  {MOBILE_HEADERS.map((header, index) => {
                    const value = item[header.id] || "—";
                    return (
                      <div key={header.id} className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-500 min-w-[80px] flex-shrink-0">
                          {header.label}:
                        </span>
                        <span className="text-sm font-semibold text-gray-900 text-right flex-1 ml-2 break-words">
                          {value}
                        </span>
                      </div>
                    );
                  })}
                  <div className="pt-2 border-t border-gray-100">
                    <span className="text-xs text-blue-600 font-medium">Tap to view details →</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  // Desktop Table Component
  const DesktopTableView = ({ items }) => {
    return (
      <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
        {/* SCROLLABLE TABLE CONTENT */}
        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {DISPLAY_HEADERS.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap bg-gray-50"
                  >
                    {header.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={DISPLAY_HEADERS.length}
                    className="px-6 py-12 text-center text-gray-500 font-medium text-base"
                  >
                    {dateFilter 
                      ? `No records found for ${new Date(dateFilter).toLocaleDateString('en-GB')}`
                      : "No tracking data found."}
                    {(searchTerm || dealerFilter || salesPersonFilter) && (
                      <div className="text-sm mt-2">Try clearing the search or filter options.</div>
                    )}
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item._id}
                    className="hover:bg-gray-50 cursor-pointer transition duration-150 ease-in-out"
                    onClick={() => {
                      setSelectedRecord(item);
                      setIsDialogOpen(true);
                    }}
                  >
                    {DISPLAY_HEADERS.map((header) => (
                      <td
                        key={header.id}
                        className="px-6 py-4 text-sm text-gray-800"
                      >
                        <div className="max-w-xs truncate" title={item[header.id]}>
                          {item[header.id] || "—"}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Show record count */}
        {items.length > 0 && (
          <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600 text-center">
            Showing {items.length} records
            {dateFilter && ` for ${new Date(dateFilter).toLocaleDateString('en-GB')}`}
            {(dealerFilter || salesPersonFilter) && " (filtered)"}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading tracking data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Error Loading Tracking Data
          </h3>
          <p className="text-red-600 font-medium mb-4">{error}</p>
          <button
            onClick={fetchData}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 p-4 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Main Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-4 py-6 lg:px-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="text-center lg:text-left">
                  <h3 className="text-xl lg:text-2xl font-bold text-white mb-2">
                    Daily Report
                  </h3>
                  <p className="text-orange-50 text-sm lg:text-lg">
                    Tracking History & Dealer Interactions
                  </p>
                  <p className="text-orange-100 text-xs lg:text-sm mt-2">
                    Current User: <span className="font-semibold">{currentUserSalesPersonName}</span> (Role: <span className="font-semibold">{userRole}</span>)
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {/* Mobile Filter Toggle */}
                  {isMobile && (
                    <div className="relative">
                      <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className="bg-white/20 hover:bg-white/30 text-white font-medium py-2 px-3 rounded-lg transition-all duration-200 flex items-center gap-2"
                      >
                        <Filter className="h-4 w-4" />
                        Filters
                      </button>
                    </div>
                  )}
                  <button
                    onClick={downloadPDF}
                    disabled={filteredTrackingData.length === 0}
                    className="bg-white/20 hover:bg-white/30 text-white font-medium py-2 px-3 lg:px-4 rounded-lg transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm lg:text-base"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Export PDF</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Filters Section */}
            <div className="p-4 lg:p-8">
              {/* Mobile Filter Dropdown */}
              {isMobile && isFilterOpen && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="search"
                      placeholder="Search records..."
                      className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Calendar className="h-4 w-4" />
                      <span>Date Filter</span>
                    </div>
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Building className="h-4 w-4" />
                      <span>Dealer Filter</span>
                    </div>
                    <select
                      value={dealerFilter}
                      onChange={(e) => setDealerFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">All Dealers</option>
                      {uniqueDealers.map(dealer => (
                        <option key={dealer} value={dealer}>{dealer}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <User className="h-4 w-4" />
                      <span>Sales Person</span>
                    </div>
                    <select
                      value={salesPersonFilter}
                      onChange={(e) => setSalesPersonFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">All Sales Persons</option>
                      {uniqueSalesPersons.map(person => (
                        <option key={person} value={person}>{person}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Desktop Filters */}
              {!isMobile && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="search"
                      placeholder="Search records..."
                      className="w-full pl-10 pr-4 py-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <div>
                    <input
                      type="date"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                      className="w-full px-4 py-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <select
                      value={dealerFilter}
                      onChange={(e) => setDealerFilter(e.target.value)}
                      className="w-full px-4 py-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">All Dealers</option>
                      {uniqueDealers.map(dealer => (
                        <option key={dealer} value={dealer}>{dealer}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <select
                      value={salesPersonFilter}
                      onChange={(e) => setSalesPersonFilter(e.target.value)}
                      className="w-full px-4 py-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">All Sales Persons</option>
                      {uniqueSalesPersons.map(person => (
                        <option key={person} value={person}>{person}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Mobile Search Bar (when filters are closed) */}
              {isMobile && !isFilterOpen && (
                <div className="mb-4 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="search"
                    placeholder="Search records..."
                    className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              )}

              {/* Data Display */}
              {isMobile ? (
                <MobileCardView items={filteredTrackingData} />
              ) : (
                <DesktopTableView items={filteredTrackingData} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* View Details Dialog */}
      {isDialogOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-3xl rounded-lg bg-white p-6 shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h2 className="text-xl lg:text-2xl font-bold text-gray-800">
                Tracking Record Details
              </h2>
              <button
                onClick={() => setIsDialogOpen(false)}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 py-2">
              {Object.keys(COLUMN_MAPPINGS).map((label) => {
                const columnId = COLUMN_MAPPINGS[label];
                const value = selectedRecord[columnId];
                if (value && String(value).trim() !== "" && value !== "—") {
                  return (
                    <div key={columnId} className="flex flex-col">
                      <span className="text-sm font-medium text-gray-500">
                        {label}
                      </span>
                      <span className="text-base font-semibold text-gray-900 break-words">
                        {value}
                      </span>
                    </div>
                  );
                }
                return null;
              })}
            </div>

            <div className="flex justify-end border-t pt-4 mt-6">
              <button
                onClick={() => setIsDialogOpen(false)}
                className="inline-flex items-center justify-center rounded-md text-base font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 h-10 px-5 py-2 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DailyReport;