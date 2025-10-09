
"use client";

import React, { useState, useEffect, useContext, useMemo, useRef } from "react";
import { Users, Store, ShoppingBag, AlertCircle, X } from "lucide-react";
import MonthlySales from "../components/dashboard/MonthlySales";
import OrderStatus from "../components/dashboard/OrderStatus";
import { AuthContext } from "../App";

function Dashboard() {
  const { currentUser, isAuthenticated } = useContext(AuthContext);

  const currentUserSalesPersonName = currentUser?.salesPersonName || "Unknown User";
  const userRole = currentUser?.role || "User";

  const [isLoading, setIsLoading] = useState(true);
  const [allFMSData, setAllFMSData] = useState([]);
  const [error, setError] = useState(null);

  const [totalCount, setTotalCount] = useState(0);
  const [activeDealersCount, setActiveDealersCount] = useState(0);
  const [totalOrdersCount, setTotalOrdersCount] = useState(0);
  const [pendingEnquiriesCount, setPendingEnquiriesCount] = useState(0);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedSalesperson, setSelectedSalesperson] = useState("");
  const [uniqueSalespersons, setUniqueSalespersons] = useState([]);

  const isAdmin = userRole.toLowerCase() === "admin";

  const [isDataDialogOpen, setIsDataDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogData, setDialogData] = useState([]);
  const [dialogHeaders, setDialogHeaders] = useState([]);

  const FMS_COLUMNS_INFO = {
    0: { label: "Timestamp", property: "col0", type: "datetime" }, // Column A
    1: { label: "Dealer Code", property: "col1", type: "text" }, // Column B
    2: { label: "Dealer Name", property: "col5", type: "text" }, // Column C (Corrected based on common spreadsheet layouts)
    3: { label: "Dealer Region", property: "col3", type: "text" }, // Column D
    4: { label: "Sales Person Name", property: "col4", type: "text" }, // Column E
    5: { label: "Email", property: "col11", type: "text" }, // Column L
    6: { label: "Contact No", property: "col10", type: "number" }, // Column K
    7: { label: "Address", property: "col7", type: "text" }, // Column H
    8: { label: "Last Called On", property: "col17", type: "date" }, // Column R
    17: { label: "Order Status", property: "col19", type: "text"},
    9: { label: "what did the Customer Say", property: "col20", type: "text" }, // Column U
    10: { label: "Next Follow Up Date", property: "col22", type: "date" }, // Column W
    11: { label: "Next Action", property: "col21", type: "text" }, // Column V
    12: { label: "Dealer Size", property: "col8", type: "text" }, // Column I
    13: { label: "Order Quantity", property: "col23", type: "number" }, // Column X
    14: { label: "Ordered Products", property: "col24", type: "text" }, // Column Y
    15: { label: "Value of Order", property: "col25", type: "number" }, // Column Z
    16: { label: "Last Order Before", property: "col26", type: "date" }, // Column AA
    // For pending enquiries, you mentioned col14 and col15. Let's ensure they are defined if used.
    // Assuming col14 and col15 are "Enquiry Received Date" and "Enquiry Closed Date"
  };


  const FMS_DISPLAY_COLUMNS_FOR_DIALOG = [
    4, // Sales Person Name
    1, // Dealer Code
    2, // Dealer Name
    6,
    10, // Next Follow Up Date
    3, // Dealer Region
    8, // Last Called On
    17,
    9, // what did the Customer Say
    11, // Next Action
    12, // Dealer Size
    13, // Order Quantity
    14, // Ordered Products (This was likely col24 from above. Re-verified indexes for clarity)
    15, // Value of Order (This was likely col25 from above. Re-verified indexes for clarity)
    16, // Last Order Before (This was likely col26 from above. Re-verified indexes for clarity)
  ];


  const formatDate = (dateValue) => {
    if (!dateValue) return "—";
    try {
      let date;
      if (typeof dateValue === 'string' && dateValue.startsWith('Date(')) {
        const match = dateValue.match(/Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,(\d{1,2}),(\d{1,2}),(\d{1,2}))?\)/);
        if (match) {
          const year = parseInt(match[1]);
          const month = parseInt(match[2]); 
          const day = parseInt(match[3]);
          const hours = parseInt(match[4] || 0);
          const minutes = parseInt(match[5] || 0);
          const seconds = parseInt(match[6] || 0);
          date = new Date(year, month, day, hours, minutes, seconds);
        }
      } else if (dateValue instanceof Date) {
        date = dateValue;
      } else if (typeof dateValue === 'number' && dateValue > 0) {
        // Handle Excel/Google Sheets numeric date format (days since 1899-12-30)
        // Note: Google Sheets can sometimes add an extra day for leap year bug in old Excel, but this is generally robust.
        const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899 is day 0 in Excel's date system
        date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
      } else if (typeof dateValue === 'string') {
        date = new Date(dateValue);
        if (isNaN(date.getTime())) {
          // Try DD/MM/YYYY
          const ddmmyyyy = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (ddmmyyyy) {
            date = new Date(ddmmyyyy[3], ddmmyyyy[2] - 1, ddmmyyyy[1]);
          } else {
            // Try MM/DD/YYYY as fallback (less common in India, but for robustness)
            const mmddyyyy = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (mmddyyyy) {
              date = new Date(mmddyyyy[3], mmddyyyy[1] - 1, mmddyyyy[2]);
            }
          }
        }
      }

      if (!date || isNaN(date.getTime())) {
        return dateValue; // Return original if date is still invalid or null
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


  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      if (!isAuthenticated || !currentUser) {
        console.log("DEBUG: Not authenticated or currentUser missing. Skipping data fetch for Dashboard.");
        setIsLoading(false);
        setError("Please log in to view the dashboard.");
        return;
      }

      try {
        const response = await fetch(
          "https://docs.google.com/spreadsheets/d/15_ZUjQA-cSyFMt-70BxPBWVUZ185ioQzTqt5ElWXaZk/gviz/tq?tqx=out:json&sheet=FMS"
        );
        const text = await response.text();
        const jsonStart = text.indexOf("{");
        const jsonEnd = text.lastIndexOf("}") + 1;
        const jsonData = text.substring(jsonStart, jsonEnd);
        const data = JSON.parse(jsonData);

        if (data?.table?.rows) {
          const allRows = data.table.rows.map((row, rowIndex) => {
            const rowData = { _rowIndex: rowIndex };
            if (row.c) {
              row.c.forEach((cell, cellIndex) => {
                let cellValue = cell?.v ?? cell?.f ?? "";
                const columnInfo = FMS_COLUMNS_INFO[cellIndex];

                // Apply initial formatting for date/datetime types
                if (columnInfo && (columnInfo.type === 'date' || columnInfo.type === 'datetime')) {
                  cellValue = formatDate(cellValue);
                }
                rowData[`col${cellIndex}`] = cellValue;
              });
            }
            return rowData;
          });
          setAllFMSData(allRows);

          const salespersons = new Set();
          allRows.forEach(row => {
            const salespersonName = row.col4;
            if (salespersonName && typeof salespersonName === 'string' && salespersonName.trim() !== '') {
              salespersons.add(salespersonName.trim());
            }
          });
          setUniqueSalespersons([...Array.from(salespersons).sort()]);

        } else {
          setError("No data found in the FMS sheet.");
        }
      } catch (error) {
        console.error("DEBUG: Error fetching data:", error);
        setError(`Failed to load data: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, currentUser]);

  const currentFilteredData = useMemo(() => {
    if (allFMSData.length === 0 || !isAuthenticated || !currentUser) {
      return [];
    }

    let tempFilteredData = [...allFMSData];

    tempFilteredData = tempFilteredData.filter((row) => {
      const rowSalespersonName = row.col4;
      const currentUserNameNormalized = currentUserSalesPersonName ? currentUserSalesPersonName.trim().toLowerCase() : '';
      const rowSalespersonNameNormalized = rowSalespersonName ? String(rowSalespersonName).trim().toLowerCase() : '';

      if (isAdmin) {
        if (selectedSalesperson === "" || selectedSalesperson === "All Salespersons") {
          return true;
        }
        return rowSalespersonNameNormalized === selectedSalesperson.trim().toLowerCase();
      } else {
        return rowSalespersonNameNormalized === currentUserNameNormalized;
      }
    });

    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      tempFilteredData = tempFilteredData.filter((row) => {
        // Use the already formatted date string (DD/MM/YYYY) from col0
        const dateParts = row.col0 ? String(row.col0).split('/') : null;
        if (!dateParts || dateParts.length !== 3) return false;

        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const year = parseInt(dateParts[2], 10);

        const rowDate = new Date(year, month, day);
        return !isNaN(rowDate.getTime()) && rowDate >= start && rowDate <= end;
      });
    }

    return tempFilteredData;
  }, [allFMSData, startDate, endDate, isAdmin, currentUserSalesPersonName, selectedSalesperson, isAuthenticated, currentUser]);


  const filteredDataRef = useRef([]);
  useEffect(() => {
    filteredDataRef.current = currentFilteredData;
  }, [currentFilteredData]);
useEffect(() => {
    // Keep your existing logic for other counts
    setTotalCount(currentFilteredData.length);
    const dealers = new Set(currentFilteredData.map(row => row.col1).filter(Boolean));
    setActiveDealersCount(dealers.size);
    const ordersCount = currentFilteredData.filter(row => row.col25 && String(row.col25).trim() !== "").length;
    setTotalOrdersCount(ordersCount);

    // --- MODIFIED PENDING/NOT PENDING LOGIC BASED ON COL19 (STAGE) ---
    const pendingCount = currentFilteredData.filter(row => {
        const stage = row.col19 ? String(row.col19).trim().toLowerCase() : '';

        // An enquiry is 'pending' if its stage is NOT "order received" AND NOT "order not received"
        // This implies it's still in an active, unresolved state.
        return stage !== "order received" && stage !== "order not received";
    }).length;

    setPendingEnquiriesCount(pendingCount);
    // --- END MODIFIED LOGIC ---

}, [currentFilteredData])


  const handleCardClick = (kpiType) => {
    let dataForDialog = [];
    let title = "";
    let headers = FMS_DISPLAY_COLUMNS_FOR_DIALOG.map(index => FMS_COLUMNS_INFO[index]).filter(Boolean);

    const dataToFilter = filteredDataRef.current;

    if (kpiType === "totalRecords") {
      title = "All Records";
      dataForDialog = dataToFilter;
    } else if (kpiType === "activeDealers") {
      title = "Active Dealers";
      const uniqueDealerCodes = new Set();
      dataForDialog = dataToFilter.filter(row => {
        if (row.col1 && !uniqueDealerCodes.has(row.col1)) {
          uniqueDealerCodes.add(row.col1);
          return true;
        }
        return false;
      });
    } else if (kpiType === "totalOrders") {
      title = "Total Orders";
      dataForDialog = dataToFilter.filter(row => row.col25 && String(row.col25).trim() !== "");
    } else if (kpiType === "pendingEnquiries") {
      title = "Pending Enquiries";
      dataForDialog = dataToFilter.filter(row => {
        const colO = row.col14; // Enquiry Received Date
        const colP = row.col15; // Enquiry Closed Date
        return (colO && String(colO).trim() !== "—" && String(colO).trim() !== "") && (!colP || String(colP).trim() === "—" || String(colP).trim() === "");
      });
    }

    // Apply formatting specifically for the dialog's data display
    const formattedDialogData = dataForDialog.map(row => {
      const newRow = { ...row };
      headers.forEach(header => {
        // Only format if the column's type is date/datetime AND it has a value
        if ((header.type === 'date' || header.type === 'datetime') && newRow[header.property]) {
          newRow[header.property] = formatDate(newRow[header.property]);
        }
      });
      return newRow;
    });

    setDialogTitle(title);
    setDialogData(formattedDialogData); // Use the formatted data
    setDialogHeaders(headers);
    setIsDataDialogOpen(true);
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading dashboard data...</p>
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
            Error Loading Dashboard Data
          </h3>
          <p className="text-red-600 font-medium mb-4">{error}</p>
          {!isAuthenticated && (
            <p className="text-gray-600">Please log in to access the dashboard.</p>
          )}
          {isAuthenticated && (
            <button
              onClick={() => window.location.reload()}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 sm:space-y-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Dashboard
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-slate-600 font-medium">
              Welcome to your business overview, {currentUserSalesPersonName}!
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 bg-white/80 backdrop-blur-sm rounded-lg sm:rounded-xl px-3 py-2 sm:px-4 sm:py-3 shadow-md sm:shadow-lg border border-white/20 w-full sm:w-auto">
            <div className="flex items-center justify-center sm:justify-start gap-2 text-slate-700">
              <span className="font-semibold text-blue-600 text-xs sm:text-sm md:text-base">
                Today:
              </span>
              <span className="font-medium text-xs sm:text-sm md:text-base">
                {new Date().toLocaleDateString("en-GB")}
              </span>
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-slate-700">
              <label htmlFor="startDate" className="font-semibold text-blue-600 text-xs sm:text-sm md:text-base">From:</label>
              <input type="date" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="p-1 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-slate-700">
              <label htmlFor="endDate" className="font-semibold text-blue-600 text-xs sm:text-sm md:text-base">To:</label>
              <input type="date" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="p-1 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {isAdmin && (
              <div className="flex items-center justify-center sm:justify-start gap-2 text-slate-700">
                <label htmlFor="salespersonFilter" className="font-semibold text-blue-600 text-xs sm:text-sm md:text-base">Salesperson:</label>
                <select id="salespersonFilter" value={selectedSalesperson} onChange={(e) => setSelectedSalesperson(e.target.value)} className="p-1 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">All Salespersons</option>
                  {uniqueSalespersons.map((name) => (<option key={name} value={name}>{name}</option>))}
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Records Card */}
          <div
            className="bg-white/80 backdrop-blur-sm rounded-lg sm:rounded-xl shadow-md sm:shadow-lg border border-white/20 overflow-hidden group active:scale-[0.99] sm:hover:scale-[1.02] transition-all duration-300 cursor-pointer"
            onClick={() => handleCardClick("totalRecords")}
          >
            <div className="h-full bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-500 p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[0.65rem] xs:text-xs sm:text-sm font-semibold text-blue-100 uppercase tracking-wider mb-1">Total Records</h3>
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1">
                    {totalCount.toLocaleString()}
                  </div>
                </div>
                <div className="bg-white/20 p-1.5 sm:p-3 rounded-md sm:rounded-lg">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white" />
                </div>
              </div>
            </div>
          </div>
          {/* Active Dealers Card */}
          <div
            className="bg-white/80 backdrop-blur-sm rounded-lg sm:rounded-xl shadow-md sm:shadow-lg border border-white/20 overflow-hidden group active:scale-[0.99] sm:hover:scale-[1.02] transition-all duration-300 cursor-pointer"
            onClick={() => handleCardClick("activeDealers")}
          >
            <div className="h-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[0.65rem] xs:text-xs sm:text-sm font-semibold text-purple-100 uppercase tracking-wider mb-1">Active Dealers</h3>
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1">
                    {activeDealersCount}
                  </div>
                </div>
                <div className="bg-white/20 p-1.5 sm:p-3 rounded-md sm:rounded-lg">
                  <Store className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white" />
                </div>
              </div>
            </div>
          </div>
          {/* Total Orders Card */}
          <div
            className="bg-white/80 backdrop-blur-sm rounded-lg sm:rounded-xl shadow-md sm:shadow-lg border border-white/20 overflow-hidden group active:scale-[0.99] sm:hover:scale-[1.02] transition-all duration-300 cursor-pointer"
            onClick={() => handleCardClick("totalOrders")}
          >
            <div className="h-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[0.65rem] xs:text-xs sm:text-sm font-semibold text-pink-100 uppercase tracking-wider mb-1">Total Orders</h3>
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1">
                    {totalOrdersCount.toLocaleString()}
                  </div>
                </div>
                <div className="bg-white/20 p-1.5 sm:p-3 rounded-md sm:rounded-lg">
                  <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white" />
                </div>
              </div>
            </div>
          </div>
          {/* Pending Enquiries Card */}
          <div
            className="bg-white/80 backdrop-blur-sm rounded-lg sm:rounded-xl shadow-md sm:shadow-lg border border-white/20 overflow-hidden group active:scale-[0.99] sm:hover:scale-[1.02] transition-all duration-300 cursor-pointer"
            onClick={() => handleCardClick("pendingEnquiries")}
          >
            <div className="bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[0.65rem] xs:text-xs sm:text-sm font-semibold text-amber-100 uppercase tracking-wider mb-1">Pending Enquiries</h3>
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1">
                    {pendingEnquiriesCount}
                  </div>
                </div>
                <div className="bg-white/20 p-1.5 sm:p-3 rounded-md sm:rounded-lg">
                  <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Pass filteredData and FMS_COLUMNS_INFO to chart components */}
          <MonthlySales filteredData={currentFilteredData} FMS_COLUMNS_INFO={FMS_COLUMNS_INFO} />
          <OrderStatus filteredData={currentFilteredData} FMS_COLUMNS_INFO={FMS_COLUMNS_INFO} />
        </div>
      </div>

      {isDataDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in-0 p-4">
          <div className="relative w-full max-w-4xl h-[50vh] rounded-lg sm:rounded-xl bg-white/90 backdrop-blur-sm p-6 shadow-2xl animate-in zoom-in-95 max-h-[70vh] overflow-hidden transform scale-100 opacity-100 border border-white/30">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {dialogTitle}
                {selectedSalesperson && selectedSalesperson !== "All Salespersons" && isAdmin && (
                  <span className="text-lg font-medium text-gray-500 ml-2">({selectedSalesperson})</span>
                )}
              </h2>
              <button
                onClick={() => setIsDataDialogOpen(false)}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="overflow-auto h-[calc(50vh-140px)] border border-gray-200 rounded-lg">
  <div className="min-w-full">
    <table className="min-w-full divide-y divide-gray-100">
      <thead className="bg-gray-100 sticky top-0 z-10">
        <tr>
          {dialogHeaders.map((header) => (
            <th
              key={header.property}
              scope="col"
              className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap"
            >
              {header.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-100">
        {dialogData.length === 0 ? (
          <tr>
            <td colSpan={dialogHeaders.length} className="px-6 py-12 text-center text-gray-500 font-medium text-base">
              No data available for this selection.
            </td>
          </tr>
        ) : (
          dialogData.map((row, rowIndex) => (
            <tr key={row._rowIndex || `row-${rowIndex}`} className="hover:bg-gray-50">
              {dialogHeaders.map((header) => (
                <td
                  key={`${row._rowIndex}-${header.property}`}
                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-800"
                >
                  {row[header.property] || "—"}
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
      )}
    </div>
  );
}

export default Dashboard;