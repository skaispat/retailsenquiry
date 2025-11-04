"use client";

import { useState, useEffect, useContext } from "react"; // Import useContext
import { toast, Toaster } from "react-hot-toast";
import { Download, Filter, Search, X, ChevronDown, ChevronUp } from "lucide-react";
import { AuthContext } from "../App"; // Assuming AuthContext is defined in App.js or a similar path
import supabase from "../SupaabseClient";

const History = () => {
  const [indents, setIndents] = useState([]);
  const [selectedIndent, setSelectedIndent] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dealerCodeFilter, setDealerCodeFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [sheetHeaders, setSheetHeaders] = useState([]);
  const [error, setError] = useState(null);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [expandedCards, setExpandedCards] = useState(new Set());

  // Get user authentication context
  const { currentUser, isAuthenticated } = useContext(AuthContext);

  // Extract salesPersonName and userRole from currentUser
  const currentUserSalesPersonName = currentUser?.salesPersonName || "Unknown User";
  const userRole = currentUser?.role || "User"; // Default to "User" if role is not defined

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

      // Define column mapping for display - Added Area Name
      const COLUMN_MAPPINGS = {
        "Timestamp": "created_at",
        "Dealer Code": "dealer_code",
        "Stage": "stage",
        "Status": "status",
        "Last Date of Call": "last_date_of_call",
        "What Did Customer Say": "what_did_customer_says",
        "Next Action": "next_action",
        "Next Date of Call": "next_date_of_call",
        "Order Qty": "order_qty",
        "Order Products": "order_products",
        "Value of Order": "value_of_order",
        "Sales Person Name": "sales_person_name",
        "Payment (Yes/No)": "payment_yes_no",
        "Dealer/Distributor Site": "deler_distributer_site_name",
        "Area Name": "area_name", // New Area Name column
      };

      const headers = Object.keys(COLUMN_MAPPINGS).map((label) => ({
        id: COLUMN_MAPPINGS[label],
        label,
      }));

      setSheetHeaders(headers);

      const items = data.map((row, index) => ({
        _id: `${index}-${Math.random().toString(36).substr(2, 9)}`,
        _rowIndex: index + 1,
        ...row, // directly spread Supabase row data
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
      
      // Handle string dates
      if (typeof dateValue === 'string') {
        // Handle ISO format (from Supabase)
        if (dateValue.includes('T')) {
          date = new Date(dateValue);
        }
        // Handle DD/MM/YYYY format
        else if (dateValue.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
          const [day, month, year] = dateValue.split('/');
          date = new Date(year, month - 1, day);
        }
        // Handle YYYY-MM-DD format
        else if (dateValue.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
          date = new Date(dateValue);
        }
        // Handle Google Sheets Date format
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
        // Fallback to Date constructor
        else {
          date = new Date(dateValue);
        }
      }
      // Handle number dates (Excel serial numbers)
      else if (typeof dateValue === 'number' && dateValue > 0) {
        const excelEpoch = new Date(1899, 11, 30);
        date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
      }
      // Handle Date objects
      else if (dateValue instanceof Date) {
        date = dateValue;
      }
      // Return original value if can't parse
      else {
        return dateValue;
      }

      // Check if date is valid
      if (!date || isNaN(date.getTime())) {
        console.warn('Invalid date value:', dateValue);
        return dateValue;
      }

      // Format to DD/MM/YYYY
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
    // Only fetch data if authenticated and current user data is available
    if (isAuthenticated && currentUser) {
      fetchData();
    } else if (!isAuthenticated) {
      // If not authenticated, stop loading and show a message
      setIsLoading(false);
      setError("Please log in to view interaction history.");
    }
  }, [isAuthenticated, currentUser]); // Depend on isAuthenticated and currentUser

  const filteredIndents = indents.filter((item) => {
    const term = searchTerm.toLowerCase();
    const dealerCodeVal = String(item.dealer_code || "").toLowerCase();
    const stageVal = String(item.stage || "").toLowerCase();
    const salesPersonVal = String(item.sales_person_name || "").toLowerCase();

    // User-specific filter for regular users
    // If userRole is "Admin", this condition is always true.
    // If userRole is "User", it checks if the Sales Person Name matches the current user's name.
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

    return matchesSearchTerm && matchesDealerCode && matchesStage && matchesUserSalesPerson;
  });

  const exportData = () => {
    try {
      const csvContent = [
        sheetHeaders.map((header) => header.label).join(","),
        ...filteredIndents.map((item) =>
          sheetHeaders
            .map((header) => {
              let value = item[header.id] || "";
              // Format dates in export as well
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

  // --- Loading and Error States (retained as they are functional) ---
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading interaction data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
    <div className="min-h-screen bg-gray-50 font-sans">
      <Toaster position="top-right" />
      <div className="container mx-auto p-4 lg:p-8 pt-6 lg:pt-10">
        {/* Dealer Interaction History Report Card */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200 flex flex-col h-[calc(100vh-2rem)] lg:h-[calc(100vh-4rem)]">
          {/* Card Header with Gradient */}
          <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-white p-4 lg:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl lg:text-2xl font-semibold mb-1">
                Interaction History
              </h3>
              <p className="text-xs lg:text-sm opacity-90">
                View history of all dealer interactions
              </p>
              <p className="text-xs text-green-100 mt-1">
                Current User: <span className="font-semibold">{currentUserSalesPersonName}</span>
                {userRole.toLowerCase() === "admin" && " - Admin View"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:gap-3">
              {/* Filter Button */}
              <div className="relative">
                <button
                  onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-white text-orange-600 hover:bg-gray-100 h-9 lg:h-10 px-3 lg:px-4 py-2 shadow-sm"
                >
                  <Filter className="h-4 w-4 mr-1 lg:mr-2" />
                  <span className="hidden sm:inline">Filter</span>
                </button>
                {/* Filter Dropdown Content */}
                {isFilterDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 lg:w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-20 p-3 lg:p-4">
                    <div className="block text-sm text-gray-700 font-semibold">
                      Filter by Columns
                    </div>
                    <div className="border-t border-gray-200 my-2"></div>
                    <div className="grid gap-3 lg:gap-4">
                      <div>
                        <label htmlFor="dealer-code-filter" className="block text-xs lg:text-sm font-medium text-gray-700 mb-1">
                          Dealer Code
                        </label>
                        <input
                          id="dealer-code-filter"
                          type="text"
                          placeholder="Filter by Dealer Code"
                          value={dealerCodeFilter}
                          onChange={(e) => setDealerCodeFilter(e.target.value)}
                          className="flex h-8 lg:h-9 w-full rounded-md border border-gray-300 bg-white px-2 lg:px-3 py-1 lg:py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="stage-filter" className="block text-xs lg:text-sm font-medium text-gray-700 mb-1">
                          Stage
                        </label>
                        <input
                          id="stage-filter"
                          type="text"
                          placeholder="Filter by Stage"
                          value={stageFilter}
                          onChange={(e) => setStageFilter(e.target.value)}
                          className="flex h-8 lg:h-9 w-full rounded-md border border-gray-300 bg-white px-2 lg:px-3 py-1 lg:py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* Export Button */}
              <button
                onClick={exportData}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-white text-orange-600 hover:bg-gray-100 h-9 lg:h-10 px-3 lg:px-4 py-2 shadow-sm"
              >
                <Download className="h-4 w-4 mr-1 lg:mr-2" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </div>

          {/* Search Bar - Fixed */}
          <div className="flex-shrink-0 p-4 lg:p-6 border-b border-gray-200 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 lg:h-5 w-4 lg:w-5 text-gray-400" />
              <input
                type="search"
                placeholder="Search dealers..."
                className="flex h-10 lg:h-12 w-full rounded-md border border-gray-300 bg-white px-3 lg:px-4 py-2 text-sm lg:text-base pl-10 lg:pl-12 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Scrollable Content Section */}
          <div className="flex-1 overflow-hidden">
            {/* Desktop Table View (hidden on mobile) */}
            <div className="hidden lg:block h-full">
              <div className="h-full flex flex-col">
                {/* Scrollable Table Container */}
                <div className="flex-1 overflow-auto">
                  <table className="w-full">
                    {/* Fixed Table Header */}
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                        {sheetHeaders.map((header) => (
                          <th
                            key={header.id}
                            scope="col"
                            className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap"
                          >
                            {header.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    
                    {/* Scrollable Table Body */}
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredIndents.length === 0 ? (
                        <tr>
                          <td
                            colSpan={sheetHeaders.length}
                            className="px-6 py-12 text-center text-gray-500 font-medium text-base"
                          >
                            {searchTerm || dealerCodeFilter || stageFilter
                              ? "No results found for your current filters."
                              : "No interaction data found."}
                          </td>
                        </tr>
                      ) : (
                        filteredIndents.map((item) => (
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
                                className="px-6 py-4 whitespace-nowrap text-sm text-gray-800"
                              >
                                {formatCellValue(item[header.id], header.label)}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Mobile Card View (hidden on desktop) */}
            <div className="lg:hidden h-full overflow-auto">
              {filteredIndents.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500 font-medium">
                    {searchTerm || dealerCodeFilter || stageFilter
                      ? "No results found for your current filters."
                      : "No interaction data found."}
                  </div>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {filteredIndents.map((item) => {
                    const isExpanded = expandedCards.has(item._id);
                    const primaryFields = sheetHeaders.slice(0, 4); // First 4 fields for collapsed view
                    const secondaryFields = sheetHeaders.slice(4); // Remaining fields for expanded view

                    return (
                      <div
                        key={item._id}
                        className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                      >
                        {/* Card Header - Always Visible */}
                        <div 
                          className="p-4 border-b border-gray-100 cursor-pointer"
                          onClick={() => toggleCardExpansion(item._id)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="font-bold text-gray-900 text-base mb-2">
                                {item.dealer_code || "Unknown Dealer"}
                              </h3>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {primaryFields.map((header) => (
                                  <div key={header.id}>
                                    <span className="text-gray-500 font-medium">{header.label}:</span>
                                    <p className="text-gray-900 font-semibold truncate">
                                      {formatCellValue(item?.[header.id], header.label)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <button className="ml-2 text-gray-400 hover:text-gray-600 transition-colors">
                              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                          </div>
                        </div>

                        {/* Expandable Content */}
                        {isExpanded && (
                          <div className="p-4 bg-gray-50 border-t border-gray-200">
                            <div className="space-y-2">
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
                            </div>
                            
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
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* View Details Dialog */}
      {isDialogOpen && selectedIndent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in-0 p-4">
          <div className="relative w-full max-w-3xl rounded-lg bg-white p-4 lg:p-6 shadow-2xl animate-in zoom-in-95 max-h-[95vh] overflow-y-auto transform scale-100 opacity-100">
            <div className="flex items-center justify-between border-b pb-3 lg:pb-4 mb-3 lg:mb-4">
              <h2 className="text-xl lg:text-2xl font-bold text-gray-800">
                Interaction Details
              </h2>
              <button
                onClick={() => setIsDialogOpen(false)}
                className="rounded-full p-1 lg:p-2 text-gray-500 hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5 lg:h-6 lg:w-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 lg:gap-x-6 gap-y-3 lg:gap-y-4 py-1 lg:py-2">
              {sheetHeaders.map((header) => {
                const value = selectedIndent[header.id];
                if (value && String(value).trim() !== "") {
                  return (
                    <div key={header.id} className="flex flex-col">
                      <span className="text-xs lg:text-sm font-medium text-gray-500">
                        {header.label}
                      </span>
                      <span className="text-sm lg:text-base font-semibold text-gray-900 break-words">
                        {formatCellValue(value, header.label)}
                      </span>
                    </div>
                  );
                }
                return null;
              })}
            </div>

            <div className="flex justify-end border-t pt-3 lg:pt-4 mt-4 lg:mt-6">
              <button
                onClick={() => setIsDialogOpen(false)}
                className="inline-flex items-center justify-center rounded-md text-sm lg:text-base font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 h-9 lg:h-10 px-4 lg:px-5 py-2 transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default History;