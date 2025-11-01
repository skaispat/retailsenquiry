// pages/AdminLogs.js
"use client";

import React, { useState, useEffect } from "react";
import { Search, Filter, CheckCircle, XCircle, RefreshCw, AlertCircle } from "lucide-react";
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
  const handleManualRefresh = () => {
    if (activeTab === "history") {
      fetchLogs();
    } else {
      fetchAccessRequests();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Admin Logs</h1>
              <p className="text-gray-600 mt-2">Manage user access and view login history</p>
            </div>
            <button
              onClick={handleManualRefresh}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Debug Info */}
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-yellow-800 text-sm font-medium">Debug Information</p>
              <p className="text-yellow-700 text-xs mt-1">
                Total Logs: {logs.length} | Access Requests: {accessRequests.length}
              </p>
              <button
                onClick={checkDatabaseStructure}
                className="mt-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded hover:bg-yellow-200"
              >
                Check Database
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="border-b border-gray-200">
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

          <div className="p-6">
            {/* History Tab */}
            {activeTab === "history" && (
              <div>
                {/* Filters */}
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

                {/* Logs Table */}
                <div className="overflow-hidden border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
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
                      ) : logs.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                            No logs found for the selected filters.
                          </td>
                        </tr>
                      ) : (
                        logs.map((log) => (
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
            )}

            {/* Access Requests Tab */}
            {activeTab === "requests" && (
              <div>
                <div className="mb-4 flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">
                    Pending Access Requests ({accessRequests.length})
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={fetchAccessRequests}
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Refresh
                    </button>
                  </div>
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
                  <div className="grid gap-4">
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