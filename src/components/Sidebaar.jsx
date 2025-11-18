import React, { useState, useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  ClipboardList,
  Home,
  Calendar,
  Menu,
  X,
  History,
  FileSpreadsheet,
  LogOut,
  User,
  Shield,
  Clock,
  FileText,
  Users // Add this import for User Management
} from "lucide-react";
import { AuthContext } from "../App"; 
import logo from '../../public/logo.jpeg';

function Sidebar({ userType, username, tabs = [] }) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { logout } = useContext(AuthContext);

  const cn = (...classes) => classes.filter(Boolean).join(" ");

  // Check if user is admin (case-insensitive)
  const isAdmin = userType?.toLowerCase() === "admin";

  const availableRoutes = [
    { label: "Dashboard", icon: Home, href: "/", color: "text-sky-500" },
    {
      label: "Dealer Form",
      icon: ClipboardList,
      href: "/dealer-form",
      color: "text-violet-500",
    },
    {
      label: "Tracker",
      icon: FileSpreadsheet,
      href: "/tracker",
      color: "text-green-600",
    },
    {
      label: "History",
      icon: History,
      href: "/history",
      color: "text-pink-700",
    },
    {
      label: "Reports",
      icon: BarChart3,
      href: "/reports",
      color: "text-orange-500",
    },
    {
      label: "Attendance",
      icon: Calendar,
      href: "/attendance",
      color: "text-emerald-500",
    },
    {
      label: "Attendance History",
      icon: Clock,
      href: "/attendance-history",
      color: "text-teal-500",
    },
    {
      label: "Daily Report",
      icon: FileText,
      href: "/daily-report",
      color: "text-blue-500",
    },
    {
      label: "User Management",
      icon: Users,
      href: "/user-management",
      color: "text-indigo-500",
      adminOnly: true
    },
    {
      label: "Admin Logs",
      icon: Shield,
      href: "/admin-logs",
      color: "text-red-500",
      adminOnly: true
    },
  ];

  // Filter routes based on the tabs prop
  const filteredRoutes =
    tabs.length > 0
      ? availableRoutes.filter((route) => tabs.includes(route.label))
      : availableRoutes;

  const handleLogout = () => {
    logout();
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isCollapsed && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsCollapsed(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed left-0 top-0 z-50 h-full bg-gradient-to-b from-purple-50 via-blue-50 to-indigo-50 border-r border-slate-200/80 shadow-xl transition-all duration-300 ease-in-out flex flex-col",
          "lg:relative lg:translate-x-0 lg:shadow-lg",
          isCollapsed ? "translate-x-0 w-72" : "-translate-x-full w-72",
          "lg:w-64"
        )}
      >
        {/* Header */}
        <div className="flex flex-col items-center py-4 px-4 border-b border-slate-200/50 flex-shrink-0">
          {/* Logo */} 
          <h1 className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 text-xl text-center">
            Retail EMS
          </h1>
          <div className="mb-3 mt-4">
            <img 
              className="h-25 w-65 object-contain" 
              src={logo} 
              alt="REMS Logo"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
          
          {/* App Name */}
         

          {/* Close button: visible only on mobile */}
          <button
            className="lg:hidden absolute right-4 top-4 text-slate-600 hover:text-slate-900 hover:bg-slate-100 p-2 rounded-lg"
            onClick={() => setIsCollapsed(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-3 space-y-2 overflow-y-auto">
          {filteredRoutes.length === 0 ? (
            <div className="text-center text-gray-500 p-4">
              No menu items available
            </div>
          ) : (
            filteredRoutes.map((route) => (
              <Link
                key={route.href}
                to={route.href}
                onClick={() => {
                  if (window.innerWidth < 1024) setIsCollapsed(false);
                }}
                className={cn(
                  "group flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-xl transition-all duration-200",
                  "hover:bg-white/60 hover:shadow-sm hover:scale-[1.02]",
                  "focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:bg-white/60",
                  location.pathname === route.href
                    ? "bg-white shadow-md text-slate-900 border border-slate-200/50"
                    : "text-slate-600 hover:text-slate-900"
                )}
                title={route.label}
              >
                <route.icon
                  className={cn(
                    "h-5 w-5 flex-shrink-0 transition-colors",
                    route.color,
                    location.pathname === route.href && "drop-shadow-sm"
                  )}
                />
                <span className="truncate">{route.label}</span>
                
                {/* Show active indicator for all routes */}
                {location.pathname === route.href && (
                  <div className={cn(
                    "ml-auto w-2 h-2 rounded-full",
                    route.adminOnly ? "bg-red-500" : "bg-gradient-to-r from-purple-500 to-blue-500"
                  )} />
                )}
              </Link>
            ))
          )}
        </nav>

        {/* Footer with User Info and Logout - Fixed for mobile visibility */}
        <div className="mt-auto px-4 pb-12 pt-4 border-t border-slate-200/50 bg-white/30 space-y-3">
          {/* User Info */}
          <div className="flex items-center gap-3 px-3.5 py-2.5 bg-white/60 rounded-lg shadow-sm">
            <div className={cn(
              "flex items-center justify-center w-9 h-9 rounded-full",
              isAdmin 
                ? "bg-gradient-to-r from-red-500 to-orange-500" 
                : "bg-gradient-to-r from-purple-500 to-blue-500"
            )}>
              <User className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {username || 'User'}
              </p>
              <p className="text-xs text-slate-500 capitalize flex items-center gap-1">
                {userType || 'user'}
                {isAdmin && (
                  <Shield className="h-3 w-3 text-red-500" />
                )}
              </p>
            </div>
          </div>

          {/* Logout Button - Always visible */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg hover:shadow-xl transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-red-500/50 active:scale-[0.98]"
            title="Logout"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Mobile toggle */}
      <button
        className="fixed top-2 left-3 z-50 lg:hidden rounded-xl bg-white shadow-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 p-3"
        onClick={() => setIsCollapsed(true)}
      >
        <Menu className="h-5 w-5" />
      </button>
    </>
  );
}

export default Sidebar;