// pages/AdminLogs.js
"use client";

import React, { useState, useEffect } from "react";
import { Search, Filter, CheckCircle, XCircle, RefreshCw, AlertCircle, Download } from "lucide-react";
import supabase from "../SupaabseClient";

function AdminLogs() {
  const [activeTab, setActiveTab] = useState("history");
  const [logs, setLogs] = useState([]);
  const [accessRequests, setAccessRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    userName: ""
  });
  const [isMobile, setIsMobile] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Fetch logs data
  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      console.log("Fetching logs with filters:", filters);
      
      let query = supabase
        .from('user_logs')
        .select('*')
        .order('login_date', { ascending: false })
        .order('login_time', { ascending: false });

      // Apply filters
      if (filters.startDate) {
        query = query.gte('login_date', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('login_date', filters.endDate);
      }
      if (filters.userName) {
        query = query.ilike('user_name', `%${filters.userName}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      console.log("Fetched logs:", data);
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching logs:", error);
      alert("Failed to fetch logs data");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch access requests - Improved query
  const fetchAccessRequests = async () => {
    try {
      console.log("Fetching access requests...");
      
      const { data, error } = await supabase
        .from('user_logs')
        .select('*')
        .eq('access_requested', true)
        .order('request_time', { ascending: false });

      if (error) {
        console.error("Supabase error for access requests:", error);
        throw error;
      }
      
      console.log("Fetched access requests:", data);
      setAccessRequests(data || []);
    } catch (error) {
      console.error("Error fetching access requests:", error);
      alert("Failed to fetch access requests");
    }
  };

  // Grant access to user - Improved logic
  const grantAccess = async (logId, userName) => {
    try {
      console.log(`Granting access to ${userName}, logId: ${logId}`);
      
      // First, get the current record to understand the state
      const { data: currentRecord, error: fetchError } = await supabase
        .from('user_logs')
        .select('*')
        .eq('id', logId)
        .single();

      if (fetchError) {
        console.error("Error fetching current record:", fetchError);
        throw fetchError;
      }

      console.log("Current record:", currentRecord);

      // Update the log record - set logout_time to null and access_requested to false
      const { error } = await supabase
        .from('user_logs')
        .update({
          access_requested: false,
          request_time: null,
          logout_time: null // Remove logout time to allow login
        })
        .eq('id', logId);

      if (error) throw error;

      // Refresh both lists
      await fetchLogs();
      await fetchAccessRequests();

      alert(`Access granted to ${userName}. They can now login again.`);
    } catch (error) {
      console.error("Error granting access:", error);
      alert("Failed to grant access");
    }
  };

  // Reject access request
  const rejectAccess = async (logId, userName) => {
    try {
      console.log(`Rejecting access for ${userName}, logId: ${logId}`);
      
      // Update the log record to remove access request but keep logout time
      const { error } = await supabase
        .from('user_logs')
        .update({
          access_requested: false,
          request_time: null
        })
        .eq('id', logId);

      if (error) throw error;

      // Refresh access requests
      await fetchAccessRequests();

      alert(`Access request rejected for ${userName}`);
    } catch (error) {
      console.error("Error rejecting access:", error);
      alert("Failed to reject access request");
    }
  };

  // Test function to check database structure
  const checkDatabaseStructure = async () => {
    try {
      console.log("Checking database structure...");
      
      // Check if table exists and get sample data
      const { data, error } = await supabase
        .from('user_logs')
        .select('*')
        .limit(5);

      if (error) {
        console.error("Error checking table:", error);
        return;
      }

      console.log("Sample data from user_logs:", data);
      
      // Check columns
      if (data && data.length > 0) {
        const firstRecord = data[0];
        console.log("Available columns:", Object.keys(firstRecord));
        console.log("First record details:", firstRecord);
      }
    } catch (error) {
      console.error("Error checking database structure:", error);
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      fetchLogs();
    } else {
      fetchAccessRequests();
    }
  }, [activeTab]);

  // Debug: Check database on component mount
  useEffect(() => {
    checkDatabaseStructure();
  }, []);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      userName: ""
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return "—";
    return timeString.substring(0, 5); // Show only HH:MM
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
  };

  // Manual refresh function
  // const handleManualRefresh = () => {
  //   if (activeTab === "history") {
  //     fetchLogs();
  //   } else {
  //     fetchAccessRequests();
  //   }
  // };

  // Export data function
  const exportData = () => {
    try {
      const dataToExport = activeTab === "history" ? logs : accessRequests;
      const headers = activeTab === "history" 
        ? ["User Name", "Login Date", "Login Time", "Logout Time", "Status", "Access Requested"]
        : ["User Name", "Login Date", "Request Time", "Status"];
      
      const csvContent = [
        headers.join(","),
        ...dataToExport.map(item => {
          if (activeTab === "history") {
            return [
              item.user_name,
              formatDate(item.login_date),
              formatTime(item.login_time),
              formatTime(item.logout_time),
              item.logout_time ? "Logged Out" : "Active",
              item.access_requested ? "Yes" : "No"
            ].join(",");
          } else {
            return [
              item.user_name,
              formatDate(item.login_date),
              formatTime(item.request_time),
              "Pending"
            ].join(",");
          }
        })
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `AdminLogs_${activeTab}_${new Date().toISOString().split("T")[0]}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Export error:", error);
      alert("Failed to export data");
    }
  };

  // Mobile Card View for History
  const MobileHistoryView = ({ items }) => {
    return (
      <div className="flex flex-col h-[calc(100vh-400px)] bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* Fixed Header */}
        <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200 px-4 py-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
              Login History ({items.length})
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
                <p className="text-gray-500 font-medium">No logs found</p>
                <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              items.map((log) => (
                <div
                  key={log.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-gray-500">User:</span>
                    <span className="text-sm font-semibold text-gray-900">{log.user_name}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-gray-500">Login Date:</span>
                    <span className="text-sm text-gray-900">{formatDate(log.login_date)}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-gray-500">Login Time:</span>
                    <span className="text-sm text-gray-900">{formatTime(log.login_time)}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-gray-500">Logout Time:</span>
                    <span className="text-sm text-gray-900">{formatTime(log.logout_time) || "—"}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-gray-500">Status:</span>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        log.logout_time
                          ? "bg-green-100 text-green-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {log.logout_time ? "Logged Out" : "Active"}
                    </span>
                  </div>
                  {log.access_requested && (
                    <>
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-500">Access Request:</span>
                        <span className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                          Pending
                        </span>
                      </div>
                      <div className="pt-2 border-t border-gray-100">
                        <div className="flex gap-2">
                          <button
                            onClick={() => grantAccess(log.id, log.user_name)}
                            className="flex-1 px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                          >
                            Grant
                          </button>
                          <button
                            onClick={() => rejectAccess(log.id, log.user_name)}
                            className="flex-1 px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  // Desktop Table View for History
  const DesktopHistoryView = ({ items }) => {
    return (
      <div className="overflow-hidden border border-gray-200 rounded-lg">
        <div className="overflow-auto max-h-[calc(100vh-400px)]">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Login Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Login Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Logout Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Access Requested
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center">
                    <div className="flex items-center justify-center">
                      <RefreshCw className="h-6 w-6 animate-spin text-blue-600 mr-2" />
                      <span className="text-gray-600">Loading logs...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    No logs found for the selected filters.
                  </td>
                </tr>
              ) : (
                items.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {log.user_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(log.login_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTime(log.login_time)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTime(log.logout_time) || "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          log.logout_time
                            ? "bg-green-100 text-green-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {log.logout_time ? "Logged Out" : "Active"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.access_requested ? (
                        <span className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                          Pending
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {log.access_requested && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => grantAccess(log.id, log.user_name)}
                            className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                          >
                            Grant
                          </button>
                          <button
                            onClick={() => rejectAccess(log.id, log.user_name)}
                            className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Main Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-4 py-6 lg:px-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="text-center lg:text-left">
                <h3 className="text-xl lg:text-2xl font-bold text-white mb-2">
                  Admin Logs
                </h3>
                <p className="text-orange-50 text-sm lg:text-lg">
                  Manage user access and view login history
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {/* Mobile Filter Toggle */}
                {isMobile && activeTab === "history" && (
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
                  disabled={(activeTab === "history" ? logs : accessRequests).length === 0}
                  className="bg-white/20 hover:bg-white/30 text-white font-medium py-2 px-3 lg:px-4 rounded-lg transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm lg:text-base"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export</span>
                </button>
                {/* <button
                  onClick={handleManualRefresh}
                  className="bg-white/20 hover:bg-white/30 text-white font-medium py-2 px-3 lg:px-4 rounded-lg transition-all duration-200 flex items-center gap-2 text-sm lg:text-base"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="hidden sm:inline">Refresh</span>
                </button> */}
              </div>
            </div>
          </div>

          <div className="p-4 lg:p-8">
            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="flex -mb-px">
                <button
                  onClick={() => setActiveTab("history")}
                  className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                    activeTab === "history"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Login History
                </button>
                <button
                  onClick={() => setActiveTab("requests")}
                  className={`py-4 px-6 text-center border-b-2 font-medium text-sm relative ${
                    activeTab === "requests"
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  Access Requests
                  {accessRequests.length > 0 && (
                    <span className="absolute top-2 right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {accessRequests.length}
                    </span>
                  )}
                </button>
              </nav>
            </div>

            {/* History Tab */}
            {activeTab === "history" && (
              <div>
                {/* Mobile Filter Dropdown */}
                {isMobile && isFilterOpen && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="search"
                        placeholder="Search by user name..."
                        className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={filters.userName}
                        onChange={(e) => handleFilterChange("userName", e.target.value)}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <span>Start Date</span>
                      </div>
                      <input
                        type="date"
                        value={filters.startDate}
                        onChange={(e) => handleFilterChange("startDate", e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <span>End Date</span>
                      </div>
                      <input
                        type="date"
                        value={filters.endDate}
                        onChange={(e) => handleFilterChange("endDate", e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={fetchLogs}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                      >
                        Apply Filters
                      </button>
                      <button
                        onClick={clearFilters}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}

                {/* Desktop Filters */}
                {!isMobile && (
                  <div className="bg-gray-50 p-4 rounded-lg mb-6">
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          User Name
                        </label>
                        <input
                          type="text"
                          value={filters.userName}
                          onChange={(e) => handleFilterChange("userName", e.target.value)}
                          placeholder="Search by user name..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={filters.startDate}
                          onChange={(e) => handleFilterChange("startDate", e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={filters.endDate}
                          onChange={(e) => handleFilterChange("endDate", e.target.value)}
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={fetchLogs}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                          <Filter className="h-4 w-4" />
                          Apply
                        </button>
                        <button
                          onClick={clearFilters}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mobile Search Bar (when filters are closed) */}
                {isMobile && !isFilterOpen && (
                  <div className="mb-4 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="search"
                      placeholder="Search by user name..."
                      className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={filters.userName}
                      onChange={(e) => handleFilterChange("userName", e.target.value)}
                    />
                  </div>
                )}

                {/* Data Display */}
                {isMobile ? (
                  <MobileHistoryView items={logs} />
                ) : (
                  <DesktopHistoryView items={logs} />
                )}
              </div>
            )}

            {/* Access Requests Tab */}
            {activeTab === "requests" && (
              <div>
                <div className="mb-4 flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">
                    Pending Access Requests ({accessRequests.length})
                  </h3>
                </div>

                {accessRequests.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <div className="mb-4">
                      <AlertCircle className="h-12 w-12 text-gray-400 mx-auto" />
                    </div>
                    <p className="text-gray-500 mb-2">No pending access requests found.</p>
                    <p className="text-gray-400 text-sm">
                      When users request access after being denied, they will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[calc(100vh-400px)] overflow-y-auto">
                    {accessRequests.map((request) => (
                      <div
                        key={request.id}
                        className="bg-yellow-50 border border-yellow-200 rounded-lg p-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">
                              {request.user_name}
                            </h4>
                            <p className="text-sm text-gray-600 mt-1">
                              Requested on {formatDate(request.login_date)} at {formatTime(request.request_time)}
                            </p>
                            <p className="text-sm text-gray-600">
                              Last login: {formatTime(request.login_time)} | 
                              Logout: {formatTime(request.logout_time) || "Not logged out"}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Request ID: {request.id}
                            </p>
                          </div>
                          <div className="flex gap-2 mt-3 sm:mt-0">
                            <button
                              onClick={() => grantAccess(request.id, request.user_name)}
                              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                            >
                              <CheckCircle className="h-4 w-4" />
                              Grant Access
                            </button>
                            <button
                              onClick={() => rejectAccess(request.id, request.user_name)}
                              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                            >
                              <XCircle className="h-4 w-4" />
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLogs;