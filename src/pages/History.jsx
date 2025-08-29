
"use client";

import { useState, useEffect, useContext } from "react"; // Import useContext
import { toast, Toaster } from "react-hot-toast";
import { Download, Filter, Search, X } from "lucide-react";
import { AuthContext } from "../App"; // Assuming AuthContext is defined in App.js or a similar path

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

  // Get user authentication context
  const { currentUser, isAuthenticated } = useContext(AuthContext);

  // Extract salesPersonName and userRole from currentUser
  const currentUserSalesPersonName = currentUser?.salesPersonName || "Unknown User";
  const userRole = currentUser?.role || "User"; // Default to "User" if role is not defined

  // --- Constants and Utility Functions (from previous version, assuming they are robust) ---
  const SPREADSHEET_ID = "15_ZUjQA-cSyFMt-70BxPBWVUZ185ioQzTqt5ElWXaZk";
  const SHEET_NAME = "Tracking History";
  // Added column 11 (L) for Sales Person Name to DISPLAY_COLUMNS
  const DISPLAY_COLUMNS = [11, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // Columns L, B to K (0-indexed as 11, 1-10)

  const COLUMN_MAPPINGS = {
    "Name": "col11", // Added Sales Person Name from Column L
    "Dealer Code": "col1",
    "Stage": "col2",
    "Status": "col3",
    "Last Date Of Call": "col4",
    "What Did The Customer Say": "col5",
    "Next Action": "col6",
    "Next Date Of Call": "col7",
    "Order Qty": "col8",
    "Ordered Products": "col9",
    "Value Of Order": "col10"
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "—";
    try {
      let date;
      if (typeof dateValue === 'string' && dateValue.startsWith('Date(')) {
        const match = dateValue.match(/Date\((\d{4}),(\d{1,2}),(\d{1,2})\)/);
        if (match) {
          const year = parseInt(match[1]);
          const month = parseInt(match[2]);
          const day = parseInt(match[3]);
          date = new Date(year, month, day);
        }
      } else if (dateValue instanceof Date) {
        date = dateValue;
      } else if (typeof dateValue === 'number' && dateValue > 0) {
        const excelEpoch = new Date(1899, 11, 30);
        date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
      } else if (typeof dateValue === 'string') {
        date = new Date(dateValue);
        if (isNaN(date.getTime())) {
          const ddmmyyyy = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (ddmmyyyy) {
            date = new Date(ddmmyyyy[3], ddmmyyyy[2] - 1, ddmmyyyy[1]);
          } else {
            const mmddyyyy = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (mmddyyyy) {
              date = new Date(mmddyyyy[3], mmddyyyy[1] - 1, mmddyyyy[2]);
            }
          }
        }
      } else {
        return dateValue;
      }
      if (!date || isNaN(date.getTime())) {
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

  const isDateValue = (value, headerLabel = '') => {
    if (!value) return false;
    const headerLower = headerLabel.toLowerCase();
    const isDateHeader = headerLower.includes('date') || headerLower.includes('time') || headerLower.includes('created') || headerLower.includes('updated') || headerLower.includes('modified');
    if (isDateHeader) return true;
    if (typeof value === 'number' && value > 40000 && value < 60000) {
      return true;
    }
    if (typeof value === 'string') {
      const datePatterns = [
        /^\d{4}-\d{2}-\d{2}/,
        /^\d{2}\/\d{2}\/\d{4}/,
        /^\d{1,2}\/\d{1,2}\/\d{4}/,
        /Date\(\d{4},\d{1,2},\d{1,2}\)/
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
  // --- End Constants and Utility Functions ---

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Only proceed if authenticated
      if (!isAuthenticated) {
        console.log("Not authenticated. Skipping data fetch for History.");
        setIsLoading(false);
        return;
      }

      console.log(`🔄 Fetching data from ${SHEET_NAME} sheet...`);

      const response = await fetch(
        `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }

      const text = await response.text();
      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("Invalid response format from sheet");
      }

      const data = JSON.parse(text.substring(jsonStart, jsonEnd + 1));

      if (!data.table || !data.table.rows) {
        throw new Error("No table data found in sheet");
      }

      console.log(`✅ ${SHEET_NAME} data loaded successfully`);

      const headers = Object.keys(COLUMN_MAPPINGS).map(label => ({
        id: COLUMN_MAPPINGS[label],
        label
      }));

      // Ensure headers are sorted according to DISPLAY_COLUMNS order
      headers.sort((a, b) => {
        const aColIndex = parseInt(a.id.replace('col', ''));
        const bColIndex = parseInt(b.id.replace('col', ''));
        return DISPLAY_COLUMNS.indexOf(aColIndex) - DISPLAY_COLUMNS.indexOf(bColIndex);
      });

      setSheetHeaders(headers);

      const items = data.table.rows.map((row, rowIndex) => {
        const itemObj = {
          _id: `${rowIndex}-${Math.random().toString(36).substr(2, 9)}`,
          _rowIndex: rowIndex + 1,
        };

        if (row.c) {
          row.c.forEach((cell, i) => {
            // Include all DISPLAY_COLUMNS in the item object, even if not displayed initially
            // This ensures filter functionality can access raw values
            const cellValue = cell?.v ?? cell?.f ?? "";
            const headerLabel = headers.find(h => h.id === `col${i}`)?.label;
            itemObj[`col${i}`] = formatCellValue(cellValue, headerLabel);
          });
        }
        return itemObj;
      });

      const filteredItems = items.filter((item) => {
        return DISPLAY_COLUMNS.some((colIndex) => {
          const value = item[`col${colIndex}`];
          return value && String(value).trim() !== "";
        });
      });

      setIndents(filteredItems);
    } catch (err) {
      console.error(`❌ Error fetching ${SHEET_NAME} data:`, err);
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
    // Assuming col1 is 'Dealer Code' and col2 is 'Stage' based on COLUMN_MAPPINGS
    // And col11 is 'Name' (Sales Person Name)
    const dealerCodeVal = String(item.col1 || "").toLowerCase();
    const stageVal = String(item.col2 || "").toLowerCase();
    const salesPersonVal = String(item.col11 || "").toLowerCase(); // Sales Person Name

    // User-specific filter for regular users
    // If userRole is "Admin", this condition is always true.
    // If userRole is "User", it checks if the Sales Person Name (col11) matches the current user's name.
    const matchesUserSalesPerson = userRole.toLowerCase() === "admin" ||
      (salesPersonVal === currentUserSalesPersonName.toLowerCase());

    const matchesSearchTerm = DISPLAY_COLUMNS.some((colIndex) => {
      const value = item[`col${colIndex}`];
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
              const value = item[header.id] || "";
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

  // --- Main Render Section - COMPLETELY REDESIGNED ---
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Toaster position="top-right" />
      <div className="container mx-auto p-8 pt-10"> {/* Overall padding and max-width for the content */}

        {/* Dealer Interaction History Report Card */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
          {/* Card Header with Gradient */}
          <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-white p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-semibold mb-1">
                Interaction History
              </h3>
              <p className="text-sm opacity-90">
                View history of all dealer interactions
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Filter Button */}
              <div className="relative">
                <button
                  onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-white text-orange-600 hover:bg-gray-100 h-10 px-4 py-2 shadow-sm"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </button>
                {/* Filter Dropdown Content */}
                {isFilterDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-20 p-4">
                    <div className="block px-4 py-2 text-sm text-gray-700 font-semibold">
                      Filter by Columns
                    </div>
                    <div className="border-t border-gray-200 my-2"></div>
                    <div className="grid gap-4">
                      <div>
                        <label htmlFor="dealer-code-filter" className="block text-sm font-medium text-gray-700 mb-1">
                          Dealer Code
                        </label>
                        <input
                          id="dealer-code-filter"
                          type="text"
                          placeholder="Filter by Dealer Code"
                          value={dealerCodeFilter}
                          onChange={(e) => setDealerCodeFilter(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="stage-filter" className="block text-sm font-medium text-gray-700 mb-1">
                          Stage
                        </label>
                        <input
                          id="stage-filter"
                          type="text"
                          placeholder="Filter by Stage"
                          value={stageFilter}
                          onChange={(e) => setStageFilter(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* Export Button */}
              <button
                onClick={exportData}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-white text-orange-600 hover:bg-gray-100 h-10 px-4 py-2 shadow-sm"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
            </div>
          </div>

          {/* Card Body - Search and Table */}
          <div className="p-8"> {/* Increased padding to match image */}
            {/* Search Bar */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="search"
                // Changed placeholder to match image
                placeholder="Search dealers..."
                className="flex h-12 w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-base pl-10 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Data Table */}
            <div className="rounded-lg border border-gray-200 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
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
                            {item[header.id] || "—"}
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
      </div>

      {/* View Details Dialog - Maintained original functionality but with subtle style updates */}
      {isDialogOpen && selectedIndent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in-0 p-4">
          <div className="relative w-full max-w-3xl rounded-lg bg-white p-6 shadow-2xl animate-in zoom-in-95 max-h-[95vh] overflow-y-auto transform scale-100 opacity-100">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
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
                        {value || "—"}
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
                className="inline-flex items-center justify-center rounded-md text-base font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 h-10 px-5 py-2 transition-colors shadow-sm"
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