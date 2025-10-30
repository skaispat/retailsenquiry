"use client";

import { useState, useEffect, useContext } from "react";
import { MapPin, Loader2 } from "lucide-react";
import AttendanceHistory from "../components/AttendanceHistory";
import { AuthContext } from "../App";

const Attendance = () => {
  const [attendance, setAttendance] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [errors, setErrors] = useState({});
  const [locationData, setLocationData] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true); // New state for history loading

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("success"); // "success" or "error"
  const [modalMessage, setModalMessage] = useState("");

  const { currentUser, isAuthenticated } = useContext(AuthContext);

  const salesPersonName = currentUser?.salesPersonName || "Unknown User";
  const userRole = currentUser?.role || "User";

  const SPREADSHEET_ID = "15_ZUjQA-cSyFMt-70BxPBWVUZ185ioQzTqt5ElWXaZk"; // Your Tracker's Spreadsheet ID
  const APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycby8tWRO5JWFmJmDECvf85x8baVHqXNfePy-w_tpk0ZL3lrby_M2Z9jNoRvlLokFIQ8/exec";

  const formatDateInput = (date) => {
    return date.toISOString().split("T")[0];
  };

  const formatDateDDMMYYYY = (date) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatDateTime = (date) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  const formatDateDisplay = (date) => {
    return date.toLocaleDateString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const [formData, setFormData] = useState({
    status: "",
    startDate: formatDateInput(new Date()),
    endDate: "",
    reason: "",
  });

  /**
   * Shows centered modal popup with auto-hide functionality
   * @param {string} message - The message to display.
   * @param {'success' | 'error'} type - The type of modal (success or error).
   */
  const showToast = (message, type = "success") => {
    setModalMessage(message);
    setModalType(type);
    setShowModal(true);

    // Auto-hide after 3 seconds
    setTimeout(() => {
      setShowModal(false);
      setModalMessage("");
    }, 1000);
  };

  /**
   * Closes the modal popup manually
   */
  const closeModal = () => {
    setShowModal(false);
    setModalMessage("");
  };

  const getFormattedAddress = async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`
      );
      const data = await response.json();

      if (data && data.display_name) {
        return data.display_name;
      } else {
        return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      }
    } catch (error) {
      console.error("Error getting formatted address:", error);
      return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }
  };

  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by this browser."));
        return;
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      };

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;
          // Corrected mapLink format - ensure it's valid for Google Maps
          const mapLink = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

          const formattedAddress = await getFormattedAddress(
            latitude,
            longitude
          );

          const locationInfo = {
            latitude,
            longitude,
            mapLink,
            formattedAddress,
            timestamp: new Date().toISOString(),
            accuracy: position.coords.accuracy,
          };

          resolve(locationInfo);
        },
        (error) => {
          const errorMessages = {
            1: "Location permission denied. Please enable location services.",
            2: "Location information unavailable.",
            3: "Location request timed out.",
          };
          reject(
            new Error(errorMessages[error.code] || "An unknown error occurred.")
          );
        },
        options
      );
    });
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.status) newErrors.status = "Status is required";
    if (formData.status === "Leave") {
      if (!formData.startDate) newErrors.startDate = "Start date is required";
      if (
        formData.startDate &&
        formData.endDate &&
        new Date(formData.endDate + "T00:00:00") <
          new Date(formData.startDate + "T00:00:00")
      ) {
        newErrors.endDate = "End date cannot be before start date";
      }
      if (!formData.reason) newErrors.reason = "Reason is required for leave";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const fetchAttendanceHistory = async () => {
    if (!isAuthenticated || !currentUser) {
      console.log(
        "Not authenticated or currentUser not available. Skipping history fetch."
      );
      setIsLoadingHistory(false);
      return;
    }

    setIsLoadingHistory(true);
    try {
      const attendanceSheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=Attendance`;
      const response = await fetch(attendanceSheetUrl);
      const text = await response.text();

      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}") + 1;
      const jsonData = text.substring(jsonStart, jsonEnd);
      const data = JSON.parse(jsonData);

      if (!data?.table?.rows) {
        console.warn("No rows found in Attendance sheet.");
        setAttendance([]);
        setIsLoadingHistory(false);
        return;
      }

      const rows = data.table.rows;

      const formattedHistory = rows
        .map((row) => {
          const salesPerson = row.c?.[9]?.v; // Column J
          let dateTime = row.c?.[1]?.v; // Column B (This is the formatted date from Apps Script)
          let originalTimestamp = row.c?.[0]?.v; // Column A (Apps Script timestamp)

          // Fix: Parse Google Visualization Date string correctly from original timestamp (Column A)
          // This ensures the date parsing logic is consistent and avoids issues if Column B isn't
          // always a `Date(...)` string.
          if (
            typeof originalTimestamp === "string" &&
            originalTimestamp.startsWith("Date(") &&
            originalTimestamp.endsWith(")")
          ) {
            try {
              const dateParts = originalTimestamp
                .substring(5, originalTimestamp.length - 1)
                .split(",");
              const year = parseInt(dateParts[0], 10);
              const month = parseInt(dateParts[1], 10); // This month is 0-indexed (0=Jan, 6=Jul) from gviz
              const day = parseInt(dateParts[2], 10);
              const hour = dateParts[3] ? parseInt(dateParts[3], 10) : 0;
              const minute = dateParts[4] ? parseInt(dateParts[4], 10) : 0;
              const second = dateParts[5] ? parseInt(dateParts[5], 10) : 0;

              // Fix: Removed + 1 from month. Month is already 0-indexed by Google Sheets Date()
              const dateObj = new Date(year, month, day, hour, minute, second);
              dateTime = formatDateTime(dateObj); // Format for display
            } catch (e) {
              console.error(
                "Error parsing original timestamp date string:",
                originalTimestamp,
                e
              );
              // Fallback to raw value if parsing fails
              dateTime = originalTimestamp; // Use original string if parsing fails
            }
          }

          const status = row.c?.[3]?.v; // Column D
          const mapLink = row.c?.[7]?.v; // Column H
          const address = row.c?.[8]?.v; // Column I

          return {
            salesPersonName: salesPerson,
            dateTime: dateTime, // This is now the correctly formatted string for display
            status: status,
            mapLink: mapLink,
            address: address,
            _originalTimestamp: originalTimestamp, // Keep original for sorting if needed
          };
        })
        .filter(Boolean);

      const filteredHistory =
        userRole === "Admin"
          ? formattedHistory
          : formattedHistory.filter(
              (entry) => entry.salesPersonName === salesPersonName
            );

      filteredHistory.sort((a, b) => {
        // Parse the Gviz Date() string from _originalTimestamp for accurate sorting
        const parseGvizDate = (dateString) => {
          if (
            typeof dateString === "string" &&
            dateString.startsWith("Date(") &&
            dateString.endsWith(")")
          ) {
            const dateParts = dateString
              .substring(5, dateString.length - 1)
              .split(",");
            const year = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10);
            const day = parseInt(dateParts[2], 10);
            const hour = dateParts[3] ? parseInt(dateParts[3], 10) : 0;
            const minute = dateParts[4] ? parseInt(dateParts[4], 10) : 0;
            const second = dateParts[5] ? parseInt(dateParts[5], 10) : 0;
            return new Date(year, month, day, hour, minute, second);
          }
          return new Date(dateString); // Fallback for other formats
        };
        const dateA = parseGvizDate(a._originalTimestamp);
        const dateB = parseGvizDate(b._originalTimestamp);
        return dateB.getTime() - dateA.getTime();
      });

      setAttendance(filteredHistory);


      
      const filteredHistoryData = formattedHistory.filter(
        (entry) =>
          entry.salesPersonName === salesPersonName &&
        entry.dateTime?.split(" ")[0].toString() ===
        formatDateDDMMYYYY(new Date())
      );
      console.log("filteredHistoryData:", filteredHistoryData);

      filteredHistoryData.sort((a, b) => {
        // Parse the Gviz Date() string from _originalTimestamp for accurate sorting
        const parseGvizDate = (dateString) => {
          if (
            typeof dateString === "string" &&
            dateString.startsWith("Date(") &&
            dateString.endsWith(")")
          ) {
            const dateParts = dateString
              .substring(5, dateString.length - 1)
              .split(",");
            const year = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10);
            const day = parseInt(dateParts[2], 10);
            const hour = dateParts[3] ? parseInt(dateParts[3], 10) : 0;
            const minute = dateParts[4] ? parseInt(dateParts[4], 10) : 0;
            const second = dateParts[5] ? parseInt(dateParts[5], 10) : 0;
            return new Date(year, month, day, hour, minute, second);
          }
          return new Date(dateString); // Fallback for other formats
        };
        const dateA = parseGvizDate(a._originalTimestamp);
        const dateB = parseGvizDate(b._originalTimestamp);
        return dateB.getTime() - dateA.getTime();
      });

      setAttendanceData(filteredHistoryData);
    } catch (error) {
      console.error("Error fetching attendance history:", error);
      showToast("Failed to load attendance history.", "error");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchAttendanceHistory();
  }, [currentUser, isAuthenticated]); // Refetch when currentUser or isAuthenticated changes

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Submit button clicked!");

    if (!validateForm()) {
      showToast("Please fill in all required fields correctly.", "error");
      return;
    }

    if (!isAuthenticated || !currentUser || !salesPersonName) {
      showToast("User data not loaded. Please try logging in again.", "error");
      return;
    }
    

    console.log("attendanceData:", attendanceData);

    if (formData?.status === "IN") {
      const indata = attendanceData.filter((item) => item.status === "IN");
      if (indata.length > 0) {
        showToast("Today Already in", "error");
        return;
      }
    }

    // console.log("ram ram out",outData);
    if (formData?.status === "OUT") {
      // console.log("inData",inData)
      // console.log("outData",outData)

      const indata = attendanceData.filter((item) => item.status === "IN");
      const outdata = attendanceData.filter((item) => item.status === "OUT");
      if (indata.length === 0) {
        showToast("First In", "error");
        return;
      }

      // if((outData.dateTime?.split(' ')[0].toString() === formatDateDDMMYYYY(new Date()).toString())){
      //   showToast("Today Already out", "error");
      // return;
      // }
      if (outdata.length > 0) {
        showToast("Today Already out", "error");
        return;
      }
    }

    // --- FIX: Logic for 'OUT' status verification ---
    // if (formData.status === "OUT") {
    //   const today = new Date();
    //   const todayFormattedForComparison = formatDateDDMMYYYY(today); // e.g., "11/07/2025"

    //   const hasClockedInToday = attendance.some((record) => {
    //     // Extract the date part (DD/MM/YYYY) from the record's dateTime
    //     const recordDatePart = record.dateTime
    //       ? record.dateTime.split(" ")[0]
    //       : "";
    //     return (
    //       record.salesPersonName === salesPersonName &&
    //       record.status === "IN" &&
    //       recordDatePart === todayFormattedForComparison
    //     );
    //   });

    //   if (!hasClockedInToday) {
    //     showToast(
    //       "You must clock IN before you can clock OUT on the same day.",
    //       "error"
    //     );
    //     setIsSubmitting(false);
    //     setIsGettingLocation(false);
    //     return; // Prevent submission
    //   }
    // }
    // --- END 'OUT' STATUS VERIFICATION ---

    setIsSubmitting(true);
    setIsGettingLocation(true);

    try {
      let currentLocation = null;
      try {
        currentLocation = await getCurrentLocation();
        console.log("Location captured:", currentLocation);
      } catch (locationError) {
        console.error("Location error:", locationError);
        showToast(locationError.message, "error");
        setIsSubmitting(false);
        setIsGettingLocation(false);
        return;
      }

      setIsGettingLocation(false);

      const currentDate = new Date();
      const timestamp = formatDateTime(currentDate); // Full timestamp for Column A
      const dateForAttendance =
        formData.status === "IN" || formData.status === "OUT"
          ? formatDateTime(currentDate) // Full date and time for IN/OUT
          : formData.startDate
          ? formatDateDDMMYYYY(new Date(formData.startDate + "T00:00:00")) // DD/MM/YYYY for Leave start
          : "";

      const endDateForLeave = formData.endDate
        ? formatDateDDMMYYYY(new Date(formData.endDate + "T00:00:00")) // DD/MM/YYYY for Leave end
        : "";

      let rowData = Array(10).fill(""); // Columns A-J

      // FIX: Set Column A (Timestamp)
      rowData[0] = timestamp; // Column A - Timestamp (Current submission time)
      rowData[1] = dateForAttendance; // Column B - Date (or Start Date for Leave)
      rowData[3] = formData.status; // Column D - Status
      rowData[5] = currentLocation.latitude; // Column F - Latitude
      rowData[6] = currentLocation.longitude; // Column G - Longitude
      rowData[7] = currentLocation.mapLink; // Column H - Map Link
      rowData[8] = currentLocation.formattedAddress; // Column I - Address
      rowData[9] = salesPersonName; // Column J - Sales Person Name (from AuthContext)

      if (formData.status === "Leave") {
        rowData[4] = formData.reason; // Column E for Reason
        rowData[2] = endDateForLeave; // Column C for End Date
      }

      console.log("Row data to be submitted:", rowData);

      const payload = {
        sheetName: "Attendance",
        action: "insert",
        rowData: JSON.stringify(rowData),
      };

      const urlEncodedData = new URLSearchParams(payload);

      const response = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: urlEncodedData,
        // mode: "no-cors",
      });

      showToast(`Your ${formData.status} has been recorded successfully!`);

      // After successful submission, refetch history to update the list
      await fetchAttendanceHistory();

      setFormData({
        status: "",
        startDate: formatDateInput(new Date()),
        endDate: "",
        reason: "",
      });
    } catch (error) {
      console.error("Submission error:", error);
      showToast(
        `Error recording data: ${error.message || "Unknown error"}`,
        "error"
      );
    } finally {
      setIsSubmitting(false);
      setIsGettingLocation(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const showLeaveFields = formData.status === "Leave";

  if (!isAuthenticated || !currentUser || !currentUser.salesPersonName) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">
            {!isAuthenticated
              ? "Please log in to view this page."
              : "Loading user data..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-0 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-8 py-6">
            <h3 className="text-2xl font-bold text-white mb-2">
              Mark Attendance
            </h3>
            <p className="text-emerald-50 text-lg">
              Record your daily attendance or apply for leave
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8 p-8">
            <div className="grid gap-6 lg:grid-cols-1">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 text-slate-700 font-medium"
                >
                  <option value="">Select status</option>
                  <option value="IN">IN</option>
                  <option value="OUT">OUT</option>
                  <option value="Leave">Leave</option>
                </select>
                {errors.status && (
                  <p className="text-red-500 text-sm mt-2 font-medium">
                    {errors.status}
                  </p>
                )}
              </div>
            </div>

            {!showLeaveFields && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-100">
                <div className="text-sm font-semibold text-emerald-700 mb-2">
                  Current Date & Time
                </div>
                <div className="text-sm sm:text-2xl font-bold text-emerald-800">
                  {formatDateDisplay(new Date())}
                </div>
                {(formData.status === "IN" || formData.status === "OUT") && (
                  <div className="mt-3 text-sm text-emerald-600">
                    📍 Location will be automatically captured when you submit
                  </div>
                )}
              </div>
            )}

            {showLeaveFields && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-0 sm:p-6 border border-amber-100 mb-6">
                <div className="text-sm font-semibold text-amber-700 mb-2">
                  Leave Application
                </div>
                <div className="text-lg font-bold text-amber-800">
                  {formatDateDisplay(new Date())}
                </div>
                <div className="mt-3 text-sm text-amber-600">
                  📍 Current location will be captured for leave application
                </div>
              </div>
            )}

            {showLeaveFields && (
              <div className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      Start Date
                    </label>
                    <input
                      type="date"
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 text-slate-700 font-medium"
                    />
                    {errors.startDate && (
                      <p className="text-red-500 text-sm mt-2 font-medium">
                        {errors.startDate}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      End Date
                    </label>
                    <input
                      type="date"
                      name="endDate"
                      value={formData.endDate}
                      onChange={handleInputChange}
                      min={formData.startDate}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 text-slate-700 font-medium"
                    />
                    {errors.endDate && (
                      <p className="text-red-500 text-sm mt-2 font-medium">
                        {errors.endDate}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Reason
                  </label>
                  <textarea
                    name="reason"
                    value={formData.reason}
                    onChange={handleInputChange}
                    placeholder="Enter reason for leave"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-200 text-slate-700 font-medium min-h-32 resize-none"
                  />
                  {errors.reason && (
                    <p className="text-red-500 text-sm mt-2 font-medium">
                      {errors.reason}
                    </p>
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full lg:w-auto bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-700 hover:via-teal-700 hover:to-cyan-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              disabled={
                isSubmitting ||
                isGettingLocation ||
                !currentUser?.salesPersonName
              }
            >
              {isGettingLocation ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Getting Location...
                </span>
              ) : isSubmitting ? (
                showLeaveFields ? (
                  "Submitting Leave..."
                ) : (
                  "Marking Attendance..."
                )
              ) : showLeaveFields ? (
                "Submit Leave Request"
              ) : (
                "Mark Attendance"
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Centered Modal Popup - Light transparent background */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-10 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 scale-100">
            <div className="p-8 text-center">
              {/* Icon */}
              <div className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center">
                {modalType === "success" ? (
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="3"
                          d="M5 13l4 4L19 7"
                        ></path>
                      </svg>
                    </div>
                  </div>
                ) : (
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                    <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="3"
                          d="M6 18L18 6M6 6l12 12"
                        ></path>
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* Title */}
              <h2
                className={`text-2xl font-bold mb-4 ${
                  modalType === "success" ? "text-green-600" : "text-red-600"
                }`}
              >
                {modalType === "success" ? "Success!" : "Error!"}
              </h2>

              {/* Message */}
              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                {modalMessage}
              </p>

              {/* OK Button */}
              <button
                onClick={closeModal}
                className={`px-8 py-3 rounded-xl font-semibold text-white transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-4 ${
                  modalType === "success"
                    ? "bg-green-500 hover:bg-green-600 focus:ring-green-300"
                    : "bg-red-500 hover:bg-red-600 focus:ring-red-300"
                }`}
              >
                Ok
              </button>
            </div>
          </div>
        </div>
      )}

      <AttendanceHistory
        attendanceData={attendance}
        isLoading={isLoadingHistory}
        userRole={userRole}
      />
    </div>
  );
};

export default Attendance;
