
"use client";

import { useState, useEffect, useContext } from "react"; // Import useContext
import { toast, Toaster } from "react-hot-toast";
import { Download, Filter, Search } from "lucide-react";
import { AuthContext } from "../App"; // Assuming AuthContext is defined in App.js or a similar path

const Reports = () => {
  const [indents, setIndents] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  // Filter states for the relevant columns that might be filtered
  const [salesPersonFilter, setSalesPersonFilter] = useState("");   // For Sales Person Name (Col E)
  const [dealerNameFilter, setDealerNameFilter] = useState("");     // For Dealer Name (Col F)
  const [lastActionFilter, setLastActionFilter] = useState("");     // For Last Action (Col V)

  // Get user authentication context
  const { currentUser, isAuthenticated } = useContext(AuthContext);

  // Extract salesPersonName and userRole from currentUser
  const currentUserSalesPersonName = currentUser?.salesPersonName || "Unknown User";
  const userRole = currentUser?.role || "User"; // Default to "User" if role is not defined

  const [isLoading, setIsLoading] = useState(true);
  const [sheetHeaders, setSheetHeaders] = useState([]);
  const [error, setError] = useState(null);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);

  const SPREADSHEET_ID = "15_ZUjQA-cSyFMt-70BxPBWVUZ185ioQzTqt5ElWXaZk";
  
  // DISPLAY_COLUMNS:
  // Order: Sales Person (E), Dealer Name (F), Dealer Size (H), Last Action (V),
  // then Last Order Before (AA), Last Call Before (AB), MTD (AC), YTD (AD), Pending Amount (AE), No Of Bills (AF), Status (AG)
  const DISPLAY_COLUMNS = [4, 5, 8, 21, 26, 27, 28, 29, 30, 31, 32];
  const SHEET_NAME = "FMS"; // Explicitly set the sheet name to FMS as per your request

  // Function to format date values to DD/MM/YYYY
  const formatDate = (value) => {
    if (!value) return "";

    // If it's already a string in DD/MM/YYYY format, return as is
    if (typeof value === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      return value;
    }

    // Handle various date formats
    let date;

    if (typeof value === 'number') {
      // Excel/Google Sheets serial date number
      const excelEpoch = new Date(1899, 11, 30);
      date = new Date(excelEpoch.getTime() + (value * 24 * 60 * 60 * 1000));
    } else if (typeof value === 'string') {
      // Try to parse various string formats
      const cleanValue = value.trim();

      // Handle formats like "Date(2024,0,15)" or similar
      const dateMatch = cleanValue.match(/Date\((\d{4}),(\d{1,2}),(\d{1,2})\)/);
      if (dateMatch) {
        const [, year, month, day] = dateMatch;
        date = new Date(parseInt(year), parseInt(month), parseInt(day));
      } else {
        // Try standard date parsing
        date = new Date(cleanValue);
      }
    } else {
      date = new Date(value);
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return value; // Return original value if not a valid date
    }

    // Format to DD/MM/YYYY
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  };

  // Function to check if a value is likely a date
  const isDateValue = (value, headerLabel = '') => {
    if (!value) return false;

    // Check if header contains date-related keywords
    const headerLower = headerLabel.toLowerCase();
    const isDateHeader = headerLower.includes('date') ||
      headerLower.includes('time') ||
      headerLower.includes('created') ||
      headerLower.includes('updated') ||
      headerLower.includes('modified') ||
      headerLower.includes('order'); // Often 'Last Order' might contain dates

    if (isDateHeader) return true;

    // Check if value looks like a date
    if (typeof value === 'number' && value > 40000 && value < 60000) {
      // Likely Excel/Sheets serial date (dates after 2009 for example)
      return true;
    }

    if (typeof value === 'string') {
      // Check for common date patterns
      const datePatterns = [
        /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/, // YYYY-MM-DD or ISO
        /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY or MM/DD/YYYY
        /^\d{1,2}\/\d{1,2}\/\d{4}$/, // D/M/YYYY or M/D/YYYY
        /Date\(\d{4},\d{1,2},\d{1,2}\)/, // Date(YYYY,M,D) format
        /^(\w{3}\s\d{1,2},\s\d{4}|\d{1,2}\s\w{3}\s\d{4})$/ // e.g., Jan 15, 2024 or 15 Jan 2024
      ];

      return datePatterns.some(pattern => pattern.test(value));
    }

    return false;
  };

  // Function to format cell value based on its content
  const formatCellValue = (value, headerLabel = '') => {
    if (isDateValue(value, headerLabel)) {
      return formatDate(value);
    }
    return value || "—";
  };

  // Function to fetch data only from FMS sheet
  const fetchFMSData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isAuthenticated) {
        console.log("Not authenticated. Skipping data fetch.");
        setIsLoading(false);
        return;
      }

      console.log(`🔄 Fetching data from ${SHEET_NAME} sheet...`);

      const response = await fetch(
        `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch ${SHEET_NAME} data: ${response.status}`);
      }

      const text = await response.text();
      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error(`Invalid response format from ${SHEET_NAME} sheet`);
      }

      const data = JSON.parse(text.substring(jsonStart, jsonEnd + 1));

      if (!data.table || !data.table.rows) {
        throw new Error(`No table data found in ${SHEET_NAME} sheet`);
      }

      console.log(`✅ ${SHEET_NAME} data loaded successfully`);

      // Process FMS headers
      const fmsHeaders = [];
      const columnMapping = {
        4: "Sales Person Name",   // Column E
        5: "Dealer Name",         // Column F
        7: "Dealer Size",         // Column H
        21: "Last Action",        // Column V (originally "Next Action")
        26: "Last Order Before",  // Column AA
        27: "Last Call Before",   // Column AB
        28: "MTD",                // Column AC
        29: "YTD",                // Column AD
        30: "Pending Amount",     // Column AE
        31: "No Of Bills",        // Column AF
        32: "Status"              // Column AG
      };

      if (data.table.cols) {
        data.table.cols.forEach((col, index) => {
          if (DISPLAY_COLUMNS.includes(index)) {
            const label = columnMapping[index] || col.label || `Column ${index}`;
            fmsHeaders.push({ id: `col${index}`, label });
          }
        });
      }

      // Sort headers based on DISPLAY_COLUMNS order to ensure correct display order
      fmsHeaders.sort((a, b) => DISPLAY_COLUMNS.indexOf(parseInt(a.id.replace('col', ''))) - DISPLAY_COLUMNS.indexOf(parseInt(b.id.replace('col', ''))));

      setSheetHeaders(fmsHeaders);

      // Process FMS data rows
      const fmsItems = data.table.rows.map((row, rowIndex) => {
        const itemObj = {
          _id: `${rowIndex}-${Math.random().toString(36).substr(2, 9)}`,
          _rowIndex: rowIndex + 1,
        };

        if (row.c) {
          row.c.forEach((cell, i) => {
            const rawValue = cell?.v ?? cell?.f ?? "";
            itemObj[`col${i}`] = rawValue;
            itemObj[`col${i}_formatted`] = formatCellValue(rawValue, fmsHeaders.find(h => h.id === `col${i}`)?.label);
          });
        }

        return itemObj;
      });

      // Filter out empty rows (rows where none of the DISPLAY_COLUMNS have content)
      const cleanedItems = fmsItems.filter((item) => {
        return DISPLAY_COLUMNS.some((colIndex) => {
          const value = item[`col${colIndex}`];
          return value && String(value).trim() !== "";
        });
      });

      setIndents(cleanedItems); // Store all relevant data initially
    } catch (err) {
      console.error(`❌ Error fetching ${SHEET_NAME} data:`, err);
      setError(err.message);
      toast.error(`Failed to load ${SHEET_NAME} data: ${err.message}`, {
        duration: 4000,
        position: "top-right",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch data if authenticated and current user data is available
    if (isAuthenticated && currentUser) {
      fetchFMSData();
    } else if (!isAuthenticated) {
      // If not authenticated, stop loading and show a message
      setIsLoading(false);
      setError("Please log in to view Reports data.");
    }
  }, [isAuthenticated, currentUser]); // Depend on isAuthenticated and currentUser

  const filteredIndents = indents.filter((item) => {
    const term = searchTerm.toLowerCase();

    // User-specific filter for regular users
    // If userRole is "Admin", this condition is always true.
    // If userRole is "User", it checks if the Sales Person Name (col4) matches the current user's name.
    const matchesUserSalesPerson = userRole.toLowerCase() === "admin" ||
      (String(item.col4 || "").toLowerCase() === currentUserSalesPersonName.toLowerCase());

    // Get values from the relevant filter columns for general search/filters
    const salesPersonVal = String(item.col4 || "").toLowerCase();
    const dealerNameVal = String(item.col5 || "").toLowerCase();
    const lastActionVal = String(item.col21 || "").toLowerCase();

    // Search term filter - searches across all displayed columns
    const matchesSearchTerm = DISPLAY_COLUMNS.some((colIndex) => {
      const value = item[`col${colIndex}`];
      return value && String(value).toLowerCase().includes(term);
    });

    // Apply specific column filters
    const matchesSalesPersonFilter = salesPersonFilter
      ? salesPersonVal.includes(salesPersonFilter.toLowerCase())
      : true;
    
    const matchesDealerNameFilter = dealerNameFilter
      ? dealerNameVal.includes(dealerNameFilter.toLowerCase())
      : true;

    const matchesLastActionFilter = lastActionFilter
      ? lastActionVal.includes(lastActionFilter.toLowerCase())
      : true;

    // Combine all filters
    return matchesSearchTerm && matchesSalesPersonFilter && matchesDealerNameFilter && matchesLastActionFilter && matchesUserSalesPerson;
  });

  const exportData = () => {
    try {
      const csvContent = [
        // Header row
        sheetHeaders.map((header) => header.label).join(","),
        // Data rows with formatted values
        ...filteredIndents.map((item) => // Use filteredIndents for export as well
          sheetHeaders
            .map((header) => {
              const rawValue = item[header.id];
              const formattedValue = formatCellValue(rawValue, header.label);

              // Escape commas and quotes in CSV
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

    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data", {
        duration: 3000,
        position: "top-right",
      });
    }
  };

  if (!isAuthenticated || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          {(!isAuthenticated && !isLoading) ? ( // If not authenticated and not loading, display login message
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
          ) : ( // Otherwise, display loading spinner
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
            <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-8 py-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    Dealer Performance Report
                  </h3>
                  <p className="text-orange-50 text-lg">
                    Comprehensive view of all dealers and their performance
                    metrics
                  </p>
                  {/* Display current user info for testing/debugging */}
                  <p className="text-orange-100 text-sm mt-2">
                    Current User: <span className="font-semibold">{currentUserSalesPersonName}</span> (Role: <span className="font-semibold">{userRole}</span>)
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <button
                      onClick={() =>
                        setIsFilterDropdownOpen(!isFilterDropdownOpen)
                      }
                      className="bg-white/20 hover:bg-white/30 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center gap-2"
                      aria-expanded={isFilterDropdownOpen}
                      aria-haspopup="true"
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </button>
                    {isFilterDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-10 p-4">
                        <div className="py-1">
                          <div className="block px-4 py-2 text-sm text-gray-700 font-semibold">
                            Filter by Columns
                          </div>
                          <div className="border-t border-gray-200 my-2"></div>
                          <div className="grid gap-4">
                            {/* Filter for Sales Person Name (col E / index 4) */}
                            <div>
                              <label
                                htmlFor="sales-person-filter"
                                className="block text-sm font-medium text-gray-700"
                              >
                                Sales Person Name
                              </label>
                              <input
                                id="sales-person-filter"
                                type="text"
                                placeholder="Filter by Sales Person"
                                value={salesPersonFilter}
                                onChange={(e) => setSalesPersonFilter(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                              />
                            </div>
                            {/* Filter for Dealer Name (col F / index 5) */}
                            <div>
                              <label
                                htmlFor="dealer-name-filter"
                                className="block text-sm font-medium text-gray-700"
                              >
                                Dealer Name
                              </label>
                              <input
                                id="dealer-name-filter"
                                type="text"
                                placeholder="Filter by Dealer Name"
                                value={dealerNameFilter}
                                onChange={(e) => setDealerNameFilter(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                              />
                            </div>
                            {/* Filter for Last Action (col V / index 21) */}
                            <div>
                              <label
                                htmlFor="last-action-filter"
                                className="block text-sm font-medium text-gray-700"
                              >
                                Last Action
                              </label>
                              <input
                                id="last-action-filter"
                                type="text"
                                placeholder="Filter by Last Action"
                                value={lastActionFilter}
                                onChange={(e) => setLastActionFilter(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={exportData}
                    className="bg-white/20 hover:bg-white/30 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </button>
                </div>
              </div>
            </div>
            <div className="p-8">
              <div className="flex items-center mb-6">
                <div className="relative w-full max-w-md">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="search"
                    placeholder="Search dealers..."
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200 text-slate-700 font-medium"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
                    <tr>
                      {sheetHeaders.map((header) => (
                        <th
                          key={header.id}
                          className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap"
                        >
                          {header.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {filteredIndents.length === 0 ? (
                      <tr>
                        <td
                          colSpan={sheetHeaders.length}
                          className="px-6 py-12 text-center text-slate-500 font-medium"
                        >
                          No results found.
                        </td>
                      </tr>
                    ) : (
                      filteredIndents.map((item) => (
                        <tr
                          key={item._id}
                          className="hover:bg-slate-50 transition-colors duration-150"
                        >
                          {sheetHeaders.map((header) => {
                            // Use the formatted value for display in the table
                            const formattedValue = item[`${header.id}_formatted`];

                            return (
                              <td
                                key={header.id}
                                className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900"
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
        </div>
      </div>
    </>
  );
};

export default Reports;