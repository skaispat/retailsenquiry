import React from "react";
import { Loader2, MapPin, User, Calendar, Navigation } from "lucide-react";

const AttendanceHistory = ({ attendanceData, isLoading, userRole }) => {
  const headers = [
    "Name",
    "Date & Time",
    "Status",
    "Map Link",
    "Address",
  ];

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

  if (isLoading) {
    return (
      <div className="mt-12 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 flex flex-col items-center justify-center min-h-[200px]">
        <Loader2 className="h-10 w-10 text-emerald-500 animate-spin mb-4" />
        <p className="text-slate-600 text-lg font-medium">Loading attendance history...</p>
      </div>
    );
  }

  if (!attendanceData || attendanceData.length === 0) {
    return (
      <div className="mt-12 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 text-center text-slate-600 font-medium min-h-[200px] flex items-center justify-center">
        No attendance records found.
      </div>
    );
  }

  return (
    <div className="mt-12 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
      <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-6 py-6">
        <h3 className="text-2xl font-bold text-white mb-2">Attendance History</h3>
        <p className="text-blue-50 text-lg">
          {userRole === "Admin" ? "All records" : "Your records"} are displayed below.
        </p>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block p-4 overflow-x-auto">
        <div className="max-h-96 overflow-y-auto shadow-md rounded-md">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                {headers.map((header) => (
                  <th
                    key={header}
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {attendanceData.map((record, index) => (
                <tr key={index} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    {record.salesPersonName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                    {record.dateTime}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        record.status === "IN"
                          ? "bg-green-100 text-green-800"
                          : record.status === "OUT"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {record.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                    {record.mapLink && record.mapLink !== "#" ? (
                      <a
                        href={record.mapLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <MapPin className="w-4 h-4" /> View Map
                      </a>
                    ) : (
                      "N/A"
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-normal text-sm text-slate-700 max-w-xs overflow-hidden text-ellipsis">
                    {record.address || "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden p-4 space-y-4 max-h-96 overflow-y-auto">
        {attendanceData.map((record, index) => (
          <div key={index} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            {/* Header with Name and Status */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900 text-sm">
                    {record.salesPersonName}
                  </div>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(record.status)}`}
                  >
                    {record.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Date & Time */}
            <div className="flex items-center gap-2 mb-3 text-slate-600">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">{record.dateTime}</span>
            </div>

            {/* Location Information */}
            <div className="space-y-2">
              {record.mapLink && record.mapLink !== "#" ? (
                <a
                  href={record.mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 flex items-center gap-2 text-sm font-medium"
                >
                  <Navigation className="w-4 h-4" />
                  View Location on Map
                </a>
              ) : (
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <MapPin className="w-4 h-4" />
                  No location data
                </div>
              )}
              
              {record.address && record.address !== "N/A" && (
                <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2">
                  <div className="font-medium text-slate-600 mb-1">Address:</div>
                  {record.address}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Records Count
      <div className="border-t border-slate-200 bg-slate-50 px-6 py-3">
        <p className="text-sm text-slate-600">
          Showing {attendanceData.length} record{attendanceData.length !== 1 ? 's' : ''}
        </p>
      </div> */}
    </div>
  );
};

export default AttendanceHistory;