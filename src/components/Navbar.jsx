import React, { useState } from 'react';
import { Menu, User, LogOut } from 'lucide-react';

const Navbar = ({ toggleSidebar, salesPersonName, userType, isAdmin, onLogout }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-30 shadow-sm">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">

          {/* Left side: Mobile Toggle & Logo/Title */}
          <div className="flex items-center">
            {/* 
              This toggle is primarily for mobile views.
              You can connect this to the same state used in Sidebaar.jsx 
            */}
            <button
              onClick={toggleSidebar}
              className="p-2 mr-2 text-gray-500 rounded-lg hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#800000] lg:hidden transition-colors"
              aria-label="Toggle Sidebar"
            >
              <Menu className="w-6 h-6" />
            </button>

          </div>

          {/* Right side: Search, Notifications, User Profile */}
          <div className="flex items-center gap-3 sm:gap-4">

            {/* User Profile Info & Dropdown */}
            <div className="relative pl-2 sm:pl-4 border-l border-gray-200">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-3 focus:outline-none group"
              >
                <div className="flex flex-col items-end text-right">
                  <p className="text-sm font-semibold text-gray-700 leading-tight group-hover:text-gray-900 transition-colors">
                    {salesPersonName || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 capitalize leading-tight mt-0.5">
                    {userType || 'Role'}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#800000] to-[#cc0000] flex items-center justify-center text-white shadow-md group-hover:shadow-lg transition-all">
                  <User className="w-4.5 h-4.5" />
                </div>
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <>
                  {/* Invisible overlay to close dropdown when clicking outside */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsDropdownOpen(false)}
                  ></div>
                  <div className="absolute right-0 mt-3 w-48 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-50 animate-in fade-in slide-in-from-top-2">
                    {/* Only show name in dropdown on mobile since it's hidden in the navbar */}
                    <div className="px-4 py-3 border-b border-gray-100 sm:hidden">
                      <p className="text-sm font-semibold text-gray-900 truncate">{salesPersonName || 'User'}</p>
                      <p className="text-xs text-gray-500 capitalize truncate mt-0.5">{userType || 'Role'}</p>
                    </div>
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        if (onLogout) onLogout();
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
