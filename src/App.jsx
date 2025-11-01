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
import Attendance from "./pages/Attendents";
import Sidebar from "./components/Sidebaar";
import DailyReport from "./pages/Dailyreport";
import AdminLogs from "./pages/AdminLogs";
import supabase from "./SupaabseClient";

export const AuthContext = createContext(null);

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [notification, setNotification] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [tabs, setTabs] = useState([]);
  const [autoLogoutTimer, setAutoLogoutTimer] = useState(null);
  const [hasLoggedInitialActivity, setHasLoggedInitialActivity] = useState(false);

  // Helper function for case-insensitive admin check
  const isAdminUser = (role) => {
    return role?.toLowerCase() === "admin";
  };

  useEffect(() => {
    const auth = localStorage.getItem("isAuthenticated");
    const storedUser = localStorage.getItem("currentUser");
    const storedUserType = localStorage.getItem("userType");

    if (auth === "true" && storedUser) {
      const parsedUser = JSON.parse(storedUser);
      
      // For admin users, skip the access check (case-insensitive)
      if (isAdminUser(parsedUser.role)) {
        setIsAuthenticated(true);
        setCurrentUser(parsedUser);
        setUserType(parsedUser.role);
        setTabs(parsedUser.tabs || []);
        
        // Don't log login activity here - only log during actual login
        // Don't setup auto logout for admin users
      } else {
        // For regular users, check if they are allowed to login today
        checkLoginAccess(parsedUser.username).then((canLogin) => {
          if (canLogin) {
            setIsAuthenticated(true);
            setCurrentUser(parsedUser);
            setUserType(parsedUser.role);
            setTabs(parsedUser.tabs || []);
            
            // Don't log login activity here - only log during actual login
            
            // Setup auto logout at 9 PM
            setupAutoLogout();
          } else {
            // Clear storage if access denied
            localStorage.clear();
            showNotification("Your access is denied for today. Please request access from admin.", "error");
          }
        });
      }
    }
  }, []);

  // Function to check if user can login today (only for regular users)
  const checkLoginAccess = async (username) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Check if user already logged in today and logged out
      const { data, error } = await supabase
        .from('user_logs')
        .select('*')
        .eq('user_name', username)
        .eq('login_date', today)
        .order('login_time', { ascending: false })
        .limit(1);

      if (error) {
        console.error("Error checking login access:", error);
        return true; // Allow login if there's an error checking
      }

      // If user has a logout time for today, deny access
      if (data && data.length > 0 && data[0].logout_time) {
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error in checkLoginAccess:", error);
      return true;
    }
  };

  // Function to log user activity - ONLY call this during actual login/logout
  const logUserActivity = async (username, action) => {
    try {
      const now = new Date();
      const loginDate = now.toISOString().split('T')[0];
      const loginTime = now.toTimeString().split(' ')[0];

      if (action === 'login') {
        // Check if there's already an active session for today
        const { data: existingSessions, error: checkError } = await supabase
          .from('user_logs')
          .select('*')
          .eq('user_name', username)
          .eq('login_date', loginDate)
          .is('logout_time', null)
          .order('login_time', { ascending: false })
          .limit(1);

        if (checkError) {
          console.error("Error checking existing sessions:", checkError);
          return;
        }

        // If there's already an active session, don't create a new one
        if (existingSessions && existingSessions.length > 0) {
          console.log("Active session already exists, not creating new login entry");
          return;
        }

        // Insert new login record only if no active session exists
        const { error } = await supabase
          .from('user_logs')
          .insert([
            {
              user_name: username,
              login_date: loginDate,
              login_time: loginTime,
              logout_time: null,
              access_requested: false
            }
          ]);

        if (error) {
          console.error("Error logging login activity:", error);
        } else {
          console.log("Login activity logged successfully");
        }
      } else if (action === 'logout') {
        // Update the latest login record with logout time
        const { error } = await supabase
          .from('user_logs')
          .update({ 
            logout_time: now.toTimeString().split(' ')[0]
          })
          .eq('user_name', username)
          .eq('login_date', loginDate)
          .is('logout_time', null)
          .order('login_time', { ascending: false })
          .limit(1);

        if (error) {
          console.error("Error logging logout activity:", error);
        } else {
          console.log("Logout activity logged successfully");
        }
      }
    } catch (error) {
      console.error("Error in logUserActivity:", error);
    }
  };

  // Function to setup auto logout at 9 PM (only for regular users)
  const setupAutoLogout = () => {
    // Don't setup auto logout for admin users
    if (isAdminUser(currentUser?.role)) {
      return;
    }

    const now = new Date();
    const ninePM = new Date();
    ninePM.setHours(21, 0, 0, 0); // 9:00 PM

    let timeUntilLogout;
    
    if (now > ninePM) {
      // If it's already past 9 PM, logout immediately
      timeUntilLogout = 0;
    } else {
      // Calculate time until 9 PM
      timeUntilLogout = ninePM - now;
    }

    // Clear existing timer
    if (autoLogoutTimer) {
      clearTimeout(autoLogoutTimer);
    }

    const timer = setTimeout(() => {
      showNotification("Auto logout: Session ended at 9:00 PM", "info");
      handleAutoLogout();
    }, timeUntilLogout);

    setAutoLogoutTimer(timer);
  };

  // Function to handle auto logout
  const handleAutoLogout = () => {
    if (currentUser) {
      logUserActivity(currentUser.username, 'logout');
    }
    
    setIsAuthenticated(false);
    setCurrentUser(null);
    setUserType(null);
    setTabs([]);
    localStorage.clear();
    
    if (autoLogoutTimer) {
      clearTimeout(autoLogoutTimer);
      setAutoLogoutTimer(null);
    }
  };

  // Function to request access (only for regular users)
  const requestAccess = async (username) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase
        .from('user_logs')
        .update({ 
          access_requested: true,
          request_time: new Date().toTimeString().split(' ')[0]
        })
        .eq('user_name', username)
        .eq('login_date', today)
        .order('login_time', { ascending: false })
        .limit(1);

      if (error) {
        console.error("Error requesting access:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error in requestAccess:", error);
      return false;
    }
  };

  const login = async (username, password) => {
    try {
      // Query the master table in Supabase
      const { data, error } = await supabase
        .from('master')
        .select('*')
        .eq('user_name', username)
        .eq('password', password)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          showNotification("Invalid username or password", "error");
          return { success: false, accessDenied: false };
        }
        throw new Error(`Supabase error: ${error.message}`);
      }

      if (data) {
        const userIsAdmin = isAdminUser(data.role);
        
        // For regular users, check if they can login today
        if (!userIsAdmin) {
          const canLogin = await checkLoginAccess(username);
          if (!canLogin) {
            showNotification("Your access is denied for today. Please request access from admin.", "error");
            return { success: false, accessDenied: true };
          }
        }

        const userInfo = {
          username: data.user_name,
          role: data.role || "user",
          salesPersonName: data.sales_person_name || "Unknown Sales Person",
          loginTime: new Date().toISOString(),
          tabs: data.access === "all" 
            ? [
                "Dashboard",
                "Dealer Form",
                "Tracker",
                "History",
                "Reports",
                "Attendance",
                "Daily Report",
                ...(userIsAdmin ? ["Admin Logs"] : [])
              ]
            : (data.access || "").split(",").map((t) => t.trim()).filter(Boolean),
        };

        setIsAuthenticated(true);
        setCurrentUser(userInfo);
        setUserType(userInfo.role);
        setTabs(userInfo.tabs);

        // Store in localStorage
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("currentUser", JSON.stringify(userInfo));
        localStorage.setItem("userType", userInfo.role);

        // Log login activity ONLY HERE - during actual login
        await logUserActivity(username, 'login');

        // Setup auto logout (only for regular users)
        if (!userIsAdmin) {
          setupAutoLogout();
        }

        showNotification(`Welcome, ${username}!`, "success");
        return { success: true, accessDenied: false };
      } else {
        showNotification("Invalid username or password", "error");
        return { success: false, accessDenied: false };
      }
    } catch (error) {
      console.error("Login error:", error);
      showNotification("An error occurred during login", "error");
      return { success: false, accessDenied: false };
    }
  };

  const logout = () => {
    // Log logout activity (for all users) - ONLY HERE during actual logout
    if (currentUser) {
      logUserActivity(currentUser.username, 'logout');
    }

    setIsAuthenticated(false);
    setCurrentUser(null);
    setUserType(null);
    setTabs([]);
    localStorage.clear();
    
    // Clear auto logout timer
    if (autoLogoutTimer) {
      clearTimeout(autoLogoutTimer);
      setAutoLogoutTimer(null);
    }
    
    showNotification("Logged out successfully", "success");
  };

  const showNotification = (message, type = "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const isAdmin = () => isAdminUser(userType);

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
        currentUser,
        userType,
        isAdmin,
        showNotification,
        tabs,
        requestAccess,
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
                  <Route
                    path="/admin-logs"
                    element={
                      <ProtectedRoute adminOnly={true}>
                        <AdminLogs />
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