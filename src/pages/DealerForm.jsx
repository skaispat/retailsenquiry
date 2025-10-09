"use client";

import { useState, useEffect, useContext, useRef } from "react"; // Added useRef
import { format } from "date-fns";
import { AuthContext } from "../App"; // Assuming App.js or similar defines it

function DealerForm() {
  const [formData, setFormData] = useState({
    stateName: "",
    districtName: "",
    salesPersonName: "",
    dealerName: "",
    aboutDealer: "",
    address: "",
    dealerSize: "",
    avgQty: "",
    contactNumber: "",
    emailAddress: "",
    dob: "", // Date of Birth
    anniversary: "", // Anniversary Date
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("success");
  const [modalMessage, setModalMessage] = useState("");

  const [fetchedDealerSizes, setFetchedDealerSizes] = useState([]);
  const [isLoadingDealerSizes, setIsLoadingDealerSizes] = useState(true);
  const [errorDealerSizes, setErrorDealerSizes] = useState(null);

  // New state for sales person data
  const [fetchedSalesPersons, setFetchedSalesPersons] = useState([]);
  const [isLoadingSalesPersons, setIsLoadingSalesPersons] = useState(true);
  const [errorSalesPersons, setErrorSalesPersons] = useState(null);

  const [entityType, setEntityType] = useState("");

  // State for custom sales person dropdown
  const [isSalesPersonDropdownOpen, setIsSalesPersonDropdownOpen] =
    useState(false);
  const salesPersonDropdownRef = useRef(null); // Ref for clicking outside

  // Access currentUser and userRole from AuthContext
  const { currentUser, isAuthenticated } = useContext(AuthContext);
  const userRole = currentUser?.role || "User"; // Default to "User" if not available

  const SPREADSHEET_ID_FOR_DEALER_SIZES =
    "15_ZUjQA-cSyFMt-70BxPBWVUZ185ioQzTqt5ElWXaZk";
  const APPS_SCRIPT_URL_FOR_SUBMISSION =
    "https://script.google.com/macros/s/AKfycby8tWRO5JWFmJmDECvf85x8baVHqXNfePy-w_tpk0ZL3lrby_M2Z9jNoRvlLokFIQ8/exec";

  const DEFAULT_DEALER_SIZES = ["Small", "Medium", "Large"];

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
    }, 2000);
  };

  /**
   * Closes the modal popup manually
   */
  const closeModal = () => {
    setShowModal(false);
    setModalMessage("");
  };

  /**
   * Fetches master data for dealer sizes from the specified Google Sheet.
   * This data is used to populate the 'Dealer Size' dropdown.
   */
  const fetchMasterDataForDealerSizes = async () => {
    setIsLoadingDealerSizes(true);
    setErrorDealerSizes(null);
    try {
      const MASTER_SHEET_NAME = "Master"; // Sheet name
      // Query to select column A (Dealer Size). We will filter header and malformed data on client-side.
      const tq = encodeURIComponent("select A where A is not null");

      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID_FOR_DEALER_SIZES}/gviz/tq?tqx=out:json&tq=${tq}&sheet=${MASTER_SHEET_NAME}`;

      const response = await fetch(url);

      if (!response.ok)
        throw new Error(
          `Failed to fetch MASTER data: HTTP Status ${response.status}`
        );
      const text = await response.text();

      // Extract JSON part from the Google Visualization API response
      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");
      const data = JSON.parse(text.substring(jsonStart, jsonEnd + 1));

      let dealerSizes = [];
      if (data.table?.rows?.length > 0) {
        dealerSizes = data.table.rows
          .map((row) => {
            const cell = row.c[0]; // A is the first column in the query result
            // Ensure it's a string, trim, and then filter out known header or date patterns
            const value = cell && cell.v !== null ? String(cell.v).trim() : "";
            return value;
          })
          .filter((size) => {
            // Robustly filter out empty strings, the header, and any date-like strings
            const lowerCaseSize = size.toLowerCase();
            return (
              size &&
              !["dealer size", "dealersize", "size"].includes(lowerCaseSize) && // Filter out header text variations
              !lowerCaseSize.startsWith("date(")
            ); // Filter out "Date(year,month,day,...)" strings
          });
      }

      const uniqueDealerSizes = Array.from(new Set(dealerSizes)); // Ensure unique sizes
      setFetchedDealerSizes(
        uniqueDealerSizes.length > 0 ? uniqueDealerSizes : DEFAULT_DEALER_SIZES
      );
    } catch (err) {
      console.error(`Error fetching MASTER data for dealer sizes:`, err);
      setErrorDealerSizes(`Failed to load dealer sizes: ${err.message}`);
      // Fallback to default dealer sizes on error
      setFetchedDealerSizes(DEFAULT_DEALER_SIZES);
    } finally {
      setIsLoadingDealerSizes(false);
    }
  };

  const fetchSalesPersons = async () => {
    setIsLoadingSalesPersons(true);
    setErrorSalesPersons(null);
    try {
      const MASTER_SHEET_GID = "1319416673"; // GID for the master sheet
      // Query to select column G. We will filter header and malformed data on client-side.
      const tq = encodeURIComponent("select G where G is not null"); // Removed offset 1 as it was unreliable

      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID_FOR_DEALER_SIZES}/gviz/tq?tqx=out:json&tq=${tq}&gid=${MASTER_SHEET_GID}`;

      const response = await fetch(url);

      if (!response.ok)
        throw new Error(
          `Failed to fetch sales persons data: HTTP Status ${response.status}`
        );
      const text = await response.text();

      // Extract JSON part from the Google Visualization API response
      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");
      const data = JSON.parse(text.substring(jsonStart, jsonEnd + 1));

      let salesPersons = [];
      if (data.table?.rows?.length > 0) {
        salesPersons = data.table.rows
          .map((row) => {
            const cell = row.c[0]; // G is the first column in the query result
            // Ensure it's a string, trim, and then filter out known header or date patterns
            const value = cell && cell.v !== null ? String(cell.v).trim() : "";
            return value;
          })
          .filter((name) => {
            // Robustly filter out empty strings, the header, and any date-like strings
            const lowerCaseName = name.toLowerCase();
            return (
              name &&
              lowerCaseName !== "salesperson name" && // Filter out specific header text
              !lowerCaseName.startsWith("date(")
            ); // Filter out "Date(year,month,day,...)" strings
          });
      }
      setFetchedSalesPersons(Array.from(new Set(salesPersons))); // Ensure unique names
    } catch (err) {
      console.error(`Error fetching sales persons data:`, err);
      setErrorSalesPersons(`Failed to load sales persons: ${err.message}`);
      setFetchedSalesPersons([]); // Clear any previous data on error
    } finally {
      setIsLoadingSalesPersons(false);
    }
  };

  // useEffect hook to fetch initial data and set up auto-fill/dropdown
  useEffect(() => {
    fetchMasterDataForDealerSizes();

    if (isAuthenticated) {
      if (userRole === "User" && currentUser?.salesPersonName) {
        // Auto-fill for 'User' role
        setFormData((prev) => ({
          ...prev,
          salesPersonName: currentUser.salesPersonName,
        }));
      } else if (userRole === "Admin") {
        // Fetch sales persons for 'Admin' role dropdown
        fetchSalesPersons();
      }
    }
  }, [isAuthenticated, userRole, currentUser]); // Dependencies for re-running effect

  // Effect for handling clicks outside the custom sales person dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        salesPersonDropdownRef.current &&
        !salesPersonDropdownRef.current.contains(event.target)
      ) {
        setIsSalesPersonDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [salesPersonDropdownRef]);

  /**
   * Handles changes to form input fields.
   * @param {Event} e - The change event object.
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for the field if it was previously set
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  /**
   * Handles selection from the custom sales person dropdown.
   * @param {string} name - The selected sales person name.
   */
  const handleSalesPersonSelect = (name) => {
    setFormData((prev) => ({
      ...prev,
      salesPersonName: name,
    }));
    setIsSalesPersonDropdownOpen(false); // Close dropdown after selection
    if (errors.salesPersonName) {
      setErrors((prev) => ({
        ...prev,
        salesPersonName: "",
      }));
    }
  };

  /**
   * Validates the form data before submission.
   * Only validates Dealer Name and Contact Number as required fields.
   * @returns {boolean} - True if the form is valid, false otherwise.
   */
  const validateForm = () => {
    const newErrors = {};

    // Only validate Dealer Name and Contact Number as required fields
    if (!formData.dealerName.trim() || formData.dealerName.length < 2) {
      newErrors.dealerName = "Dealer name must be at least 2 characters";
    }
    if (!formData.contactNumber.trim() || formData.contactNumber.length < 10) {
      newErrors.contactNumber = "Contact number must be at least 10 digits";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Submits the form data to Google Sheets via Google Apps Script.
   * @param {string} sheetName - The name of the target sheet.
   * @param {Array<string>} rowData - An array of data to be inserted as a row.
   * @returns {Promise<Object>} - The result of the submission.
   */
  const submitToGoogleSheets = async (sheetName, rowData) => {
    try {
      const formDataToSend = new FormData();
      formDataToSend.append("sheetName", sheetName);
      formDataToSend.append("action", "insertWithDealerCode");
      formDataToSend.append("rowData", JSON.stringify(rowData));

      const response = await fetch(APPS_SCRIPT_URL_FOR_SUBMISSION, {
        method: "POST",
        body: formDataToSend,
        mode: "no-cors", // Use 'no-cors' for Google Apps Script to avoid CORS issues
      });

      console.log("response from fetch:", response);

      // In 'no-cors' mode, response.ok is always true and response.json() is not available.
      // We assume success if the request was sent without network errors.
      if (response.type === "opaque") {
        console.log("Request sent with no-cors mode. Assuming success.");
        return { success: true };
      }

      // If not opaque, try to parse JSON (e.g., if CORS is configured or for debugging)
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || "Failed to submit to Google Sheets");
      }
      return result;
    } catch (error) {
      console.error("Google Sheets submission error:", error);
      throw error;
    }
  };

  /**
   * Handles the form submission.
   * @param {Event} e - The form submission event object.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      showToast("Please correct the errors in the form.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      // Format timestamp, DOB, and Anniversary dates
      const timestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss");
      const formattedDob = formData.dob
        ? format(new Date(formData.dob), "yyyy-MM-dd")
        : "";
      const formattedAnniversary = formData.anniversary
        ? format(new Date(formData.anniversary), "yyyy-MM-dd")
        : "";

      // IMPORTANT: Keep original column structure - dealer code column (B) will be empty
      const rowData = [
        timestamp, // Column A
        "", // Column B - Empty dealer code to maintain column structure
        formData.stateName, // Column C
        formData.districtName, // Column D
        formData.salesPersonName, // Column E
        formData.dealerName, // Column F
        formData.aboutDealer, // Column G
        formData.address, // Column H
        formData.dealerSize, // Column I
        formData.avgQty, // Column J
        formData.contactNumber, // Column K
        formData.emailAddress, // Column L
        formattedDob, // Column M
        formattedAnniversary, // Column N

        ...Array(19).fill(""),
        entityType,
      ];

      const targetSheetName = "FMS"; // Target sheet name

      console.log("Submitting data to Google Sheet:", rowData);
      await submitToGoogleSheets(targetSheetName, rowData);

      showToast("Dealer registered successfully!");

      // Reset form data after successful submission
      setFormData({
        stateName: "",
        districtName: "",
        // Keep salesPersonName auto-filled if user is 'User'
        salesPersonName:
          userRole === "User" && currentUser?.salesPersonName
            ? currentUser.salesPersonName
            : "",
        dealerName: "",
        aboutDealer: "",
        address: "",
        dealerSize: "",
        avgQty: "",
        contactNumber: "",
        emailAddress: "",
        dob: "",
        anniversary: "",
      });
      setErrors({}); // Clear validation errors
    } catch (error) {
      console.error("Submission error:", error);
      showToast(`Error submitting form: ${error.message}`, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-blue-50 p-0 lg:p-8 font-inter">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Main Form Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-8 py-6 flex justify-between">
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Dealer Information
              </h3>
              <p className="text-purple-50 text-lg">
                Fill in the details about the dealer and sales person
              </p>
            </div>

            <div className="max-w-xs">
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-white/20 rounded-xl shadow-sm focus:ring-2 focus:ring-white/50 focus:border-white/50 transition-all duration-200 text-slate-700 font-medium"
              >
                <option value="">Select Type</option>
                <option value="Dealer">Dealer</option>
                <option value="Distributor">Distributor</option>
                <option value="Site/Engineer">Site/Engineer</option>
              </select>
            </div>
          </div>
          <div className=" p-2 lg:p-8">
            {entityType && (
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Location Information */}
                <div className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-3">
                        State Name
                      </label>
                      <input
                        type="text"
                        name="stateName"
                        value={formData.stateName}
                        onChange={handleInputChange}
                        placeholder="Enter state name"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                      />
                      {errors.stateName && (
                        <p className="text-red-500 text-sm mt-2 font-medium">
                          {errors.stateName}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-3">
                        District Name
                      </label>
                      <input
                        type="text"
                        name="districtName"
                        value={formData.districtName}
                        onChange={handleInputChange}
                        placeholder="Enter district name"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                      />
                      {errors.districtName && (
                        <p className="text-red-500 text-sm mt-2 font-medium">
                          {errors.districtName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Personal Information */}
                <div className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-3">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-3">
                        Sales Person Name
                      </label>
                      {userRole === "Admin" ? (
                        <div className="relative" ref={salesPersonDropdownRef}>
                          <button
                            type="button"
                            onClick={() =>
                              setIsSalesPersonDropdownOpen(
                                !isSalesPersonDropdownOpen
                              )
                            }
                            className={`w-full px-4 py-3 text-left bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium flex justify-between items-center ${
                              isLoadingSalesPersons
                                ? "opacity-70 cursor-not-allowed"
                                : ""
                            }`}
                            disabled={isLoadingSalesPersons}
                          >
                            {formData.salesPersonName || "Select Sales Person"}
                            <svg
                              className={`w-4 h-4 ml-2 transition-transform ${
                                isSalesPersonDropdownOpen ? "rotate-180" : ""
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M19 9l-7 7-7-7"
                              ></path>
                            </svg>
                          </button>
                          {isSalesPersonDropdownOpen && (
                            <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                              {isLoadingSalesPersons ? (
                                <div className="px-4 py-2 text-slate-500">
                                  Loading sales persons...
                                </div>
                              ) : errorSalesPersons ? (
                                <div className="px-4 py-2 text-red-500">
                                  {errorSalesPersons}
                                </div>
                              ) : fetchedSalesPersons.length === 0 ? (
                                <div className="px-4 py-2 text-slate-500">
                                  No sales persons found.
                                </div>
                              ) : (
                                <ul>
                                  {fetchedSalesPersons.map((person) => (
                                    <li
                                      key={person}
                                      onClick={() =>
                                        handleSalesPersonSelect(person)
                                      }
                                      className="px-4 py-3 cursor-pointer hover:bg-slate-100 text-slate-700 font-medium"
                                    >
                                      {person}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <input
                          type="text"
                          name="salesPersonName"
                          value={formData.salesPersonName}
                          onChange={handleInputChange}
                          placeholder="Enter sales person name"
                          readOnly={userRole === "User"}
                          className={`w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium ${
                            userRole === "User"
                              ? "bg-gray-50 cursor-not-allowed"
                              : ""
                          }`}
                        />
                      )}
                      {errors.salesPersonName && (
                        <p className="text-red-500 text-sm mt-2 font-medium">
                          {errors.salesPersonName}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-3">
                        **{entityType} Name
                      </label>
                      <input
                        type="text"
                        name="dealerName"
                        value={formData.dealerName}
                        onChange={handleInputChange}
                        placeholder="Enter dealer name"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                      />
                      {errors.dealerName && (
                        <p className="text-red-500 text-sm mt-2 font-medium">
                          {errors.dealerName}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-3">
                        **Contact Number
                      </label>
                      <input
                        type="tel"
                        name="contactNumber"
                        value={formData.contactNumber}
                        onChange={handleInputChange}
                        placeholder="Enter contact number"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                      />
                      {errors.contactNumber && (
                        <p className="text-red-500 text-sm mt-2 font-medium">
                          {errors.contactNumber}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-6 md:grid-cols-3">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-3">
                        Email Address
                      </label>
                      <input
                        type="email"
                        name="emailAddress"
                        value={formData.emailAddress}
                        onChange={handleInputChange}
                        placeholder="Enter Email Address"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                      />
                      {errors.emailAddress && (
                        <p className="text-red-500 text-sm mt-2 font-medium">
                          {errors.emailAddress}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-3">
                        Date Of Birth
                      </label>
                      <input
                        type="date"
                        name="dob"
                        value={formData.dob}
                        onChange={handleInputChange}
                        placeholder="Date Of Birth"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                      />
                      {errors.dob && (
                        <p className="text-red-500 text-sm mt-2 font-medium">
                          {errors.dob}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-3">
                        Anniversary
                      </label>
                      <input
                        type="date"
                        name="anniversary"
                        value={formData.anniversary}
                        onChange={handleInputChange}
                        placeholder="Anniversary Date"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                      />
                      {errors.anniversary && (
                        <p className="text-red-500 text-sm mt-2 font-medium">
                          {errors.anniversary}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Business Information */}
                <div className="space-y-6">
                  <div className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-3">
                          About {entityType}
                        </label>
                        <textarea
                          name="aboutDealer"
                          value={formData.aboutDealer}
                          onChange={handleInputChange}
                          placeholder="Enter information about the dealer"
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium min-h-24 resize-none"
                        />
                        {errors.aboutDealer && (
                          <p className="text-red-500 text-sm mt-2 font-medium">
                            {errors.aboutDealer}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-3">
                          Address
                        </label>
                        <textarea
                          name="address"
                          value={formData.address}
                          onChange={handleInputChange}
                          placeholder="Enter dealer address"
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium min-h-24 resize-none"
                        />
                        {errors.address && (
                          <p className="text-red-500 text-sm mt-2 font-medium">
                            {errors.address}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-3">
                          {entityType} Size
                        </label>
                        <select
                          name="dealerSize"
                          value={formData.dealerSize}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                          disabled={isLoadingDealerSizes}
                        >
                          <option value="">
                            {isLoadingDealerSizes
                              ? "Loading dealer sizes..."
                              : "Select dealer size"}
                          </option>
                          {fetchedDealerSizes.map((size) => (
                            <option key={size} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                        {errors.dealerSize && (
                          <p className="text-red-500 text-sm mt-2 font-medium">
                            {errors.dealerSize}
                          </p>
                        )}
                        {errorDealerSizes && (
                          <p className="text-red-500 text-sm mt-2 font-medium">
                            {errorDealerSizes}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-3">
                          Average Quantity
                        </label>
                        <input
                          type="number"
                          name="avgQty"
                          value={formData.avgQty}
                          onChange={handleInputChange}
                          placeholder="Enter average quantity"
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                        />
                        {errors.avgQty && (
                          <p className="text-red-500 text-sm mt-2 font-medium">
                            {errors.avgQty}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="pt-6 border-t border-slate-200">
                  <button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      (userRole === "Admin" && isLoadingSalesPersons) ||
                      isLoadingDealerSizes
                    }
                    className={`w-full lg:w-auto bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 hover:from-purple-700 hover:via-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] ${
                      isSubmitting ||
                      (userRole === "Admin" && isLoadingSalesPersons) ||
                      isLoadingDealerSizes
                        ? "opacity-50 cursor-not-allowed"
                        : ""
                    }`}
                  >
                    {isSubmitting ? "Registering Dealer..." : "Register Dealer"}
                  </button>
                </div>
              </form>
            )}

            {!entityType && (
              <div className="text-center py-12">
                <p className="text-slate-500 text-lg">
                  Please select a type from the dropdown above to continue
                </p>
              </div>
            )}
          </div>
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
    </div>
  );
}

export default DealerForm;
