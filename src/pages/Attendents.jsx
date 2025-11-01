"use client";

import { useState, useEffect, useContext } from "react";
import { MapPin, Loader2 } from "lucide-react";
import AttendanceHistory from "../components/AttendanceHistory";
import { AuthContext } from "../App";
import supabase from "../SupaabseClient";

const Attendance = () => {
  const [attendance, setAttendance] = useState([]);
  const [attendanceData, setAttendanceData] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [errors, setErrors] = useState({});
  const [locationData, setLocationData] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("success");
  const [modalMessage, setModalMessage] = useState("");

  const { currentUser, isAuthenticated } = useContext(AuthContext);

  const salesPersonName = currentUser?.salesPersonName || "Unknown User";
  const userRole = currentUser?.role || "User";

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
   */
  const showToast = (message, type = "success") => {
    setModalMessage(message);
    setModalType(type);
    setShowModal(true);

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
          const mapLink = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

          const formattedAddress = await getFormattedAddress(
            latitude,
            longitude
          );

          const locationInfo = {
            latitude: latitude.toString(),
            longitude: longitude.toString(),
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

  // Fetch attendance history from Supabase
  const fetchAttendanceHistory = async () => {
    if (!isAuthenticated || !currentUser) {
      console.log("Not authenticated or currentUser not available. Skipping history fetch.");
      setIsLoadingHistory(false);
      return;
    }

    setIsLoadingHistory(true);
    try {
      // Fetch all attendance records
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .order('date_and_time', { ascending: false });

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      console.log("✅ Attendance data loaded successfully from Supabase");

      // Format the data for display
      const formattedHistory = data.map((item) => {
        return {
          salesPersonName: item.sales_person_name,
          dateTime: formatDateTime(new Date(item.date_and_time)),
          status: item.status,
          mapLink: item.map_link || "#",
          address: item.address || "Location not available",
          _originalTimestamp: item.date_and_time,
          reason: item.reason || "",
          start_date: item.start_date ? formatDateTime(new Date(item.start_date)) : "",
          end_date: item.end_date ? formatDateTime(new Date(item.end_date)) : "",
        };
      });

      // Filter based on user role
      const filteredHistory =
        userRole === "Admin"
          ? formattedHistory
          : formattedHistory.filter(
              (entry) => entry.salesPersonName === salesPersonName
            );

      setAttendance(filteredHistory);

      // Filter for today's attendance data
      const today = formatDateDDMMYYYY(new Date());
      const filteredHistoryData = formattedHistory.filter(
        (entry) =>
          entry.salesPersonName === salesPersonName &&
          entry.dateTime?.split(" ")[0].toString() === today
      );

      console.log("Today's attendance data:", filteredHistoryData);
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
  }, [currentUser, isAuthenticated]);

  // Submit attendance to Supabase
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

    console.log("Today's attendance data:", attendanceData);

    // Check for duplicate IN/OUT entries for today
    if (formData?.status === "IN") {
      const indata = attendanceData.filter((item) => item.status === "IN");
      if (indata.length > 0) {
        showToast("Already marked IN for today", "error");
        return;
      }
    }

    if (formData?.status === "OUT") {
      const indata = attendanceData.filter((item) => item.status === "IN");
      const outdata = attendanceData.filter((item) => item.status === "OUT");
      if (indata.length === 0) {
        showToast("Please mark IN first before marking OUT", "error");
        return;
      }
      if (outdata.length > 0) {
        showToast("Already marked OUT for today", "error");
        return;
      }
    }

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
      
      // Prepare data for Supabase according to your schema
      const attendanceRecord = {
        date_and_time: currentDate.toISOString(),
        sales_person_name: salesPersonName,
        status: formData.status,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        map_link: currentLocation.mapLink,
        address: currentLocation.formattedAddress,
      };

      // Add leave-specific fields if applicable
      if (formData.status === "Leave") {
        attendanceRecord.start_date = new Date(formData.startDate + "T00:00:00").toISOString();
        attendanceRecord.end_date = formData.endDate ? new Date(formData.endDate + "T00:00:00").toISOString() : null;
        attendanceRecord.reason = formData.reason;
      }

      console.log("Attendance record to be submitted:", attendanceRecord);

      // Insert into Supabase
      const { data, error } = await supabase
        .from('attendance')
        .insert([attendanceRecord])
        .select();

      if (error) {
        throw new Error(`Supabase insert error: ${error.message}`);
      }

      showToast(`Your ${formData.status} has been recorded successfully!`);

      // After successful submission, refetch history to update the list
      await fetchAttendanceHistory();

      // Reset form
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
            <p className="text-orange-100 text-sm mt-2">
              Current User: <span className="font-semibold">{salesPersonName}</span> (Role: <span className="font-semibold">{userRole}</span>)
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

      {/* Centered Modal Popup */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-10 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 scale-100">
            <div className="p-8 text-center">
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

              <h2
                className={`text-2xl font-bold mb-4 ${
                  modalType === "success" ? "text-green-600" : "text-red-600"
                }`}
              >
                {modalType === "success" ? "Success!" : "Error!"}
              </h2>

              <p className="text-gray-600 text-lg mb-8 leading-relaxed">
                {modalMessage}
              </p>

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