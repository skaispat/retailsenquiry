import React from "react";
import { Loader2, MapPin } from "lucide-react";

const AttendanceHistory = ({ attendanceData, isLoading, userRole }) => {
  const headers = [
    "Name", // Changed from "Sales Person Name" to "Name"
    "Date & Time",
    "Status",
    "Map Link",
    "Address",
  ];

  // FIX: Removed the formatDateTime helper from here.
  // The dateTime prop passed from Attendance.js is already formatted correctly.

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
      <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-8 py-6">
        <h3 className="text-2xl font-bold text-white mb-2">Attendance History</h3>
        <p className="text-blue-50 text-lg">
          {userRole === "Admin" ? "All records" : "Your records"} are displayed below.
        </p>
      </div>

      <div className="p-4 overflow-x-auto">
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
                    {/* FIX: Directly display record.dateTime as it's already formatted */}
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
                    {record.mapLink ? (
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
    </div>
  );
};

export default AttendanceHistory;