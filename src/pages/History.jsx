"use client";

import { useState, useEffect, useContext } from "react";
import { toast, Toaster } from "react-hot-toast";
import { Download, Filter, Search, X, ChevronDown, ChevronUp, Calendar, User, Building, MapPin } from "lucide-react";
import { AuthContext } from "../App";
import supabase from "../SupaabseClient";

const History = () => {
  const [indents, setIndents] = useState([]);
  const [selectedIndent, setSelectedIndent] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dealerCodeFilter, setDealerCodeFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [salesPersonFilter, setSalesPersonFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [sheetHeaders, setSheetHeaders] = useState([]);
  const [error, setError] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [expandedCards, setExpandedCards] = useState(new Set());

  // Get user authentication context
  const { currentUser, isAuthenticated } = useContext(AuthContext);

  // Extract salesPersonName and userRole from currentUser
  const currentUserSalesPersonName = currentUser?.salesPersonName || "Unknown User";
  const userRole = currentUser?.role || "User";

  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isAuthenticated) {
        console.log("Not authenticated. Skipping data fetch for History.");
        setIsLoading(false);
        return;
      }

      console.log("🔄 Fetching data from Supabase: tracking_history...");

      const { data, error } = await supabase
        .from("tracking_history")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error("No data found in Supabase table");

      console.log("✅ tracking_history data loaded successfully from Supabase");

      // Define column mapping for display
      const COLUMN_MAPPINGS = {
        "Timestamp": "created_at",
        "Dealer Code": "dealer_code", 
        "Sales Person Name": "sales_person_name",
        "Area Name": "area_name",
        "Stage": "stage",
        "Status": "status",
        "Last Date of Call": "last_date_of_call",
        "What Did Customer Say": "what_did_customer_says",
        "Next Action": "next_action",
        "Next Date of Call": "next_date_of_call",
        "Order Qty": "order_qty",
        "Order Products": "order_products",
        "Value of Order": "value_of_order",
        "Payment (Yes/No)": "payment_yes_no",
        "Dealer/Distributor Site": "deler_distributer_site_name",
        "Select Value":"select_value",
        
      };

      const headers = Object.keys(COLUMN_MAPPINGS).map((label) => ({
        id: COLUMN_MAPPINGS[label],
        label,
      }));

      setSheetHeaders(headers);

      const items = data.map((row, index) => ({
        _id: `${index}-${Math.random().toString(36).substr(2, 9)}`,
        _rowIndex: index + 1,
        ...row,
      }));

      setIndents(items);
    } catch (err) {
      console.error("❌ Error fetching tracking_history data:", err);
      setError(err.message);
      toast.error(`Failed to load data: ${err.message}`, {
        duration: 4000,
        position: "top-right",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Improved date formatting function to handle all date formats
  const formatDateToDDMMYYYY = (dateValue) => {
    if (!dateValue) return "—";
    
    try {
      let date;
      
      if (typeof dateValue === 'string') {
        if (dateValue.includes('T')) {
          date = new Date(dateValue);
        }
        else if (dateValue.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
          const [day, month, year] = dateValue.split('/');
          date = new Date(year, month - 1, day);
        }
        else if (dateValue.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
          date = new Date(dateValue);
        }
        else if (dateValue.startsWith('Date(')) {
          const match = dateValue.match(/Date\((\d{4}),(\d{1,2}),(\d{1,2})\)/);
          if (match) {
            const year = parseInt(match[1]);
            const month = parseInt(match[2]);
            const day = parseInt(match[3]);
            date = new Date(year, month, day);
          } else {
            date = new Date(dateValue);
          }
        }
        else {
          date = new Date(dateValue);
        }
      }
      else if (typeof dateValue === 'number' && dateValue > 0) {
        const excelEpoch = new Date(1899, 11, 30);
        date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
      }
      else if (dateValue instanceof Date) {
        date = dateValue;
      }
      else {
        return dateValue;
      }

      if (!date || isNaN(date.getTime())) {
        console.warn('Invalid date value:', dateValue);
        return dateValue;
      }

      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}/${month}/${year}`;
      
    } catch (error) {
      console.error('Date formatting error:', error, 'Original value:', dateValue);
      return dateValue;
    }
  };

  // Function to check if a value should be formatted as date
  const isDateColumn = (headerLabel) => {
    const dateKeywords = ['date', 'time', 'created', 'updated', 'modified', 'call'];
    return dateKeywords.some(keyword => 
      headerLabel.toLowerCase().includes(keyword)
    );
  };

  // Function to format cell value based on header type
  const formatCellValue = (value, headerLabel) => {
    if (isDateColumn(headerLabel) && value) {
      return formatDateToDDMMYYYY(value);
    }
    return value || "—";
  };

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      fetchData();
    } else if (!isAuthenticated) {
      setIsLoading(false);
      setError("Please log in to view interaction history.");
    }
  }, [isAuthenticated, currentUser]);

  // Get unique values for filters
  const uniqueDealers = [...new Set(indents.map(item => item.deler_distributer_site_name).filter(Boolean))];
  const uniqueStages = [...new Set(indents.map(item => item.stage).filter(Boolean))];
  const uniqueSalesPersons = [...new Set(indents.map(item => item.sales_person_name).filter(Boolean))];

  const filteredIndents = indents.filter((item) => {
    const term = searchTerm.toLowerCase();
    const dealerCodeVal = String(item.dealer_code || "").toLowerCase();
    const stageVal = String(item.stage || "").toLowerCase();
    const salesPersonVal = String(item.sales_person_name || "").toLowerCase();
    const dealerNameVal = String(item.deler_distributer_site_name || "").toLowerCase();

    // User-specific filter for regular users
    const matchesUserSalesPerson = userRole.toLowerCase() === "admin" ||
      (salesPersonVal === currentUserSalesPersonName.toLowerCase());

    const matchesSearchTerm = sheetHeaders.some((header) => {
      const value = item[header.id];
      return value && String(value).toLowerCase().includes(term);
    });

    const matchesDealerCode = dealerCodeFilter
      ? dealerCodeVal.includes(dealerCodeFilter.toLowerCase())
      : true;

    const matchesStage = stageFilter
      ? stageVal.includes(stageFilter.toLowerCase())
      : true;

    const matchesSalesPerson = salesPersonFilter
      ? salesPersonVal === salesPersonFilter.toLowerCase()
      : true;

    const matchesDate = dateFilter
      ? item.created_at && new Date(item.created_at).toISOString().split('T')[0] === dateFilter
      : true;

    return matchesSearchTerm && matchesDealerCode && matchesStage && matchesUserSalesPerson && matchesSalesPerson && matchesDate;
  });

  const exportData = () => {
    try {
      const csvContent = [
        sheetHeaders.map((header) => header.label).join(","),
        ...filteredIndents.map((item) =>
          sheetHeaders
            .map((header) => {
              let value = item[header.id] || "";
              if (isDateColumn(header.label) && value) {
                value = formatDateToDDMMYYYY(value);
              }
              return typeof value === "string" &&
                (value.includes(",") || value.includes('"'))
                ? `"${value.replace(/"/g, '""')}"`
                : value;
            })
            .join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `Interaction_History_${new Date().toISOString().split("T")[0]}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Data exported successfully!", {
        duration: 3000,
        position: "top-right",
        style: {
          backgroundColor: '#4CAF50',
          color: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        },
        iconTheme: {
          primary: 'white',
          secondary: '#4CAF50',
        }
      });
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data", {
        duration: 3000,
        position: "top-right",
      });
    }
  };

  const toggleCardExpansion = (cardId) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setDateFilter("");
    setDealerCodeFilter("");
    setStageFilter("");
    setSalesPersonFilter("");
    setSearchTerm("");
  };

  // Mobile Card Component - Updated to show Area Name
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
              items.map((item) => {
                const isExpanded = expandedCards.has(item._id);
                // Primary fields for collapsed view: Dealer Name, Area Name, Stage, Timestamp
                const primaryFields = [
                  { id: 'deler_distributer_site_name', label: 'Dealer' },
                  { id: 'area_name', label: 'Area' },
                  { id: 'stage', label: 'Stage' },
                  { id: 'created_at', label: 'Time' }
                ];
                
                // All other fields for expanded view
                const secondaryFields = sheetHeaders.filter(header => 
                  !primaryFields.some(primary => primary.id === header.id)
                );

                return (
                  <div
                    key={item._id}
                    className="bg-white rounded-lg border border-gray-200 p-4 space-y-3 hover:shadow-md transition-shadow"
                  >
                    {/* Card Header - Always Visible */}
                    <div 
                      className="cursor-pointer"
                      onClick={() => toggleCardExpansion(item._id)}
                    >
                      {/* Dealer Name and Expand Button */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex justify-between"> <h3 className="font-bold text-gray-900 text-base mb-1">
                            {item.deler_distributer_site_name || "Unknown Dealer"}
                          </h3><p className="font-semibold text-gray-700 text-sm">{item.select_value}</p></div>
                         
                          {/* Area Name with icon */}
                          {item.area_name && (
                            <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                              <MapPin className="h-3 w-3" />
                              <span className="font-medium">{item.area_name}</span>
                            </div>
                          )}
                        </div>
                        <button className="text-gray-400 hover:text-gray-600 transition-colors ml-2">
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </div>

                      {/* Primary Info Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {primaryFields.map((field) => {
                          if (field.id === 'deler_distributer_site_name' || field.id === 'area_name') {
                            return null; // Skip these as they're already shown above
                          }
                          return (
                            <div key={field.id}>
                              <span className="text-gray-500 font-medium">{field.label}:</span>
                              <p className="text-gray-900 font-semibold truncate">
                                {formatCellValue(item?.[field.id], field.label)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Expandable Content */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-gray-100 space-y-2">
                        {secondaryFields.map((header) => (
                          <div key={header.id} className="flex justify-between items-start">
                            <span className="text-gray-600 font-medium text-xs flex-shrink-0 mr-2">
                              {header.label}:
                            </span>
                            <span className="text-gray-900 font-semibold text-xs text-right break-words flex-1">
                              {formatCellValue(item?.[header.id], header.label)}
                            </span>
                          </div>
                        ))}
                        
                        {/* View Details Button */}
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <button
                            className="w-full bg-gradient-to-r from-orange-100 to-orange-50 text-orange-700 border border-orange-200 hover:from-orange-200 hover:to-orange-100 font-medium py-2 rounded-lg text-xs flex items-center justify-center gap-2 transition-all duration-200"
                            onClick={() => {
                              setSelectedIndent(item);
                              setIsDialogOpen(true);
                            }}
                          >
                            View Full Details
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
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
                {sheetHeaders.map((header) => (
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
                    colSpan={sheetHeaders.length}
                    className="px-6 py-12 text-center text-gray-500 font-medium text-base"
                  >
                    {searchTerm || dealerCodeFilter || stageFilter || dateFilter || salesPersonFilter
                      ? "No results found for your current filters."
                      : "No interaction data found."}
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item._id}
                    className="hover:bg-gray-50 cursor-pointer transition duration-150 ease-in-out"
                    onClick={() => {
                      setSelectedIndent(item);
                      setIsDialogOpen(true);
                    }}
                  >
                    {sheetHeaders.map((header) => (
                      <td
                        key={header.id}
                        className="px-6 py-4 text-sm text-gray-800"
                      >
                        <div className="max-w-xs truncate" title={item[header.id]}>
                          {formatCellValue(item[header.id], header.label)}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading interaction data...</p>
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
            Error Loading Interaction Data
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
                    Interaction History
                  </h3>
                  <p className="text-orange-50 text-sm lg:text-lg hidden md:block">
                    View history of all dealer interactions
                  </p>
                  <p className="text-orange-100 text-xs lg:text-sm mt-2 hidden md:block">
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
                    onClick={exportData}
                    className="bg-white/20 hover:bg-white/30 text-white font-medium py-2 px-3 lg:px-4 rounded-lg transition-all duration-200 flex items-center gap-2 text-sm lg:text-base"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Export</span>
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
                      <span>Dealer Name</span>
                    </div>
                    <select
                      value={dealerCodeFilter}
                      onChange={(e) => setDealerCodeFilter(e.target.value)}
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
                      <span>Stage</span>
                    </div>
                    <select
                      value={stageFilter}
                      onChange={(e) => setStageFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">All Stages</option>
                      {uniqueStages.map(stage => (
                        <option key={stage} value={stage}>{stage}</option>
                      ))}
                    </select>
                  </div>

                  {/* Sales Person Filter (only for admin) */}
                  {userRole.toLowerCase() === "admin" && (
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
                  )}

                  {/* Clear Filters Button */}
                  <div className="pt-2 border-t border-gray-200">
                    <button
                      onClick={clearFilters}
                      className="w-full text-xs text-orange-600 hover:text-orange-700 font-medium py-2 rounded-md hover:bg-orange-50 transition-colors"
                    >
                      Clear All Filters
                    </button>
                  </div>
                </div>
              )}

              {/* Desktop Filters */}
              {!isMobile && (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
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
                      value={dealerCodeFilter}
                      onChange={(e) => setDealerCodeFilter(e.target.value)}
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
                      value={stageFilter}
                      onChange={(e) => setStageFilter(e.target.value)}
                      className="w-full px-4 py-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">All Stages</option>
                      {uniqueStages.map(stage => (
                        <option key={stage} value={stage}>{stage}</option>
                      ))}
                    </select>
                  </div>

                  {userRole.toLowerCase() === "admin" && (
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
                  )}
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
                <MobileCardView items={filteredIndents} />
              ) : (
                <DesktopTableView items={filteredIndents} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* View Details Dialog */}
      {isDialogOpen && selectedIndent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-3xl rounded-lg bg-white p-6 shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h2 className="text-xl lg:text-2xl font-bold text-gray-800">
                Interaction Details
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
              {sheetHeaders.map((header) => {
                const value = selectedIndent[header.id];
                if (value && String(value).trim() !== "") {
                  return (
                    <div key={header.id} className="flex flex-col">
                      <span className="text-sm font-medium text-gray-500">
                        {header.label}
                      </span>
                      <span className="text-base font-semibold text-gray-900 break-words">
                        {formatCellValue(value, header.label)}
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

export default History;