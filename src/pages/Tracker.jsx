"use client";

import { useState, useEffect, useContext } from "react"; // Import useContext
import { toast, Toaster } from "react-hot-toast";

import { DownloadIcon, RefreshCw, SearchIcon, Eye } from "lucide-react";
import TrackerDialog from "../components/TrackerDialog";
import { AuthContext } from "../App"; // Assuming AuthContext is defined in App.js or a similar path

const Tracker = () => {
  const [indents, setIndents] = useState([]);
  const [masterSheetData, setMasterSheetData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [col2Filter, setCol2Filter] = useState(""); // Likely for 'Dealer Code' or similar
  const [col4Filter, setCol4Filter] = useState(""); // Likely for 'Sales Person Name' or similar
  const [isLoading, setIsLoading] = useState(true);
  const [sheetHeaders, setSheetHeaders] = useState([
    { id: "col5", label: "Dealer Name" },
    { id: "col3", label: "District Name" },
    { id: "col2", label: "State Name" },
    { id: "col4", label: "Sales Person Name" },

    { id: "col1", label: "Dealer Code" },
    { id: "col6", label: "About Dealer" },
    { id: "col7", label: "Address" },
    { id: "col8", label: "Dealer Size" },
    { id: "col9", label: "Avg Qty" },
    { id: "col10", label: "Contact Number" },
    { id: "col11", label: "Email Address" },
    { id: "col12", label: "Date Of Birth" },
    { id: "col13", label: "Anniversary" },
  ]);

  // console.log("sheetHeaders", sheetHeaders);
  const [error, setError] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedIndent, setSelectedIndent] = useState(null);

  // Get user authentication context
  const { currentUser, isAuthenticated } = useContext(AuthContext);

  // Extract salesPersonName and userRole from currentUser
  const currentUserSalesPersonName =
    currentUser?.salesPersonName || "Unknown User";
  const userRole = currentUser?.role || "User"; // Default to "User" if role is not defined

  const SPREADSHEET_ID = "15_ZUjQA-cSyFMt-70BxPBWVUZ185ioQzTqt5ElWXaZk";

  const COLUMN_START_INDEX = 1; // Column B (0-indexed = 1)
  const COLUMN_END_INDEX = 13; // Column N (0-indexed = 13)
  const SALES_PERSON_COLUMN_INDEX = 4; // Column E (0-indexed = 4) for Sales Person Name

  // Helper function to format dates - MOVED HERE FOR USE IN TRACKER TABLE
  const formatDateToDDMMYYYY = (dateString) => {
    if (!dateString) return "N/A";

    let date;
    // Regex to match "Date(YYYY,MM,DD,HH,MM,SS)" or "Date(YYYY,MM,DD)"
    const dateMatch = dateString.match(
      /^Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,(\d{1,2}),(\d{1,2}),(\d{1,2}))?\)$/
    );

    if (dateMatch) {
      const year = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10); // Month from GS is already 0-indexed
      const day = parseInt(dateMatch[3], 10);
      const hours = dateMatch[4] ? parseInt(dateMatch[4], 10) : 0;
      const minutes = dateMatch[5] ? parseInt(dateMatch[5], 10) : 0;
      const seconds = dateMatch[6] ? parseInt(dateMatch[6], 10) : 0;

      date = new Date(year, month, day, hours, minutes, seconds);
    } else {
      date = new Date(dateString);
    }

    if (isNaN(date.getTime())) {
      console.error("Invalid Date object after parsing:", dateString);
      return "N/A";
    }

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0"); // Add 1 for 1-indexed display
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const fetchSheetData = async (sheetName) => {
    console.log(`🔄 Fetching data from ${sheetName} sheet...`);
    const response = await fetch(
      `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheetName}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch ${sheetName} data: ${response.status}`);
    }

    const text = await response.text();
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");

    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error(
        `Invalid response format from ${sheetName} sheet. Could not find JSON boundaries.`
      );
    }

    const data = JSON.parse(text.substring(jsonStart, jsonEnd + 1));

    if (!data.table || !data.table.rows) {
      throw new Error(`No table data found in ${sheetName} sheet`);
    }
    console.log(`✅ ${sheetName} data loaded successfully`);
    return data;
  };

  const fetchTrackerData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // --- ADDED AUTH CHECK ---
      if (!isAuthenticated || !currentUser) {
        console.log(
          "Not authenticated or currentUser not available. Skipping data fetch."
        );
        setIsLoading(false);
        return;
      }
      // --- END ADDED AUTH CHECK ---

      const [fmsData, masterData] = await Promise.all([
        fetchSheetData("FMS"),
        fetchSheetData("Master"),
      ]);

      const newHeaders = [];
      const currentColumnsToDisplay = [];
      for (let i = COLUMN_START_INDEX; i <= COLUMN_END_INDEX; i++) {
        currentColumnsToDisplay.push(i);
      }

      if (fmsData.table.cols) {
        fmsData.table.cols.forEach((col, index) => {
          // Only add headers for the columns B to N
          if (currentColumnsToDisplay.includes(index)) {
            let label =
              col.label || `Column ${String.fromCharCode(65 + index)}`;

            console.log("label", label);

            if (index === 1 && label.includes("Dealer's Details")) {
              label = "Dealer Code"; // Override the problematic label for col1
            }
            newHeaders.push({ id: `col${index}`, label });
          }
        });
      }
      // console.log("newHeaders", newHeaders);
      // setSheetHeaders(newHeaders);
      // console.log("Generated Sheet Headers:", newHeaders);

      const processRows = (dataRows) => {
        return dataRows.map((row, rowIndex) => {
          const itemObj = {
            _id: `${rowIndex}-${Math.random().toString(36).substr(2, 9)}`,
            _rowIndex: rowIndex + 1,
          };
          if (row.c) {
            row.c.forEach((cell, i) => {
              // Extract all necessary columns, even if not displayed, for filtering/dialog
              // Ensure col14 (O), col15 (P), col17 (Q - Last Call Date), and Sales Person Column (E=col4) are included
              if (
                currentColumnsToDisplay.includes(i) ||
                i === 14 ||
                i === 15 ||
                i === 17 ||
                i === SALES_PERSON_COLUMN_INDEX
              ) {
                itemObj[`col${i}`] = cell?.v ?? cell?.f ?? "";
              }
            });
          }
          return itemObj;
        });
      };

      const fmsItems = processRows(fmsData.table.rows);
      console.log(
        "Raw FMS Items (after processRows, before further filtering):",
        fmsItems
      );

      // Apply initial filters: Column O not empty AND Column P is empty
      let filteredFMSItems = fmsItems.filter((item) => {
        const colO = item.col14; // Column O is index 14 (0-based)
        const colP = item.col15; // Column P is index 15 (0-based)

        const isColONotEmpty = colO && String(colO).trim() !== "";
        const isColPEmpty = !colP || String(colP).trim() === "";

        // First, apply the O & P column filter
        if (!(isColONotEmpty && isColPEmpty)) {
          return false;
        }

        // Second, ensure at least one of the *displayed* columns has content
        const hasContentInDisplayedColumns = currentColumnsToDisplay.some(
          (colIndex) => {
            const value = item[`col${colIndex}`];
            return value && String(value).trim() !== "";
          }
        );

        return hasContentInDisplayedColumns;
      });

      // --- ADDED ROLE-BASED FILTERING ---
      if (userRole.toLowerCase() !== "admin") {
        filteredFMSItems = filteredFMSItems.filter((item) => {
          const salesPersonInRow = String(
            item[`col${SALES_PERSON_COLUMN_INDEX}`] || ""
          ).toLowerCase();
          return salesPersonInRow === currentUserSalesPersonName.toLowerCase();
        });
      } else {
        // toast.success(`Showing all ${filteredFMSItems.length} records (Admin View)`, {
        //   duration: 3000,
        //   position: "top-right",
        // });
      }
      // --- END ADDED ROLE-BASED FILTERING ---

      setIndents(filteredFMSItems);
      console.log(
        "Final Filtered FMS Items (to be displayed):",
        filteredFMSItems
      );

      const masterItems = processRows(masterData.table.rows);
      setMasterSheetData(masterItems);
    } catch (err) {
      console.error("❌ Error fetching data:", err);
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
      fetchTrackerData();
    } else if (!isAuthenticated) {
      // If not authenticated, stop loading and show a message
      setIsLoading(false);
      setError("Please log in to view this data."); // Specific message for Tracker
    }
  }, [isAuthenticated, currentUser, userRole, currentUserSalesPersonName]); // Depend on auth status and user details

  const filteredIndents = indents.filter((item) => {
    const term = searchTerm.toLowerCase();

    // These filters were already present for col2 and col4
    const col2Val = String(item.col2 || "").toLowerCase();
    const col4Val = String(item.col4 || "").toLowerCase(); // col4 is Sales Person Name

    const matchesSearchTerm = sheetHeaders.some((header) => {
      const value = item[header.id];
      return value && String(value).toLowerCase().includes(term);
    });

    const matchesCol2 = col2Filter
      ? col2Val.includes(col2Filter.toLowerCase())
      : true;
    const matchesCol4 = col4Filter
      ? col4Val.includes(col4Filter.toLowerCase())
      : true;

    // The main role-based filtering is already done in fetchTrackerData,
    // so here we just combine the existing search and filter inputs.
    return matchesSearchTerm && matchesCol2 && matchesCol4;
  });

  const exportData = () => {
    try {
      const exportHeaders = [
        { id: "action", label: "Action" },
        ...sheetHeaders,
      ];

      const csvContent = [
        exportHeaders.map((header) => header.label).join(","),
        ...filteredIndents.map((item) => {
          const actionPlaceholder = "Update"; // This is just a placeholder for the action column in export
          const rowValues = sheetHeaders.map((header) => {
            let value = item[header.id] || "";
            // Apply date formatting for export as well
            if (header.id === "col12" || header.id === "col13") {
              // Assuming these are date columns
              value = formatDateToDDMMYYYY(value);
            }
            return typeof value === "string" &&
              (value.includes(",") ||
                value.includes('"') ||
                value.includes("\n"))
              ? `"${value.replace(/"/g, '""')}"`
              : value;
          });
          return [actionPlaceholder, ...rowValues].join(",");
        }),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `Tracker_Data_${new Date().toISOString().split("T")[0]}.csv`
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

  const refreshData = () => {
    console.log("🔄 Refreshing Tracker data...");
    fetchTrackerData();
  };

  // --- UPDATED LOADING/ERROR UI ---
  if (!isAuthenticated || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          {!isAuthenticated && !isLoading ? ( // If not authenticated and not loading, display login message
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
              <p className="text-slate-600 font-medium">
                Please log in to view this page.
              </p>
            </>
          ) : (
            // Otherwise, display loading spinner
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <p className="text-slate-600 font-medium">
                Loading Dealer Tracking data...
              </p>
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Error Loading Dealer Tracking Data
          </h3>
          <p className="text-red-600 font-medium mb-4">{error}</p>
          <button
            onClick={fetchTrackerData}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  // --- END UPDATED LOADING/ERROR UI ---

  return (
    <>
      <Toaster position="top-right" />
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 p-3 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Main Card */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-2 sm:px-8 py-2 sm:py-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    Dealer Tracking
                  </h3>
                  <p className="text-green-50 text-lg">
                    Comprehensive view of all dealer interactions and follow-ups
                  </p>
                  {/* Display current user info for testing/debugging */}
                  <p className="text-green-100 text-sm mt-2">
                    Current User:{" "}
                    <span className="font-semibold">
                      {currentUserSalesPersonName}
                    </span>{" "}
                    (Role: <span className="font-semibold">{userRole}</span>)
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <button
                    onClick={refreshData}
                    className="bg-white/20 hover:bg-white/30 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </button>
                  <button
                    onClick={exportData}
                    className="bg-white/20 hover:bg-white/30 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 flex items-center gap-2"
                  >
                    <DownloadIcon className="h-4 w-4" />
                    Export
                  </button>
                </div>
              </div>
            </div>
            <div className="p-2 sm:p-8">
              <div className="flex items-center mb-6">
                <div className="relative w-full max-w-md">
                  <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="search"
                    placeholder="Search dealers..."
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 text-slate-700 font-medium"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
                    <tr>
                      {/* Action column header first */}
                      <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">
                        Action
                      </th>
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
                          colSpan={sheetHeaders.length + 1}
                          className="px-6 py-12 text-center text-slate-500 font-medium"
                        >
                          No results found.
                        </td>
                      </tr>
                    ) : (
                      filteredIndents.map((item) => (
                        <tr
                          key={item._id}
                          className="hover:bg-slate-50 transition-colors duration-150 cursor-pointer"
                        >
                          {/* Action button in the first cell */}
                          <td className="px-6 py-4 text-left">
                            <button
                              className="bg-gradient-to-r from-green-100 to-teal-100 text-green-700 border border-green-200 hover:from-green-200 hover:to-teal-200 font-medium py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-all duration-200"
                              onClick={() => {
                                console.log(
                                  "✏️ Selected item for update:",
                                  item
                                );
                                setSelectedIndent(item);
                                setIsDialogOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" /> Update
                            </button>
                          </td>
                          {sheetHeaders.map((header) => (
                            <td
                              key={header.id}
                              className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900"
                            >
                              {/* Apply formatting only for known date columns */}
                              {header.id === "col12" ||
                              header.id === "col13" ||
                              header.id === "col17" // Added col17 for Last Call Date
                                ? formatDateToDDMMYYYY(item?.[header.id])
                                : item?.[header.id] || "—"}
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
      </div>
      <TrackerDialog
        isOpen={isDialogOpen}
        onClose={() => {
          console.log("Attempting to close dialog from Tracker.");
          setIsDialogOpen(false);
          // Optional: Re-fetch data after dialog closes to see updates
          fetchTrackerData();
        }}
        dealerData={selectedIndent}
        masterData={masterSheetData}
      />
    </>
  );
};

export default Tracker;
