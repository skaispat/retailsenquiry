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
  Users,
  ShoppingCart
} from "lucide-react";
import { AuthContext } from "../App";
import logo from '../../public/logo.jpeg';

function Sidebar({ userType, username, tabs = [], isMobileOpen, onMobileClose }) {
  const location = useLocation();
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
      label: "Orders",
      icon: ShoppingCart,
      href: "/orders",
      color: "text-amber-500",
      adminOnly: true
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
  const filteredRoutes = availableRoutes.filter((route) => {
    if (route.adminOnly && !isAdmin) {
      return false;
    }
    return tabs.includes(route.label);
  });

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => onMobileClose()}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed left-0 top-0 z-50 h-full bg-gradient-to-b from-purple-50 via-blue-50 to-indigo-50 border-r border-slate-200/80 shadow-xl transition-all duration-300 ease-in-out flex flex-col",
          "lg:relative lg:translate-x-0 lg:shadow-lg",
          isMobileOpen ? "translate-x-0 w-72" : "-translate-x-full w-72",
          "lg:w-64"
        )}
      >
        {/* Close button: visible only on mobile */}
        <button
          className="lg:hidden absolute right-3 top-3 text-slate-600 hover:text-slate-900 hover:bg-slate-100 p-1.5 rounded-lg z-50"
          onClick={() => onMobileClose()}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Navigation */}
        <nav className="flex-1 px-4 pt-10 lg:pt-6 pb-3 space-y-2 overflow-y-auto">
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
                  if (window.innerWidth < 1024) onMobileClose();
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

        {/* Small Logout Button at Bottom */}
        <div className="mt-auto p-4 border-t border-slate-200/50 bg-white/30">
          <button
            onClick={() => logout()}
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all w-full focus:outline-none focus:ring-2 focus:ring-red-500/20"
            title="Logout"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span className="truncate">Logout</span>
          </button>
        </div>
      </div>

    </>
  );
}

export default Sidebar;