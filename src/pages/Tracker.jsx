"use client";

import { useState, useEffect, useContext } from "react";
import { toast, Toaster } from "react-hot-toast";
import { DownloadIcon, RefreshCw, SearchIcon, Eye, ChevronDown, ChevronUp } from "lucide-react";
import TrackerDialog from "../components/TrackerDialog";
import { AuthContext } from "../App";
import supabase from "../SupaabseClient";

const Tracker = () => {
  const [indents, setIndents] = useState([]);
  const [masterSheetData, setMasterSheetData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [col2Filter, setCol2Filter] = useState("");
  const [col4Filter, setCol4Filter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCards, setExpandedCards] = useState(new Set());
  
  // Get user authentication context
  const { currentUser, isAuthenticated } = useContext(AuthContext);

  // Extract salesPersonName and userRole from currentUser
  const currentUserSalesPersonName = currentUser?.salesPersonName || "Unknown User";
  const userRole = currentUser?.role || "User";
  const isAdmin = userRole.toLowerCase() === "admin";

  // Base headers without the admin-only column
  const baseHeaders = [
    { id: "col5", label: "Dealer Name" },
    { id: "col3", label: "District Name" },
    { id: "col2", label: "State Name" },
    { id: "area_name", label: "Area Name" }, // New Area Name column
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
  ];

  // Admin-only header
  const adminOnlyHeader = { id: "select_value", label: "Selected Type" };

  // Dynamic headers based on user role
  const [sheetHeaders, setSheetHeaders] = useState(baseHeaders);

  const [error, setError] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedIndent, setSelectedIndent] = useState(null);

  const SPREADSHEET_ID = "15_ZUjQA-cSyFMt-70BxPBWVUZ185ioQzTqt5ElWXaZk";

  /**
   * Map Supabase column names to the expected format
   */
  const mapSupabaseToLegacyFormat = (supabaseData) => {
    return supabaseData.map((item, index) => {
      // Map Supabase columns to the legacy column format
      return {
        _id: item.id || `${index}-${Math.random().toString(36).substr(2, 9)}`,
        _rowIndex: index + 1,
        // Map Supabase columns to legacy column format
        col1: item.dc_dealer_code || "", // Dealer Code
        col2: item.state_name || "", // State Name
        col3: item.district_name || "", // District Name
        area_name: item.area_name || "", // Area Name - New field
        col4: item.sales_person_name || "", // Sales Person Name
        col5: item.dealer_name || "", // Dealer Name
        col6: item.about_dealer || "", // About Dealer
        col7: item.address || "", // Address
        col8: item.dealer_size || "", // Dealer Size
        col9: item.avg_qty || "", // Avg Qty
        col10: item.contact_number || "", // Contact Number
        col11: item.email_address || "", // Email Address
        col12: item.date_of_birth || "", // Date Of Birth
        col13: item.anniversary || "", // Anniversary
        col14: item.planned || "", // Planned (Column O equivalent)
        col15: item.actual || "", // Actual (Column P equivalent)
        col17: item.last_call_date || "", // Last Call Date
        // Add select_value and image_url
        select_value: item.select_value || null,
        image_url: item.image_url || null,
        // Keep original Supabase data for reference
        supabase_data: item
      };
    });
  };

  /**
   * Update headers based on user role
   */
  useEffect(() => {
    if (isAdmin) {
      setSheetHeaders([...baseHeaders, adminOnlyHeader]);
    } else {
      setSheetHeaders(baseHeaders);
    }
  }, [isAdmin]);

  /**
   * Fetch FMS data from Supabase
   */
  const fetchFMSDataFromSupabase = async () => {
    try {
      console.log("🔄 Fetching FMS data from Supabase...");
      
      let query = supabase
        .from('FMS')
        .select('*')
        .order('timestamp', { ascending: false });

      // Apply role-based filtering
      if (!isAdmin) {
        query = query.eq('sales_person_name', currentUserSalesPersonName);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      console.log("✅ FMS data fetched from Supabase:", data);
      return data || [];
    } catch (error) {
      console.error("❌ Error fetching FMS data from Supabase:", error);
      throw error;
    }
  };

  /**
   * Fetch master data from Google Sheets (keeping this for now)
   */
  const fetchMasterDataFromSheets = async () => {
    try {
      console.log("🔄 Fetching master data from Google Sheets...");
      const response = await fetch(
        `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=Master`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch Master data: ${response.status}`);
      }

      const text = await response.text();
      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("Invalid response format from Master sheet");
      }

      const data = JSON.parse(text.substring(jsonStart, jsonEnd + 1));

      if (!data.table || !data.table.rows) {
        throw new Error("No table data found in Master sheet");
      }

      console.log("✅ Master data loaded successfully");
      return data;
    } catch (error) {
      console.error("❌ Error fetching master data:", error);
      throw error;
    }
  };

  /**
   * Process master data rows
   */
  const processMasterRows = (dataRows) => {
    return dataRows.map((row, rowIndex) => {
      const itemObj = {
        _id: `${rowIndex}-${Math.random().toString(36).substr(2, 9)}`,
        _rowIndex: rowIndex + 1,
      };
      if (row.c) {
        row.c.forEach((cell, i) => {
          itemObj[`col${i}`] = cell?.v ?? cell?.f ?? "";
        });
      }
      return itemObj;
    });
  };

  /**
   * Main data fetching function
   */
  const fetchTrackerData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check authentication
      if (!isAuthenticated || !currentUser) {
        console.log("Not authenticated. Skipping data fetch.");
        setIsLoading(false);
        return;
      }

      // Fetch data from both sources
      const [fmsData, masterData] = await Promise.all([
        fetchFMSDataFromSupabase(),
        fetchMasterDataFromSheets(),
      ]);

      // Process FMS data from Supabase
      const processedFMSData = mapSupabaseToLegacyFormat(fmsData);
      console.log("Processed FMS Data:", processedFMSData);

      // Apply initial filters: Column O not empty AND Column P is empty
      let filteredFMSItems = processedFMSData.filter((item) => {
        const colO = item.col14; // Planned column
        const colP = item.col15; // Actual column

        const isColONotEmpty = colO && String(colO).trim() !== "";
        const isColPEmpty = !colP || String(colP).trim() === "";

        // First, apply the O & P column filter
        if (!(isColONotEmpty && isColPEmpty)) {
          return false;
        }

        // Second, ensure at least one of the displayed columns has content
        const hasContentInDisplayedColumns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].some(
          (colIndex) => {
            const value = item[`col${colIndex}`];
            return value && String(value).trim() !== "";
          }
        );

        return hasContentInDisplayedColumns;
      });

      // Apply role-based filtering (already done in Supabase query, but double-check)
      if (!isAdmin) {
        filteredFMSItems = filteredFMSItems.filter((item) => {
          const salesPersonInRow = String(item.col4 || "").toLowerCase();
          return salesPersonInRow === currentUserSalesPersonName.toLowerCase();
        });
      }

      console.log("Final Filtered FMS Items:", filteredFMSItems);
      setIndents(filteredFMSItems);

      // Process master data
      const masterItems = processMasterRows(masterData.table.rows);
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

  // Helper function to format dates
  const formatDateToDDMMYYYY = (dateString) => {
    if (!dateString) return "N/A";

    let date;
    
    // Check if it's a Supabase timestamp
    if (typeof dateString === 'string' && dateString.includes('T')) {
      date = new Date(dateString);
    } 
    // Check if it's the legacy Google Sheets Date format
    else if (typeof dateString === 'string' && dateString.startsWith('Date(')) {
      const dateMatch = dateString.match(
        /^Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,(\d{1,2}),(\d{1,2}),(\d{1,2}))?\)$/
      );
      if (dateMatch) {
        const year = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10);
        const day = parseInt(dateMatch[3], 10);
        const hours = dateMatch[4] ? parseInt(dateMatch[4], 10) : 0;
        const minutes = dateMatch[5] ? parseInt(dateMatch[5], 10) : 0;
        const seconds = dateMatch[6] ? parseInt(dateMatch[6], 10) : 0;
        date = new Date(year, month, day, hours, minutes, seconds);
      } else {
        date = new Date(dateString);
      }
    } else {
      date = new Date(dateString);
    }

    if (isNaN(date.getTime())) {
      console.error("Invalid Date object after parsing:", dateString);
      return "N/A";
    }

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      fetchTrackerData();
    } else if (!isAuthenticated) {
      setIsLoading(false);
      setError("Please log in to view this data.");
    }
  }, [isAuthenticated, currentUser, isAdmin, currentUserSalesPersonName]);

  const filteredIndents = indents.filter((item) => {
    const term = searchTerm.toLowerCase();
    const col2Val = String(item.col2 || "").toLowerCase();
    const col4Val = String(item.col4 || "").toLowerCase();

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
          const actionPlaceholder = "Update";
          const rowValues = sheetHeaders.map((header) => {
            let value = item[header.id] || "";
            if (header.id === "col12" || header.id === "col13" || header.id === "col17") {
              value = formatDateToDDMMYYYY(value);
            }
            return typeof value === "string" &&
              (value.includes(",") || value.includes('"') || value.includes("\n"))
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

  // Loading/Error UI remains the same
  if (!isAuthenticated || isLoading) {
    return (
      <div className="h-screen bg-gradient-to-br from-slate-50 via-green-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          {!isAuthenticated && !isLoading ? (
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
      <div className="h-screen bg-gradient-to-br from-slate-50 via-green-50 to-teal-50 flex items-center justify-center">
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

  return (
    <>
      <Toaster position="top-right" />
      <div className="h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 p-3 lg:p-8 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full flex flex-col">
          {/* Main Card - Takes full height */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden flex flex-col flex-1">
            {/* Fixed Header Section */}
            <div className="flex-shrink-0">
              <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-2 sm:px-8 py-2 sm:py-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">
                      Dealer Tracking
                    </h3>
                    <p className="text-green-50 text-lg">
                      Comprehensive view of all dealer interactions and follow-ups
                    </p>
                    <p className="text-green-100 text-sm mt-2">
                      Current User:{" "}
                      <span className="font-semibold">
                        {currentUserSalesPersonName}
                      </span>{" "}
                      (Role: <span className="font-semibold">{userRole}</span>)
                      {isAdmin && " - Admin View"}
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
              
              {/* Search Bar - Fixed */}
              <div className="p-4 sm:p-6 border-b border-slate-200 bg-white">
                <div className="flex items-center">
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
              </div>
            </div>

            {/* Scrollable Content Section - Takes remaining space */}
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
                      
                      {/* Scrollable Table Body */}
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
                              <td className="px-6 py-4 text-left">
                                <button
                                  className="bg-gradient-to-r from-green-100 to-teal-100 text-green-700 border border-green-200 hover:from-green-200 hover:to-teal-200 font-medium py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-all duration-200"
                                  onClick={() => {
                                    console.log("✏️ Selected item for update:", item);
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
                                  {header.id === "col12" ||
                                  header.id === "col13" ||
                                  header.id === "col17"
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

              {/* Mobile Card View (hidden on desktop) */}
              <div className="lg:hidden h-full overflow-auto">
                {filteredIndents.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-slate-500 font-medium">
                      No results found.
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
                          className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                        >
                          {/* Card Header - Always Visible */}
                          <div 
                            className="p-4 border-b border-slate-100 cursor-pointer"
                            onClick={() => toggleCardExpansion(item._id)}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h3 className="font-bold text-slate-900 text-lg mb-2">
                                  {item.col5 || "Unnamed Dealer"}
                                </h3>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  {primaryFields.map((header) => (
                                    <div key={header.id}>
                                      <span className="text-slate-500 font-medium">{header.label}:</span>
                                      <p className="text-slate-900 font-semibold truncate">
                                        {header.id === "col12" ||
                                        header.id === "col13" ||
                                        header.id === "col17"
                                          ? formatDateToDDMMYYYY(item?.[header.id])
                                          : item?.[header.id] || "—"}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <button className="ml-2 text-slate-400 hover:text-slate-600 transition-colors">
                                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                              </button>
                            </div>
                          </div>

                          {/* Expandable Content */}
                          {isExpanded && (
                            <div className="p-4 bg-slate-50 border-t border-slate-200">
                              <div className="space-y-3">
                                {secondaryFields.map((header) => (
                                  <div key={header.id} className="flex justify-between items-start">
                                    <span className="text-slate-600 font-medium text-sm flex-shrink-0 mr-2">
                                      {header.label}:
                                    </span>
                                    <span className="text-slate-900 font-semibold text-sm text-right break-words flex-1">
                                      {header.id === "col12" ||
                                      header.id === "col13" ||
                                      header.id === "col17"
                                        ? formatDateToDDMMYYYY(item?.[header.id])
                                        : item?.[header.id] || "—"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              
                              {/* Action Button */}
                              <div className="mt-4 pt-4 border-t border-slate-200">
                                <button
                                  className="w-full bg-gradient-to-r from-green-100 to-teal-100 text-green-700 border border-green-200 hover:from-green-200 hover:to-teal-200 font-medium py-3 rounded-lg text-sm flex items-center justify-center gap-2 transition-all duration-200"
                                  onClick={() => {
                                    console.log("✏️ Selected item for update:", item);
                                    setSelectedIndent(item);
                                    setIsDialogOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4" /> Update Dealer
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
      </div>
      <TrackerDialog
        isOpen={isDialogOpen}
        onClose={() => {
          console.log("Attempting to close dialog from Tracker.");
          setIsDialogOpen(false);
          fetchTrackerData();
        }}
        dealerData={selectedIndent}
        masterData={masterSheetData}
      />
    </>
  );
};

export default Tracker;