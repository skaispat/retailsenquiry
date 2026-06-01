"use client";

import React, { useState, useEffect } from 'react';
import supabase from '../SupaabseClient';
import { MapPin, Loader2, Calendar, User, Navigation, Map, Download, Filter } from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const AttendanceHistoryPage = () => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states
  const [selectedUser, setSelectedUser] = useState('');

  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    fetchAttendanceData();
    fetchUsers();
  }, []);

  useEffect(() => {
    filterData();
  }, [attendanceData, selectedUser, exportStartDate, exportEndDate]);

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .order('date_and_time', { ascending: false });

      if (error) throw error;

      setAttendanceData(data || []);
      setFilteredData(data || []);
    } catch (err) {
      console.error('Error fetching attendance data:', err);
      setError('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('sales_person_name')
        .order('sales_person_name');

      if (error) throw error;

      // Get unique user names
      const uniqueUsers = [...new Set(data.map(item => item.sales_person_name))].filter(Boolean);
      setUsers(uniqueUsers);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const filterData = () => {
    let filtered = attendanceData;

    if (selectedUser) {
      filtered = filtered.filter(item => item.sales_person_name === selectedUser);
    }

    if (exportStartDate) {
      const start = new Date(exportStartDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(item => {
        if (!item.date_and_time) return false;
        const itemDate = new Date(item.date_and_time);
        return itemDate >= start;
      });
    }

    if (exportEndDate) {
      const end = new Date(exportEndDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(item => {
        if (!item.date_and_time) return false;
        const itemDate = new Date(item.date_and_time);
        return itemDate <= end;
      });
    }

    setFilteredData(filtered);
  };

  const clearFilters = () => {
    setSelectedUser('');
    setExportStartDate('');
    setExportEndDate('');
  };

  // Export by date range — queries Supabase directly
  const exportByDateRange = async () => {
    try {
      setExportLoading(true);

      let query = supabase
        .from('attendance')
        .select('*')
        .order('date_and_time', { ascending: false });

      if (selectedUser) {
        query = query.eq('sales_person_name', selectedUser);
      }
      if (exportStartDate) {
        query = query.gte('date_and_time', exportStartDate + 'T00:00:00');
      }
      if (exportEndDate) {
        query = query.lte('date_and_time', exportEndDate + 'T23:59:59');
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      if (!data || data.length === 0) {
        alert('No records found for the selected date range.');
        return;
      }

      // Generate PDF using the same layout as exportToPDF
      const doc = new jsPDF('landscape');

      doc.setFontSize(16);
      doc.setTextColor(40, 40, 40);
      doc.text('ATTENDANCE HISTORY REPORT', 148, 15, { align: 'center' });

      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);

      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      doc.text(`Generated: ${currentDate}`, 148, 22, { align: 'center' });

      let rangeLabel = 'All Dates';
      if (exportStartDate && exportEndDate) {
        rangeLabel = `From: ${exportStartDate}  To: ${exportEndDate}`;
      } else if (exportStartDate) {
        rangeLabel = `From: ${exportStartDate}`;
      } else if (exportEndDate) {
        rangeLabel = `Up to: ${exportEndDate}`;
      }
      doc.text(`Date Range: ${rangeLabel}`, 148, 28, { align: 'center' });
      doc.text(`User: ${selectedUser || 'All Users'}  |  Total Records: ${data.length}`, 148, 34, { align: 'center' });

      const columns = [
        { header: 'SALES PERSON', key: 'sales_person_name', width: 40 },
        { header: 'DATE & TIME', key: 'date_and_time', width: 50 },
        { header: 'STATUS', key: 'status', width: 30 },
        { header: 'ADDRESS', key: 'address', width: 120 }
      ];

      const cleanTextForPDF = (text) => {
        if (!text || typeof text !== 'string') return text;
        // Remove non-ASCII characters and clean up multiple commas left behind
        return text.replace(/[^\x00-\x7F]/g, '').replace(/,\s*,/g, ',').replace(/\s+,/g, ',').trim();
      };

      const tableHeaders = columns.map(c => c.header);
      const tableData = data.map(record => {
        return columns.map(column => {
          let cellValue = record[column.key] || 'N/A';
          if (column.key === 'date_and_time' || column.key === 'end_date') {
            cellValue = formatDateTimeForPDF(cellValue);
          }
          if (column.key === 'map_link' && cellValue !== 'N/A') {
            cellValue = 'View Map';
          }
          return cleanTextForPDF(cellValue.toString());
        });
      });

      autoTable(doc, {
        startY: 45,
        head: [tableHeaders],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [128, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 8, cellPadding: 3, textColor: [0, 0, 0] },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        margin: { left: 14, right: 14 }
      });

      const totalPages = doc.internal.getNumberOfPages();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }

      const fileName = `Attendance_Filtered_${exportStartDate || 'start'}_to_${exportEndDate || 'end'}.pdf`;
      doc.save(fileName);

    } catch (err) {
      console.error('Export by date range error:', err);
      alert('Failed to export. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  // Export PDF function with proper header visibility
  const exportToPDF = () => {
    try {
      const doc = new jsPDF('landscape');

      // Title
      doc.setFontSize(16);
      doc.setTextColor(40, 40, 40);
      doc.text("ATTENDANCE HISTORY REPORT", 148, 15, { align: "center" });

      // Report information
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);

      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      doc.text(`Generated: ${currentDate}`, 148, 22, { align: "center" });

      // Filter information
      let filterInfo = "All Users | All Dates";
      if (selectedUser || selectedDate) {
        filterInfo = `${selectedUser ? `User: ${selectedUser}` : 'All Users'} | ${selectedDate ? `Date: ${selectedDate}` : 'All Dates'}`;
      }

      doc.text(`Filters: ${filterInfo}`, 148, 28, { align: "center" });
      doc.text(`Total Records: ${filteredData.length}`, 148, 34, { align: "center" });

      // Define all columns with proper widths that fit in landscape mode
      const columns = [
        { header: 'SALES PERSON', key: 'sales_person_name', width: 40 },
        { header: 'DATE & TIME', key: 'date_and_time', width: 50 },
        { header: 'STATUS', key: 'status', width: 30 },
        { header: 'ADDRESS', key: 'address', width: 120 }
      ];

      const cleanTextForPDF = (text) => {
        if (!text || typeof text !== 'string') return text;
        return text.replace(/[^\x00-\x7F]/g, '').replace(/,\s*,/g, ',').replace(/\s+,/g, ',').trim();
      };

      const tableHeaders = columns.map(c => c.header);
      const tableData = filteredData.map(record => {
        return columns.map(column => {
          let cellValue = record[column.key] || 'N/A';
          if (column.key === 'date_and_time' || column.key === 'end_date') {
            cellValue = formatDateTimeForPDF(cellValue);
          }
          if (column.key === 'map_link' && cellValue !== 'N/A') {
            cellValue = 'View Map';
          }
          return cleanTextForPDF(cellValue.toString());
        });
      });

      autoTable(doc, {
        startY: 45,
        head: [tableHeaders],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [128, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        styles: { fontSize: 8, cellPadding: 3, textColor: [0, 0, 0] },
        alternateRowStyles: { fillColor: [240, 240, 240] },
        margin: { left: 14, right: 14 }
      });

      // Add page numbers
      const totalPages = doc.internal.getNumberOfPages();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(
          `Page ${i} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: "center" }
        );
      }

      // Save the PDF
      const fileName = `Attendance_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

    } catch (error) {
      console.error("PDF Export Error:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  // Helper function to format date for PDF
  const formatDateTimeForPDF = (timestamp) => {
    if (!timestamp || timestamp === 'N/A') return 'N/A';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return 'N/A';
    }
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return '-';

    try {
      const date = new Date(timestamp);

      // Use local timezone for display
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();

      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');

      return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return '-';
    }
  };


  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'IN':
        return 'bg-green-100 text-green-800 border border-green-200';
      case 'OUT':
        return 'bg-red-100 text-red-800 border border-red-200';
      default:
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 text-[#800000] animate-spin" />
              <span className="ml-3 text-gray-600">Loading attendance data...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-center text-red-600">
              <p>{error}</p>
              <button
                onClick={fetchAttendanceData}
                className="mt-4 px-4 py-2 bg-[#800000] text-white rounded-lg hover:bg-[#990000] transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#800000] via-[#990000] to-[#b30000] px-4 sm:px-6 py-4 sm:py-6">
            <div className="flex flex-row items-center justify-between gap-2">
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-0 md:mb-2">
                  Attendance History
                </h1>
                <p className="text-red-50 hidden md:block">
                  View and filter attendance records
                </p>
              </div>
              <div>
                <button
                  onClick={exportByDateRange}
                  disabled={exportLoading}
                  className="px-3 py-1.5 md:px-4 md:py-2.5 bg-white text-[#800000] text-sm md:text-base font-bold rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-1.5 md:gap-2 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {exportLoading ? (
                    <><Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> <span className="hidden sm:inline">Exporting...</span></>
                  ) : (
                    <><Download className="w-4 h-4 md:w-5 md:h-5" /> <span className="hidden sm:inline">Export PDF</span><span className="sm:hidden">Export</span></>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-gray-50 p-6 border-b border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-2 gap-4 items-end">
              {/* User Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Filter by User
                </label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800000] bg-white"
                >
                  <option value="">All Users</option>
                  {users.map(user => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clear Filters */}
              <div>
                <button
                  onClick={clearFilters}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                >
                  <span>Clear All Filters</span>
                </button>
              </div>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="bg-white p-6 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-[#800000]" />
              <h3 className="text-lg font-semibold text-gray-800">Filter & Export by Date</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800000] bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#800000] bg-white"
                />
              </div>
            </div>
          </div>

          {/* Results Count */}
          {/* <div className="px-6 py-4 bg-white border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-600">
                Showing {filteredData.length} of {attendanceData.length} records
              </p>
              {filteredData.length > 0 && (
                <p className="text-sm text-gray-500 mt-1 sm:mt-0">
                  PDF includes: Sales Person, Date & Time, End Date, Status, Reason, Latitude, Longitude, Map Link, Address
                </p>
              )}
            </div>  
          </div> */}

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <div className="max-h-150 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                      Sales Person
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                      Date & Time
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                      End Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                      Reason
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
                      Location
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                        <div className="flex flex-col items-center justify-center">
                          <Calendar className="w-12 h-12 text-gray-400 mb-2" />
                          <p className="text-lg font-medium">No attendance records found</p>
                          <p className="text-sm text-gray-500 mt-1">Try adjusting your filters</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-r from-[#800000] to-[#b30000] rounded-full flex items-center justify-center">
                              <span className="text-white font-semibold text-sm">
                                {record.sales_person_name?.charAt(0)?.toUpperCase() || 'U'}
                              </span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {record.sales_person_name || '-'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 font-medium">
                            {formatDateTime(record.date_and_time)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-500">
                            {record.end_date ? formatDateTime(record.end_date) : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(record.status)}`}
                          >
                            {record.status || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500 max-w-xs">
                            {record.reason || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            {record.map_link ? (
                              <a
                                href={record.map_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#800000] hover:text-[#660000] flex items-center gap-1 text-sm"
                              >
                                <MapPin className="w-4 h-4" />
                                View Map
                              </a>
                            ) : (
                              <span className="text-gray-400 text-sm">No location</span>
                            )}
                            {record.address && (
                              <div className="text-xs text-gray-500 max-w-xs truncate">
                                {record.address}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden p-4 space-y-4 max-h-96 overflow-y-auto">
            {filteredData.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-lg font-medium text-gray-500">No attendance records found</p>
                <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              filteredData.map((record) => (
                <div key={record.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-r from-[#800000] to-[#b30000] rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                          {record.sales_person_name?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {record.sales_person_name || '-'}
                        </div>
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(record.status)}`}
                        >
                          {record.status || '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Start:</span>
                      <span className="text-gray-900 font-medium">{formatDateTime(record.date_and_time)}</span>
                    </div>

                    {record.end_date && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">End:</span>
                        <span className="text-gray-900 font-medium">{formatDateTime(record.end_date)}</span>
                      </div>
                    )}

                    {record.reason && (
                      <div className="text-sm">
                        <span className="text-gray-500">Reason: </span>
                        <span className="text-gray-900">{record.reason}</span>
                      </div>
                    )}

                    {/* Location */}
                    <div className="pt-2 border-t border-gray-100">
                      {record.map_link ? (
                        <a
                          href={record.map_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#800000] hover:text-[#660000] flex items-center gap-1 text-sm"
                        >
                          <Navigation className="w-4 h-4" />
                          View Location on Map
                        </a>
                      ) : (
                        <div className="flex items-center gap-1 text-gray-400 text-sm">
                          <Map className="w-4 h-4" />
                          No location data
                        </div>
                      )}
                      {record.address && (
                        <div className="text-xs text-gray-500 mt-1 truncate">
                          {record.address}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceHistoryPage;