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
import UserManagement from "./pages/UserManagement"; // Add this import
import supabase from "./SupaabseClient";
import AttendanceHistoryPage from "./pages/AttendanceHistoryPage";

export const AuthContext = createContext(null);

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [notification, setNotification] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [tabs, setTabs] = useState([]);
  const [autoLogoutTimer, setAutoLogoutTimer] = useState(null);
  const [firstLoginTime, setFirstLoginTime] = useState(null);
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);

  // Helper function for case-insensitive admin check
  const isAdminUser = (role) => {
    return role?.toLowerCase() === "admin";
  };

  useEffect(() => {
    const auth = localStorage.getItem("isAuthenticated");
    const storedUser = localStorage.getItem("currentUser");
    const storedUserType = localStorage.getItem("userType");
    const storedFirstLoginTime = localStorage.getItem("firstLoginTime");

    if (auth === "true" && storedUser) {
      const parsedUser = JSON.parse(storedUser);
      
      // For admin users, skip the access check (case-insensitive)
      if (isAdminUser(parsedUser.role)) {
        setIsAuthenticated(true);
        setCurrentUser(parsedUser);
        setUserType(parsedUser.role);
        setTabs(parsedUser.tabs || []);
      } else {
        // For regular users, check if they are allowed to login today
        checkLoginAccess(parsedUser.username).then((canLogin) => {
          if (canLogin) {
            setIsAuthenticated(true);
            setCurrentUser(parsedUser);
            setUserType(parsedUser.role);
            setTabs(parsedUser.tabs || []);
            
            // Restore first login time if available
            if (storedFirstLoginTime) {
              const loginTime = new Date(parseInt(storedFirstLoginTime));
              setFirstLoginTime(loginTime);
              setupAutoLogoutFromFirstLogin(loginTime);
            } else {
              // If no stored first login time, setup auto logout from now
              setupAutoLogout();
            }
          } else {
            // Clear storage if access denied
            localStorage.clear();
            displayNotification("Your access is denied for today. Please request access from admin.", "error");
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

      // If user has a logout time for today, check if admin granted access
      if (data && data.length > 0 && data[0].logout_time) {
        // Check if access was requested and granted
        if (data[0].access_requested && data[0].access_granted) {
          return true;
        }
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error in checkLoginAccess:", error);
      return true;
    }
  };

  // Function to get first login time of the day for a user
  const getFirstLoginTime = async (username) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('user_logs')
        .select('login_time, login_date')
        .eq('user_name', username)
        .eq('login_date', today)
        .order('login_time', { ascending: true })
        .limit(1);

      if (error) {
        console.error("Error getting first login time:", error);
        return null;
      }

      if (data && data.length > 0) {
        const loginTimeStr = data[0].login_time;
        const loginDateStr = data[0].login_date;
        
        // Combine date and time to create a proper Date object
        const loginDateTime = new Date(`${loginDateStr}T${loginTimeStr}`);
        return loginDateTime;
      }

      return null;
    } catch (error) {
      console.error("Error in getFirstLoginTime:", error);
      return null;
    }
  };

  // FIXED: Function to log user activity - simplified to always log login
  const logUserActivity = async (username, action) => {
    try {
      const now = new Date();
      const loginDate = now.toISOString().split('T')[0];
      const loginTime = now.toTimeString().split(' ')[0];

      if (action === 'login') {
        // Always create a new login record without checking for existing sessions
        const { error } = await supabase
          .from('user_logs')
          .insert([
            {
              user_name: username,
              login_date: loginDate,
              login_time: loginTime,
              logout_time: null,
              access_requested: false,
              request_time: null,
              created_at: now.toISOString()
            }
          ]);

        if (error) {
          console.error("Error logging login activity:", error);
          // Don't throw error, just log it
        } else {
          console.log("Login activity logged successfully");
        }
      } else if (action === 'logout') {
        // Update the most recent login record without logout time
        const { error } = await supabase
          .from('user_logs')
          .update({ 
            logout_time: loginTime
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
      // Don't throw error to prevent login failure
    }
  };

  // Function to setup auto logout from first login time (9 hours from first login)
  const setupAutoLogoutFromFirstLogin = (firstLoginTime) => {
    // Don't setup auto logout for admin users
    if (isAdminUser(currentUser?.role)) {
      return;
    }

    const now = new Date();
    const logoutTime = new Date(firstLoginTime.getTime() + (9 * 60 * 60 * 1000)); // 9 hours from first login

    let timeUntilLogout;
    
    if (now > logoutTime) {
      // If it's already past logout time, logout immediately
      timeUntilLogout = 0;
    } else {
      // Calculate time until logout time
      timeUntilLogout = logoutTime - now;
    }

    // Clear existing timer
    if (autoLogoutTimer) {
      clearTimeout(autoLogoutTimer);
    }

    const timer = setTimeout(() => {
      displayNotification("Auto logout: Session ended after 9 hours", "info");
      handleAutoLogout();
    }, timeUntilLogout);

    setAutoLogoutTimer(timer);
    console.log(`Auto logout scheduled at: ${logoutTime.toLocaleString()}`);
  };

  // Function to setup auto logout from current time (for first login)
  const setupAutoLogout = () => {
    // Don't setup auto logout for admin users
    if (isAdminUser(currentUser?.role)) {
      return;
    }

    const now = new Date();
    const logoutTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // 9 hours from now

    // Clear existing timer
    if (autoLogoutTimer) {
      clearTimeout(autoLogoutTimer);
    }

    const timer = setTimeout(() => {
      displayNotification("Auto logout: Session ended after 9 hours", "info");
      handleAutoLogout();
    }, 9 * 60 * 60 * 1000);

    setAutoLogoutTimer(timer);
    console.log(`Auto logout scheduled at: ${logoutTime.toLocaleString()}`);
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
    setFirstLoginTime(null);
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
      const requestTime = new Date().toTimeString().split(' ')[0];
      
      const { error } = await supabase
        .from('user_logs')
        .update({ 
          access_requested: true,
          request_time: requestTime
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

  // Show welcome popup function
  const displayWelcomePopup = (username) => {
    setShowWelcomePopup(true);
    setTimeout(() => {
      setShowWelcomePopup(false);
    }, 2000); // Hide after 2 seconds
  };

  // FIXED: Login function with better error handling for logging
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
          displayNotification("Invalid username or password", "error");
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
            displayNotification("Your access is denied for today. Please request access from admin.", "error");
            return { success: false, accessDenied: true };
          }
        }

        const userInfo = {
          username: data.user_name,
          role: data.role || "user",
          position: data.position || "",
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
                "Attendance History",
                "Daily Report",
                "User Management", // Add User Management for admins
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

        // FIXED: Log login activity - don't await to prevent blocking login
        logUserActivity(username, 'login').catch(err => {
          console.error("Failed to log login activity:", err);
          // Continue with login even if logging fails
        });

        // Show welcome popup
        displayWelcomePopup(username);

        // For regular users, setup auto logout
        if (!userIsAdmin) {
          // Get first login time of the day
          const firstLogin = await getFirstLoginTime(username);
          
          if (firstLogin) {
            // Use the first login time of the day
            setFirstLoginTime(firstLogin);
            localStorage.setItem("firstLoginTime", firstLogin.getTime().toString());
            setupAutoLogoutFromFirstLogin(firstLogin);
          } else {
            // If no first login found, use current time
            const now = new Date();
            setFirstLoginTime(now);
            localStorage.setItem("firstLoginTime", now.getTime().toString());
            setupAutoLogout();
          }
        }

        displayNotification(`Welcome, ${username}!`, "success");
        return { success: true, accessDenied: false };
      } else {
        displayNotification("Invalid username or password", "error");
        return { success: false, accessDenied: false };
      }
    } catch (error) {
      console.error("Login error:", error);
      displayNotification("An error occurred during login", "error");
      return { success: false, accessDenied: false };
    }
  };

  const logout = () => {
    // Log logout activity - don't await to prevent blocking logout
    if (currentUser) {
      logUserActivity(currentUser.username, 'logout').catch(err => {
        console.error("Failed to log logout activity:", err);
        // Continue with logout even if logging fails
      });
    }

    setIsAuthenticated(false);
    setCurrentUser(null);
    setUserType(null);
    setTabs([]);
    setFirstLoginTime(null);
    localStorage.clear();
    
    // Clear auto logout timer
    if (autoLogoutTimer) {
      clearTimeout(autoLogoutTimer);
      setAutoLogoutTimer(null);
    }
    
    displayNotification("Logged out successfully", "success");
  };

  const displayNotification = (message, type = "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const isAdmin = () => isAdminUser(userType);

  const ProtectedRoute = ({ children, adminOnly = false }) => {
    if (!isAuthenticated) return <Navigate to="/login" />;
    if (adminOnly && !isAdmin()) {
      displayNotification(
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
        showNotification: displayNotification,
        tabs,
        requestAccess,
      }}
    >
      <Router>
        <div className="flex h-screen bg-gray-50 text-gray-900">
          {/* Welcome Popup */}
          {showWelcomePopup && currentUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in-0">
              <div className="bg-white rounded-2xl shadow-2xl p-8 mx-4 max-w-md w-full transform animate-in zoom-in-95 scale-100 opacity-100">
                <div className="text-center">
                  {/* Welcome Icon */}
                  <div className="mx-auto mb-6 w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <svg 
                      className="w-10 h-10 text-white" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" 
                      />
                    </svg>
                  </div>
                  
                  {/* Welcome Message */}
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    Welcome to
                  </h2>
                  <h3 className="text-xl font-semibold text-blue-600 mb-4">
                    Retail Enquiry Management System
                  </h3>
                  
                  {/* User Greeting */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mb-6">
                    <p className="text-lg font-medium text-gray-700">
                      Hello, <span className="font-bold text-blue-600">{currentUser.salesPersonName}</span>!
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Role: <span className="font-medium capitalize">{currentUser.position}</span>
                    </p>
                  </div>
                  
                  {/* Loading Animation */}
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                    path="/attendance-history"
                    element={
                      <ProtectedRoute>
                        <AttendanceHistoryPage />
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
                    path="/user-management"
                    element={
                      <ProtectedRoute adminOnly={true}>
                        <UserManagement />
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