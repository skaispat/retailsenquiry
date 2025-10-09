"use client";

import { useState, useEffect, useContext } from "react";
import { toast, Toaster } from "react-hot-toast";
import { Download, Search, X } from "lucide-react";
import { AuthContext } from "../App";

const DailyReport = () => {
  const [trackingData, setTrackingData] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dealerFilter, setDealerFilter] = useState("");
  const [salesPersonFilter, setSalesPersonFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [sheetHeaders, setSheetHeaders] = useState([]);
  const [error, setError] = useState(null);

  // Get user authentication context
  const { currentUser, isAuthenticated } = useContext(AuthContext);

  const userRole = currentUser?.role || "User";

  // --- Constants ---
  const SPREADSHEET_ID = "15_ZUjQA-cSyFMt-70BxPBWVUZ185ioQzTqt5ElWXaZk";
  const SHEET_NAME = "Tracking History";
  
  // Updated Column mapping - removed Dealer Code (col1) and Next Calling Date (col7)
  const DISPLAY_COLUMNS = [0, 13, 11, 5, 6]; // A, N, L, F, G

  const COLUMN_MAPPINGS = {
    "Timestamp": "col0",                              // Column A
    "Dealer / Distributor / Site Name": "col13",     // Column N
    "Sales Person Name": "col11",                     // Column L
    "Remark": "col5",                                // Column F
    "Next Action": "col6",                           // Column G
  };

  // Updated date formatting function to include time (hours and minutes)
  const formatDate = (dateValue) => {
    if (!dateValue) return "—";
    try {
      let date;
      
      // Handle Date(year,month,day,hour,minute,second) format from Google Sheets
      if (typeof dateValue === 'string' && dateValue.startsWith('Date(')) {
        const match = dateValue.match(/Date\((\d{4}),(\d{1,2}),(\d{1,2}),?(\d{1,2})?,?(\d{1,2})?.*\)/);
        if (match) {
          const year = parseInt(match[1]);
          const month = parseInt(match[2]); // Note: Google Sheets months are 0-based
          const day = parseInt(match[3]);
          const hour = parseInt(match[4] || '0');
          const minute = parseInt(match[5] || '0');
          date = new Date(year, month, day, hour, minute);
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
          }
        }
      } else {
        return dateValue;
      }
      
      if (!date || isNaN(date.getTime())) {
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

  const isDateValue = (value, headerLabel = '') => {
    if (!value) return false;
    const headerLower = headerLabel.toLowerCase();
    const isDateHeader = headerLower.includes('date') || headerLower.includes('time') || headerLower.includes('timestamp');
    if (isDateHeader) return true;
    if (typeof value === 'number' && value > 40000 && value < 60000) {
      return true;
    }
    if (typeof value === 'string') {
      const datePatterns = [
        /^\d{4}-\d{2}-\d{2}/,
        /^\d{2}\/\d{2}\/\d{4}/,
        /^\d{1,2}\/\d{1,2}\/\d{4}/,
        /Date\(\d{4},\d{1,2},\d{1,2}/
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

      // console.log(`🔄 Fetching data from ${SHEET_NAME} sheet...`);

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

      // console.log(`✅ ${SHEET_NAME} data loaded successfully`);

      const headers = Object.keys(COLUMN_MAPPINGS).map(label => ({
        id: COLUMN_MAPPINGS[label],
        label
      }));

      // Sort headers according to DISPLAY_COLUMNS order
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
            const cellValue = cell?.v ?? cell?.f ?? "";
            const headerLabel = headers.find(h => h.id === `col${i}`)?.label;
            itemObj[`col${i}`] = formatCellValue(cellValue, headerLabel);
          });
        }
        return itemObj;
      });

      // Filter to remove completely empty rows
      const filteredItems = items.filter((item) => {
        return DISPLAY_COLUMNS.some((colIndex) => {
          const value = item[`col${colIndex}`];
          return value && String(value).trim() !== "" && value !== "—";
        });
      });

      console.log('Filtered items:', filteredItems.length, 'Total items:', items.length);
      setTrackingData(filteredItems);
      
      toast.success(`Loaded ${filteredItems.length} records successfully`, {
        duration: 3000,
        position: "top-right",
      });

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
    if (dateFilter && item.col0) {
      const itemDate = parseDate(item.col0);
      const filterDate = new Date(dateFilter);
      
      if (itemDate) {
        return itemDate.toDateString() === filterDate.toDateString();
      }
    }
    return !dateFilter; // If no date filter, return all
  });

  // Get dropdown options from today's data only
  const uniqueDealers = [...new Set(todaysData.map(item => item.col13).filter(Boolean))];
  const uniqueSalesPersons = [...new Set(todaysData.map(item => item.col11).filter(Boolean))];

  // Apply additional filters on today's data
  const filteredTrackingData = todaysData.filter((item) => {
    const term = searchTerm.toLowerCase();
    
    // Search term filter - search across all displayed columns
    const matchesSearchTerm = !searchTerm || DISPLAY_COLUMNS.some((colIndex) => {
      const value = item[`col${colIndex}`];
      return value && String(value).toLowerCase().includes(term);
    });

    // Dealer filter
    const matchesDealer = !dealerFilter || item.col13 === dealerFilter;

    // Sales person filter
    const matchesSalesPerson = !salesPersonFilter || item.col11 === salesPersonFilter;

    return matchesSearchTerm && matchesDealer && matchesSalesPerson;
  });

  // Updated PDF download function for new columns
  const downloadPDF = async () => {
    if (!filteredTrackingData || filteredTrackingData.length === 0) {
      toast.error("No data to export", { duration: 3000, position: "top-right" });
      return;
    }

    try {
      const loadingToast = toast.loading("Generating PDF...", {
        position: "top-right"
      });

      // Simple jsPDF without autoTable
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

      // Manual table creation - updated column widths for new structure
      let yPos = 55;
      const colWidths = [45, 60, 35, 90, 40]; // Give more space to Remark column // Adjusted for 5 columns
      let xPos = 20;

      // Header row
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      sheetHeaders.forEach((header, i) => {
        doc.text(header.label, xPos, yPos);
        xPos += colWidths[i];
      });

      // Data rows
      yPos += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      // filteredTrackingData.slice(0, 25).forEach(item => { // Limit to 25 rows to fit on page
      //   xPos = 20;
      //   sheetHeaders.forEach((header, i) => {
      //     const value = String(item[header.id] || '').substring(0, 25);
      //     doc.text(value, xPos, yPos);
      //     xPos += colWidths[i];
      //   });
      //   yPos += 6;
        
      //   if (yPos > 180) { // New page if needed
      //     doc.addPage();
      //     yPos = 20;
      //   }
      // });


      filteredTrackingData.forEach(item => { // Limit to 25 rows to fit on page
        xPos = 20;
        // sheetHeaders.forEach((header, i) => {
        //   const value = String(item[header.id] || '').substring(0, 25);
        //   doc.text(value, xPos, yPos);
        //   xPos += colWidths[i];
        // });

        sheetHeaders.forEach((header, i) => {
  const value = String(item[header.id] || '');
  // Use splitTextToSize for text wrapping
  const wrappedText = doc.splitTextToSize(value, colWidths[i] - 2);
  doc.text(wrappedText, xPos, yPos);
  xPos += colWidths[i];
});


       // Calculate row height based on longest wrapped text
const maxLines = Math.max(...sheetHeaders.map((header, i) => {
  const value = String(item[header.id] || '');
  const wrapped = doc.splitTextToSize(value, colWidths[i] - 2);
  return wrapped.length;
}));
yPos += maxLines * 5 + 2; // Add padding between rows
        
        if (yPos > 180) { // New page if needed
          doc.addPage();
          yPos = 20;
        }
      });

      // if (filteredTrackingData.length > 25) {
      //   doc.text(`... and ${filteredTrackingData.length - 25} more records`, 20, yPos + 10);
      // }

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading tracking data...</p>
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
    <div className="min-h-screen bg-gray-50 font-sans p-4">
      <Toaster position="top-right" />
      
      {/* MAIN WRAPPER CONTAINER - LIKE SCREENSHOT */}
      <div className="max-w-full mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        
        {/* YOUR EXISTING HEADER SECTION - UNCHANGED */}
        <div className="sticky top-0 z-8 bg-white shadow-md">
          {/* Gradient Title Section */}
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-purple-700 text-white px-4 py-4">
            <div className="container mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold">
                  Daily Report
                </h1>
                <p className="text-sm opacity-90 mt-1">
                  Tracking History & Dealer Interactions
                </p>
              </div>
              <button
                onClick={downloadPDF}
                disabled={filteredTrackingData.length === 0}
                className="inline-flex items-center gap-2 bg-white text-blue-600 hover:bg-blue-50 font-medium px-5 py-2.5 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </button>
            </div>
          </div>

          {/* YOUR EXISTING Filters Section - UNCHANGED */}
          <div className="bg-white px-4 md:px-10 py-4 border-b border-gray-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="search"
                  placeholder="Search records..."
                  className="w-full h-10 pl-9 pr-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Date Filter */}
              <div>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value);
                    setDealerFilter('');
                    setSalesPersonFilter('');
                  }}
                  className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  title="Select date to view records"
                />
              </div>

              {/* Dealer Dropdown */}
              <div>
                <select
                  value={dealerFilter}
                  onChange={(e) => setDealerFilter(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                    paddingRight: '2.5rem'
                  }}
                >
                  <option value="">All Dealers ({uniqueDealers.length})</option>
                  {uniqueDealers.map(dealer => (
                    <option key={dealer} value={dealer}>{dealer}</option>
                  ))}
                </select>
              </div>

              {/* Sales Person Dropdown */}
              <div>
                <select
                  value={salesPersonFilter}
                  onChange={(e) => setSalesPersonFilter(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white appearance-none cursor-pointer"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                    paddingRight: '2.5rem'
                  }}
                >
                  <option value="">All Sales Persons ({uniqueSalesPersons.length})</option>
                  {uniqueSalesPersons.map(person => (
                    <option key={person} value={person}>{person}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* UPDATED TABLE SECTION - NEW COLUMNS */}
        <div className="px-4 md:px-10 py-8">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
            
            {/* SCROLLABLE TABLE CONTENT */}
            <div className="overflow-auto" style={{ maxHeight: '75vh' }}>
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
                  {filteredTrackingData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={sheetHeaders.length}
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
                    filteredTrackingData.map((item) => (
                      <tr
                        key={item._id}
                        className="hover:bg-gray-50 cursor-pointer transition duration-150 ease-in-out"
                        onClick={() => {
                          setSelectedRecord(item);
                          setIsDialogOpen(true);
                        }}
                      >
                        {sheetHeaders.map((header) => (
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

            {/* Show record count - Fixed at bottom */}
            {filteredTrackingData.length > 0 && (
              <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600 text-center">
                Showing {filteredTrackingData.length} records
                {dateFilter && ` for ${new Date(dateFilter).toLocaleDateString('en-GB')}`}
                {(dealerFilter || salesPersonFilter) && " (filtered)"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View Details Dialog */}
      {isDialogOpen && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in-0 p-4">
          <div className="relative w-full max-w-3xl rounded-lg bg-white p-6 shadow-2xl animate-in zoom-in-95 max-h-[95vh] overflow-y-auto transform scale-100 opacity-100">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <h2 className="text-2xl font-bold text-gray-800">
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
              {sheetHeaders.map((header) => {
                const value = selectedRecord[header.id];
                if (value && String(value).trim() !== "" && value !== "—") {
                  return (
                    <div key={header.id} className="flex flex-col">
                      <span className="text-sm font-medium text-gray-500">
                        {header.label}
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

export default DailyReport;
