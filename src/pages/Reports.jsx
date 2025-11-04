"use client";

import React, { useState, useEffect, useContext, useRef } from "react";
import { toast, Toaster } from "react-hot-toast";
import { Download, Filter, Search, X, Calendar, User, Building } from "lucide-react";
import { AuthContext } from "../App";
import supabase from "../SupaabseClient";

const Reports = () => {
  const [indents, setIndents] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [salesPersonFilter, setSalesPersonFilter] = useState("");
  const [dealerNameFilter, setDealerNameFilter] = useState("");
  const [lastActionFilter, setLastActionFilter] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const { currentUser, isAuthenticated } = useContext(AuthContext);
  const currentUserSalesPersonName = currentUser?.salesPersonName || "Unknown User";
  const userRole = currentUser?.role || "User";

  const [isLoading, setIsLoading] = useState(true);
  const [sheetHeaders, setSheetHeaders] = useState([]);
  const [error, setError] = useState(null);

  const DISPLAY_COLUMNS = [4, 5, 8, 21, 26, 27, 28, 29, 30, 31, 32];

  const COLUMN_MAPPING = {
    'sales_person_name': 'col4',
    'dealer_name': 'col5', 
    'dealer_size': 'col8',
    'last_date_of_call': 'col21',
    'last_order_before': 'col26',
    'last_call_before': 'col27',
    'mtd': 'col28',
    'ytd': 'col29',
    'pending_amount': 'col30',
    'no_of_bills': 'col31',
    'status': 'col32'
  };

  // Check screen size on mount and resize
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const formatDate = (value) => {
    if (!value) return "";

    if (typeof value === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      return value;
    }

    let date;

    if (typeof value === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      date = new Date(excelEpoch.getTime() + (value * 24 * 60 * 60 * 1000));
    } else if (typeof value === 'string') {
      const cleanValue = value.trim();
      const dateMatch = cleanValue.match(/Date\((\d{4}),(\d{1,2}),(\d{1,2})\)/);
      if (dateMatch) {
        const [, year, month, day] = dateMatch;
        date = new Date(parseInt(year), parseInt(month), parseInt(day));
      } else {
        date = new Date(cleanValue);
      }
    } else {
      date = new Date(value);
    }

    if (isNaN(date.getTime())) {
      return value;
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  };

  const isDateValue = (value, headerLabel = '') => {
    if (!value) return false;

    const headerLower = headerLabel.toLowerCase();
    const isDateHeader = headerLower.includes('date') ||
      headerLower.includes('time') ||
      headerLower.includes('created') ||
      headerLower.includes('updated') ||
      headerLower.includes('modified') ||
      headerLower.includes('order');

    if (isDateHeader) return true;

    if (typeof value === 'number' && value > 40000 && value < 60000) {
      return true;
    }

    if (typeof value === 'string') {
      const datePatterns = [
        /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/,
        /^\d{2}\/\d{2}\/\d{4}$/,
        /^\d{1,2}\/\d{1,2}\/\d{4}$/,
        /Date\(\d{4},\d{1,2},\d{1,2}\)/,
        /^(\w{3}\s\d{1,2},\s\d{4}|\d{1,2}\s\w{3}\s\d{4})$/
      ];

      return datePatterns.some(pattern => pattern.test(value));
    }

    return false;
  };

  const formatCellValue = (value, headerLabel = '') => {
    if (isDateValue(value, headerLabel)) {
      return formatDate(value);
    }
    return value || "—";
  };

  const fetchFMSData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isAuthenticated) {
        console.log("Not authenticated. Skipping data fetch.");
        setIsLoading(false);
        return;
      }

      console.log("🔄 Fetching data from Supabase FMS table...");

      const { data, error } = await supabase
        .from('FMS')
        .select(`
          id,
          timestamp,
          sales_person_name,
          dealer_name,
          dealer_size,
          last_date_of_call,
          next_date_of_call,
          last_order_before,
          last_call_before,
          mtd,
          ytd,
          pending_amount,
          no_of_bills,
          status,
          status2,
          order_qty,
          value_of_order,
          contact_number,
          email_address
        `)
        .order('timestamp', { ascending: false });

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      console.log("✅ FMS data loaded successfully from Supabase");

      const fmsHeaders = [
        { id: 'sales_person_name', label: 'Sales Person Name' },
        { id: 'dealer_name', label: 'Dealer Name' },
        { id: 'dealer_size', label: 'Dealer Size' },
        { id: 'last_date_of_call', label: 'Last Action' },
        { id: 'last_order_before', label: 'Last Order Before' },
        { id: 'last_call_before', label: 'Last Call Before' },
        { id: 'mtd', label: 'MTD' },
        { id: 'ytd', label: 'YTD' },
        { id: 'pending_amount', label: 'Pending Amount' },
        { id: 'no_of_bills', label: 'No Of Bills' },
        { id: 'status', label: 'Status' }
      ];

      setSheetHeaders(fmsHeaders);

      const displayColumnKeys = Object.values(COLUMN_MAPPING);

      const fmsItems = data.map((item, index) => {
        const itemObj = {
          _id: item.id || `${index}-${Math.random().toString(36).substr(2, 9)}`,
          _rowIndex: index + 1,
        };

        fmsHeaders.forEach(header => {
          const rawValue = item[header.id];
          const colKey = COLUMN_MAPPING[header.id];
          
          if (colKey) {
            itemObj[colKey] = rawValue;
            itemObj[`${colKey}_formatted`] = formatCellValue(rawValue, header.label);
          }
        });

        return itemObj;
      });

      const cleanedItems = fmsItems.filter((item) => {
        return displayColumnKeys.some(colKey => {
          const value = item[colKey];
          return value !== null && value !== undefined && String(value).trim() !== "";
        });
      });

      setIndents(cleanedItems);

    } catch (err) {
      console.error("❌ Error fetching FMS data from Supabase:", err);
      setError(err.message);
      toast.error(`Failed to load FMS data: ${err.message}`, {
        duration: 4000,
        position: "top-right",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      fetchFMSData();
    } else if (!isAuthenticated) {
      setIsLoading(false);
      setError("Please log in to view Reports data.");
    }
  }, [isAuthenticated, currentUser]);

  const filteredIndents = indents.filter((item) => {
    const term = searchTerm.toLowerCase();

    const matchesUserSalesPerson = userRole.toLowerCase() === "admin" ||
      (String(item.col4 || "").toLowerCase() === currentUserSalesPersonName.toLowerCase());

    const salesPersonVal = String(item.col4 || "").toLowerCase();
    const dealerNameVal = String(item.col5 || "").toLowerCase();
    const lastActionVal = String(item.col21 || "").toLowerCase();

    const matchesSearchTerm = DISPLAY_COLUMNS.some((colIndex) => {
      const value = item[`col${colIndex}`];
      return value && String(value).toLowerCase().includes(term);
    });

    const matchesSalesPersonFilter = salesPersonFilter
      ? salesPersonVal.includes(salesPersonFilter.toLowerCase())
      : true;
    
    const matchesDealerNameFilter = dealerNameFilter
      ? dealerNameVal.includes(dealerNameFilter.toLowerCase())
      : true;

    const matchesLastActionFilter = lastActionFilter
      ? lastActionVal.includes(lastActionFilter.toLowerCase())
      : true;

    return matchesSearchTerm && matchesSalesPersonFilter && matchesDealerNameFilter && matchesLastActionFilter && matchesUserSalesPerson;
  });

  // Get unique values for dropdowns
  const uniqueSalesPersons = [...new Set(indents.map(item => item.col4).filter(Boolean))];
  const uniqueDealerNames = [...new Set(indents.map(item => item.col5).filter(Boolean))];
  const uniqueLastActions = [...new Set(indents.map(item => item.col21).filter(Boolean))];

  const exportData = () => {
    try {
      const csvContent = [
        sheetHeaders.map((header) => header.label).join(","),
        ...filteredIndents.map((item) =>
          sheetHeaders
            .map((header) => {
              const colKey = COLUMN_MAPPING[header.id];
              const formattedValue = item[`${colKey}_formatted`] || "—";

              return typeof formattedValue === "string" &&
                (formattedValue.includes(",") || formattedValue.includes('"') || formattedValue.includes('\n'))
                ? `"${String(formattedValue).replace(/"/g, '""')}"`
                : String(formattedValue);
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
        `Reports_Data_${new Date().toISOString().split("T")[0]}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Data exported successfully!", {
        duration: 3000,
        position: "top-right",
      });

    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data", {
        duration: 3000,
        position: "top-right",
      });
    }
  };

  // Mobile Card Component with fixed header and scrollable content
  const MobileCardView = ({ items }) => {
    return (
      <div className="flex flex-col h-[calc(100vh-300px)] bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Fixed Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 px-4 py-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
              Dealer Records ({items.length})
            </h3>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 p-4">
            {items.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-slate-400 mb-2">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-slate-500 font-medium">No results found.</p>
                <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filters</p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item._id}
                  className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-3 hover:shadow-md transition-shadow"
                >
                  {sheetHeaders.map((header, index) => {
                    const colKey = COLUMN_MAPPING[header.id];
                    const formattedValue = item[`${colKey}_formatted`] || "—";
                    
                    return (
                      <div key={header.id} className="flex justify-between items-start">
                        <span className="text-sm font-medium text-slate-500 min-w-[120px] flex-shrink-0">
                          {header.label}:
                        </span>
                        <span className="text-sm font-semibold text-slate-900 text-right flex-1 ml-2 break-words">
                          {formattedValue}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  // Desktop Table Component with synchronized horizontal scrolling
  const DesktopTableView = ({ items }) => {
    const [scrollLeft, setScrollLeft] = useState(0);
    const headerRef = React.useRef(null);
    const bodyRef = React.useRef(null);

    const handleBodyScroll = (e) => {
      const scrollLeft = e.target.scrollLeft;
      setScrollLeft(scrollLeft);
      if (headerRef.current) {
        headerRef.current.scrollLeft = scrollLeft;
      }
    };

    const handleHeaderScroll = (e) => {
      const scrollLeft = e.target.scrollLeft;
      setScrollLeft(scrollLeft);
      if (bodyRef.current) {
        bodyRef.current.scrollLeft = scrollLeft;
      }
    };

    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white">
        {/* Fixed Header with horizontal scroll */}
        <div 
          ref={headerRef}
          className="sticky top-0 z-20 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200 overflow-hidden"
          onScroll={handleHeaderScroll}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="min-w-max">
            <table className="w-full">
              <thead>
                <tr>
                  {sheetHeaders.map((header) => (
                    <th
                      key={header.id}
                      className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap min-w-[150px]"
                    >
                      {header.label}
                    </th>
                  ))}
                </tr>
              </thead>
            </table>
          </div>
        </div>

        {/* Scrollable Body with synchronized horizontal scroll */}
        <div 
          ref={bodyRef}
          className="overflow-auto max-h-[calc(100vh-400px)]"
          onScroll={handleBodyScroll}
        >
          <div className="min-w-max">
            <table className="w-full">
              <tbody className="bg-white divide-y divide-slate-200">
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={sheetHeaders.length}
                      className="px-6 py-12 text-center text-slate-500 font-medium"
                    >
                      No results found.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item._id}
                      className="hover:bg-slate-50 transition-colors duration-150"
                    >
                      {sheetHeaders.map((header) => {
                        const colKey = COLUMN_MAPPING[header.id];
                        const formattedValue = item[`${colKey}_formatted`] || "—";

                        return (
                          <td
                            key={header.id}
                            className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 min-w-[150px]"
                          >
                            {formattedValue}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  if (!isAuthenticated || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          {(!isAuthenticated && !isLoading) ? (
            <>
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
              <p className="text-slate-600 font-medium">Please log in to view this page.</p>
            </>
          ) : (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-slate-600 font-medium">Loading Reports data...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-teal-50 flex items-center justify-center">
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
          <h3 className="lg:text-lg md:text-md sm:text-sm font-medium text-gray-900 mb-2">
            Error Loading Reports Data
          </h3>
          <p className="text-red-600 font-medium mb-4">{error}</p>
          <button
            onClick={fetchFMSData}
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
                    Dealer Performance Report
                  </h3>
                  <p className="text-orange-50 text-sm lg:text-lg hidden md:block">
                    Comprehensive view of all dealers and their performance metrics
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
                      placeholder="Search dealers..."
                      className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
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

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Building className="h-4 w-4" />
                      <span>Dealer Name</span>
                    </div>
                    <select
                      value={dealerNameFilter}
                      onChange={(e) => setDealerNameFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">All Dealers</option>
                      {uniqueDealerNames.map(dealer => (
                        <option key={dealer} value={dealer}>{dealer}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Calendar className="h-4 w-4" />
                      <span>Last Action</span>
                    </div>
                    <select
                      value={lastActionFilter}
                      onChange={(e) => setLastActionFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">All Actions</option>
                      {uniqueLastActions.map(action => (
                        <option key={action} value={action}>{action}</option>
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
                      placeholder="Search dealers..."
                      className="w-full pl-10 pr-4 py-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
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

                  <div>
                    <select
                      value={dealerNameFilter}
                      onChange={(e) => setDealerNameFilter(e.target.value)}
                      className="w-full px-4 py-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">All Dealers</option>
                      {uniqueDealerNames.map(dealer => (
                        <option key={dealer} value={dealer}>{dealer}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <select
                      value={lastActionFilter}
                      onChange={(e) => setLastActionFilter(e.target.value)}
                      className="w-full px-4 py-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">All Actions</option>
                      {uniqueLastActions.map(action => (
                        <option key={action} value={action}>{action}</option>
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
                    placeholder="Search dealers..."
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
    </>
  );
};

export default Reports;