
"use client";

import React, { useState, useEffect, createContext } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import DealerForm from "./pages/DealerForm";
import History from "./pages/History";
import Tracker from "./pages/Tracker";
import Reports from "./pages/Reports";
import Login from "./pages/Login";
import Attendance from "./pages/Attendents"; // Corrected typo here, assuming it's "Attendance" in file path
import Sidebar from "./components/Sidebaar";
import DailyReport from "./pages/Dailyreport";

export const AuthContext = createContext(null);

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [notification, setNotification] = useState(null);
  const [currentUser, setCurrentUser] = useState(null); // This will store all user info
  const [userType, setUserType] = useState(null); // This is essentially currentUser.role
  const [tabs, setTabs] = useState([]); // State to hold the tabs preference

  // Spreadsheet ID for Google Sheets data
  const SPREADSHEET_ID = "15_ZUjQA-cSyFMt-70BxPBWVUZ185ioQzTqt5ElWXaZk"; // Your Tracker's Spreadsheet ID

  useEffect(() => {
    const auth = localStorage.getItem("isAuthenticated");
    const storedUser = localStorage.getItem("currentUser"); // Corrected potential typo in key
    const storedUserType = localStorage.getItem("userType"); // This is currentUser.role

    if (auth === "true" && storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setIsAuthenticated(true);
      setCurrentUser(parsedUser);
      setUserType(storedUserType); // Still keep userType for simplicity if used elsewhere
      setTabs(parsedUser.tabs || []); // Set tabs from stored user data
    }
  }, []);

  const login = async (username, password) => {
    try {
      // You are already fetching from the Master sheet for login
      // Username is Column H (index 7), Password is Column I (index 8)
      // Admin/Role is Column J (index 9)
      // Sales Person Name is Column D (index 3)
      const masterSheetUrl =
        `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=Master`;
      const response = await fetch(masterSheetUrl);
      const text = await response.text();

      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}") + 1;
      const jsonData = text.substring(jsonStart, jsonEnd);
      const data = JSON.parse(jsonData);

      if (!data?.table?.rows) {
        showNotification("Failed to fetch user data from Master sheet.", "error");
        return false;
      }

      const rows = data.table.rows;

      // console.log("rows:", rows);
      
      // Check for username and password in columns H (index 7) and I (index 8)
      const foundUserRow = rows.find(
        (row) => row.c?.[7]?.v === username && row.c?.[8]?.v === password
      );

      if (foundUserRow) {
        const userInfo = {
          username: username,
          // Assuming Column J (index 9) is 'Admin' for role
          role: foundUserRow.c?.[9]?.v || "user",
          // Assuming Column G (index 6) is 'Sales Person Name'
          salesPersonName: foundUserRow.c?.[6]?.v || "Unknown Sales Person",
          loginTime: new Date().toISOString(),
          tabs:
            foundUserRow.c?.[10]?.v === "all"
              ? [
                  "Dashboard",
                  "Dealer Form",
                  "Tracker",
                  "History",
                  "Reports",
                  "Attendance",
                  "Daily Report",
                ]
              : (foundUserRow.c?.[10]?.v || "").split(",").map((t) => t.trim()).filter(Boolean), // Split by comma, trim spaces, filter empty strings
        };

        setIsAuthenticated(true);
        setCurrentUser(userInfo);
        setUserType(userInfo.role); // Set userType state from userInfo.role
        setTabs(userInfo.tabs); // Set tabs from user info

        // Store currentUser as a single JSON object in localStorage
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("currentUser", JSON.stringify(userInfo)); // Store all relevant user data
        localStorage.setItem("userType", userInfo.role); // Still store userType separately for backward compatibility if needed

        showNotification(`Welcome, ${username}!`, "success");
        return true;
      } else {
        showNotification("Invalid username or password", "error");
        return false;
      }
    } catch (error) {
      console.error("Login error:", error);
      showNotification("An error occurred during login", "error");
      return false;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setUserType(null);
    setTabs([]); // Reset tabs on logout
    localStorage.clear(); // Clear all localStorage items on logout
    showNotification("Logged out successfully", "success");
  };

  const showNotification = (message, type = "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const isAdmin = () => userType === "admin"; // Check if userType is 'admin'

  const ProtectedRoute = ({ children, adminOnly = false }) => {
    if (!isAuthenticated) return <Navigate to="/login" />;
    if (adminOnly && !isAdmin()) {
      showNotification(
        "You don't have permission to access this page",
        "error"
      );
      return <Navigate to="/" />;
    }
    return children;
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        login,
        logout,
        currentUser, // Provide currentUser object
        userType, // Still provide userType for compatibility
        isAdmin,
        showNotification,
        tabs, // Provide tabs to context
      }}
    >
      <Router>
        <div className="flex h-screen bg-gray-50 text-gray-900">
          {isAuthenticated && (
            <div className=" md:fixed md:inset-y-0 md:left-0 md:w-64 md:bg-gray-800 md:text-white md:z-20 md:shadow-lg">
              <Sidebar
                logout={logout}
                userType={userType}
                username={currentUser?.username}
                tabs={tabs}
              />
            </div>
          )}

          {/* Main Content Wrapper */}
          <div
            className={`flex flex-col flex-1 overflow-hidden ${
              isAuthenticated ? "md:ml-64" : ""
            }`}
          >
            {/* Notification bar */}
            {notification && (
              <div
                className={`p-4 text-sm ${
                  notification.type === "error"
                    ? "bg-red-100 text-red-700"
                    : notification.type === "success"
                    ? "bg-green-100 text-green-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {notification.message}
              </div>
            )}

            {/* Scrollable Content Area */}
            <div className="sm:mt-0 mt-12 flex-1 min-h-0 overflow-y-auto px-2 sm:px-6 py-4 flex flex-col justify-between">
              <div className="mb-5">
                <Routes>
                  <Route
                    path="/login"
                    element={!isAuthenticated ? <Login /> : <Navigate to="/" />}
                  />
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dealer-form"
                    element={
                      <ProtectedRoute>
                        <DealerForm />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/tracker"
                    element={
                      <ProtectedRoute>
                        <Tracker />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/history"
                    element={
                      <ProtectedRoute>
                        <History />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reports"
                    element={
                      <ProtectedRoute>
                        <Reports />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/attendance"
                    element={
                      <ProtectedRoute>
                        <Attendance />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/daily-report"
                    element={
                      <ProtectedRoute>
                        <DailyReport />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" />} />
                </Routes>
              </div>
              {/* Footer */}
              <footer className=" fixed bottom-0 left-0 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 text-white text-center py-3 shadow-inner z-50">
                <p className="text-sm font-medium">
                  Powered by{" "}
                  <a
                    href="https://www.botivate.in/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-yellow-300 transition"
                  >
                    Botivate
                  </a>
                </p>
              </footer>
            </div>
          </div>
        </div>
      </Router>
    </AuthContext.Provider>
  );
};

export default App;
