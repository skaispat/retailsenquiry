
"use client"

import { useState, useEffect, useContext, useRef } from "react" // Added useRef
import { format } from "date-fns"
import { AuthContext } from "../App" // Assuming App.js or similar defines it

function DealerForm() {
  const [formData, setFormData] = useState({
    dealerCode: "",
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
  })
  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [fetchedDealerSizes, setFetchedDealerSizes] = useState([])
  const [isLoadingDealerSizes, setIsLoadingDealerSizes] = useState(true)
  const [errorDealerSizes, setErrorDealerSizes] = useState(null)

  // New state for sales person data
  const [fetchedSalesPersons, setFetchedSalesPersons] = useState([])
  const [isLoadingSalesPersons, setIsLoadingSalesPersons] = useState(true)
  const [errorSalesPersons, setErrorSalesPersons] = useState(null)

  // New state for dealer code generation
  const [isLoadingDealerCode, setIsLoadingDealerCode] = useState(true)
  const [errorDealerCode, setErrorDealerCode] = useState(null)

  // State for custom sales person dropdown
  const [isSalesPersonDropdownOpen, setIsSalesPersonDropdownOpen] = useState(false)
  const salesPersonDropdownRef = useRef(null) // Ref for clicking outside

  // Access currentUser and userRole from AuthContext
  const { currentUser, isAuthenticated } = useContext(AuthContext)
  const userRole = currentUser?.role || "User" // Default to "User" if not available

  const SPREADSHEET_ID_FOR_DEALER_SIZES = "15_ZUjQA-cSyFMt-70BxPBWVUZ185ioQzTqt5ElWXaZk"
  const APPS_SCRIPT_URL_FOR_SUBMISSION =
    "https://script.google.com/macros/s/AKfycby8tWRO5JWFmJmDECvf85x8baVHqXNfePy-w_tpk0ZL3lrby_M2Z9jNoRvlLokFIQ8/exec"

  /**
   * Displays a toast notification.
   * @param {string} message - The message to display.
   * @param {'success' | 'error'} type - The type of toast (success or error).
   */
  const showToast = (message, type = "success") => {
    const toast = document.createElement("div")
    toast.className = `fixed top-4 right-4 p-4 rounded-md text-white z-50 ${
      type === "success" ? "bg-green-500" : "bg-red-500"
    }`
    toast.textContent = message
    document.body.appendChild(toast)
    setTimeout(() => document.body.removeChild(toast), 3000)
  }

  /**
   * Fetches master data for dealer sizes from the specified Google Sheet.
   * This data is used to populate the 'Dealer Size' dropdown.
   */
  const fetchMasterDataForDealerSizes = async () => {
    setIsLoadingDealerSizes(true)
    setErrorDealerSizes(null)
    try {
      const GID = "1319416673" // GID for the sheet containing dealer sizes
      const response = await fetch(
        `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID_FOR_DEALER_SIZES}/gviz/tq?tqx=out:json&gid=${GID}`,
      )

      if (!response.ok) throw new Error(`Failed to fetch MASTER data: HTTP Status ${response.status}`)
      const text = await response.text()

      // Extract JSON part from the Google Visualization API response
      const jsonStart = text.indexOf("{")
      const jsonEnd = text.lastIndexOf("}")
      const data = JSON.parse(text.substring(jsonStart, jsonEnd + 1))

      let masterItems = []
      // Skip header row (if any)
      if (data.table.rows.length > 1) {
        masterItems = data.table.rows.slice(1).map((row) => {
          const itemObj = {}
          row.c.forEach((cell, i) => {
            itemObj[`col${i}`] = cell && cell.v !== null ? cell.v : ""
          })
          return itemObj
        })
      }

      const sizes = new Set()
      masterItems.forEach((item) => {
        // Assuming dealer sizes are in the first column (col0)
        if (item.col0) {
          sizes.add(item.col0)
        }
      })
      setFetchedDealerSizes(Array.from(sizes))
    } catch (err) {
      console.error(`Error fetching MASTER data for dealer sizes:`, err)
      setErrorDealerSizes(`Failed to load dealer sizes: ${err.message}`)
    } finally {
      setIsLoadingDealerSizes(false)
    }
  }

  /**
   * Fetches sales person names from Column G of the master Google Sheet.
   * This data is used to populate the 'Sales Person Name' dropdown for Admin users.
   */
  const fetchSalesPersons = async () => {
    setIsLoadingSalesPersons(true)
    setErrorSalesPersons(null)
    try {
      const MASTER_SHEET_GID = "1319416673" // GID for the master sheet
      // Query to select column G. We will filter header and malformed data on client-side.
      const tq = encodeURIComponent("select G where G is not null") // Removed offset 1 as it was unreliable

      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID_FOR_DEALER_SIZES}/gviz/tq?tqx=out:json&tq=${tq}&gid=${MASTER_SHEET_GID}`

      const response = await fetch(url)

      if (!response.ok) throw new Error(`Failed to fetch sales persons data: HTTP Status ${response.status}`)
      const text = await response.text()

      // Extract JSON part from the Google Visualization API response
      const jsonStart = text.indexOf("{")
      const jsonEnd = text.lastIndexOf("}")
      const data = JSON.parse(text.substring(jsonStart, jsonEnd + 1))

      let salesPersons = []
      if (data.table?.rows?.length > 0) {
        salesPersons = data.table.rows.map((row) => {
          const cell = row.c[0] // G is the first column in the query result
          // Ensure it's a string, trim, and then filter out known header or date patterns
          const value = cell && cell.v !== null ? String(cell.v).trim() : ""
          return value
        }).filter(name => {
          // Robustly filter out empty strings, the header, and any date-like strings
          const lowerCaseName = name.toLowerCase();
          return name &&
                 lowerCaseName !== "salesperson name" && // Filter out specific header text
                 !lowerCaseName.startsWith("date("); // Filter out "Date(year,month,day,...)" strings
        });
      }
      setFetchedSalesPersons(Array.from(new Set(salesPersons))) // Ensure unique names
    } catch (err) {
      console.error(`Error fetching sales persons data:`, err)
      setErrorSalesPersons(`Failed to load sales persons: ${err.message}`)
      setFetchedSalesPersons([]); // Clear any previous data on error
    } finally {
      setIsLoadingSalesPersons(false)
    }
  }

  /**
   * Generates the next available dealer code by reading the last code from the 'FMS' sheet.
   * The code format is "DCXX" (e.g., DC01, DC02).
   */
  const generateNextDealerCode = async () => {
    setIsLoadingDealerCode(true)
    setErrorDealerCode(null)

    try {
      // GID of the ❝FMS❞ sheet – adjust if your tab uses another GID
      const FMS_GID = "0"

      // Google-visualisation SQL to fetch ONLY the last dealer-code in col B
      const tq = encodeURIComponent("select B where B is not null order by B desc limit 1")

      const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID_FOR_DEALER_SIZES}/gviz/tq?tqx=out:json&tq=${tq}&gid=${FMS_GID}`

      const res = await fetch(url)

      if (!res.ok) throw new Error(`Sheets request failed (${res.status})`)

      const raw = await res.text()
      const jsonStart = raw.indexOf("{")
      const jsonEnd = raw.lastIndexOf("}")
      const data = JSON.parse(raw.substring(jsonStart, jsonEnd + 1))

      // Grab the only row we asked for (if any)
      const rows = data.table?.rows ?? []
      const lastCode =
        rows.length && rows[0].c[0] && rows[0].c[0].v ? rows[0].c[0].v.toString().trim().toUpperCase() : ""

      // Fallback when the sheet is still empty
      if (!lastCode || !/^DC\d+$/i.test(lastCode)) {
        setFormData((p) => ({ ...p, dealerCode: "DC01" }))
        return
      }

      const nextNum = (Number.parseInt(lastCode.replace(/^DC/i, ""), 10) || 0) + 1
      const nextDealerCode = `DC${nextNum.toString().padStart(2, "0")}`

      setFormData((p) => ({ ...p, dealerCode: nextDealerCode }))
    } catch (err) {
      console.error("Error generating dealer code:", err)
      setErrorDealerCode(`Failed to generate dealer code: ${err.message}`)
      // Safe fallback
      setFormData((p) => ({ ...p, dealerCode: "DC01" }))
    } finally {
      setIsLoadingDealerCode(false)
    }
  }

  // useEffect hook to fetch initial data and set up auto-fill/dropdown
  useEffect(() => {
    fetchMasterDataForDealerSizes()
    generateNextDealerCode()

    if (isAuthenticated) {
      if (userRole === "User" && currentUser?.salesPersonName) {
        // Auto-fill for 'User' role
        setFormData((prev) => ({
          ...prev,
          salesPersonName: currentUser.salesPersonName,
        }))
      } else if (userRole === "Admin") {
        // Fetch sales persons for 'Admin' role dropdown
        fetchSalesPersons()
      }
    }
  }, [isAuthenticated, userRole, currentUser]) // Dependencies for re-running effect

  // Effect for handling clicks outside the custom sales person dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (salesPersonDropdownRef.current && !salesPersonDropdownRef.current.contains(event.target)) {
        setIsSalesPersonDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [salesPersonDropdownRef])


  /**
   * Handles changes to form input fields.
   * @param {Event} e - The change event object.
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target
    // Prevent changing dealer code as it's auto-generated and read-only
    if (name === "dealerCode") return

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    // Clear error for the field if it was previously set
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }))
    }
  }

  /**
   * Handles selection from the custom sales person dropdown.
   * @param {string} name - The selected sales person name.
   */
  const handleSalesPersonSelect = (name) => {
    setFormData((prev) => ({
      ...prev,
      salesPersonName: name,
    }))
    setIsSalesPersonDropdownOpen(false) // Close dropdown after selection
    if (errors.salesPersonName) {
      setErrors((prev) => ({
        ...prev,
        salesPersonName: "",
      }))
    }
  }

  /**
   * Validates the form data before submission.
   * @returns {boolean} - True if the form is valid, false otherwise.
   */
  const validateForm = () => {
    const newErrors = {}

    if (!formData.stateName.trim()) newErrors.stateName = "State name is required"
    if (!formData.districtName.trim()) newErrors.districtName = "District name is required"
    if (!formData.dealerCode.trim()) newErrors.dealerCode = "Dealer Code is required"
    if (!formData.salesPersonName.trim() || formData.salesPersonName.length < 2) {
      newErrors.salesPersonName = "Sales person name must be at least 2 characters"
    }
    if (!formData.dealerName.trim() || formData.dealerName.length < 2) {
      newErrors.dealerName = "Dealer name must be at least 2 characters"
    }
    if (!formData.contactNumber.trim() || formData.contactNumber.length < 10) {
      newErrors.contactNumber = "Contact number must be at least 10 digits"
    }
    // if (!formData.emailAddress.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.emailAddress)) {
    //   newErrors.emailAddress = "Valid Email Address is required"
    // }
    if (!formData.aboutDealer.trim() || formData.aboutDealer.length < 5) {
      newErrors.aboutDealer = "About dealer must be at least 5 characters"
    }
    if (!formData.address.trim() || formData.address.length < 5) {
      newErrors.address = "Address must be at least 5 characters"
    }
    if (!formData.dealerSize) newErrors.dealerSize = "Please select a dealer size"
    if (!formData.avgQty.trim()) newErrors.avgQty = "Average quantity is required"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  /**
   * Submits the form data to Google Sheets via Google Apps Script.
   * @param {string} sheetName - The name of the target sheet.
   * @param {Array<string>} rowData - An array of data to be inserted as a row.
   * @returns {Promise<Object>} - The result of the submission.
   */
  const submitToGoogleSheets = async (sheetName, rowData) => {
    try {
      const formDataToSend = new FormData()
      formDataToSend.append("sheetName", sheetName)
      formDataToSend.append("action", "insert")
      formDataToSend.append("rowData", JSON.stringify(rowData))

      const response = await fetch(APPS_SCRIPT_URL_FOR_SUBMISSION, {
        method: "POST",
        body: formDataToSend,
        mode: "no-cors", // Use 'no-cors' for Google Apps Script to avoid CORS issues
      })

      // In 'no-cors' mode, response.ok is always true and response.json() is not available.
      // We assume success if the request was sent without network errors.
      if (response.type === "opaque") {
        console.log("Request sent with no-cors mode. Assuming success.")
        return { success: true }
      }

      // If not opaque, try to parse JSON (e.g., if CORS is configured or for debugging)
      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || "Failed to submit to Google Sheets")
      }
      return result
    } catch (error) {
      console.error("Google Sheets submission error:", error)
      throw error
    }
  }

  /**
   * Handles the form submission.
   * @param {Event} e - The form submission event object.
   */
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) {
      showToast("Please correct the errors in the form.", "error");
      return
    }

    setIsSubmitting(true)
    try {
      // Format timestamp, DOB, and Anniversary dates
      const timestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss")
      const formattedDob = formData.dob ? format(new Date(formData.dob), "yyyy-MM-dd") : ""
      const formattedAnniversary = formData.anniversary ? format(new Date(formData.anniversary), "yyyy-MM-dd") : ""

      // IMPORTANT: Ensure the order of these values matches the columns in your "FMS" Google Sheet.
      const rowData = [
        timestamp, // Column A
        formData.dealerCode, // Column B
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
      ]

      const targetSheetName = "FMS" // Target sheet name

      console.log("Submitting data to Google Sheet:", rowData)
      await submitToGoogleSheets(targetSheetName, rowData)

      showToast("Dealer registered successfully!")

      // Reset form data after successful submission
      setFormData({
        dealerCode: "", // Will be re-generated by generateNextDealerCode
        stateName: "",
        districtName: "",
        // Keep salesPersonName auto-filled if user is 'User'
        salesPersonName: userRole === "User" && currentUser?.salesPersonName ? currentUser.salesPersonName : "",
        dealerName: "",
        aboutDealer: "",
        address: "",
        dealerSize: "",
        avgQty: "",
        contactNumber: "",
        emailAddress: "",
        dob: "",
        anniversary: "",
      })
      setErrors({}); // Clear validation errors

      // Generate the next dealer code for the next registration
      generateNextDealerCode()
    } catch (error) {
      console.error("Submission error:", error)
      showToast(`Error submitting form: ${error.message}`, "error")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-blue-50 p-0 lg:p-8 font-inter">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Main Form Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-8 py-6">
            <h3 className="text-2xl font-bold text-white mb-2">Dealer Information</h3>
            <p className="text-purple-50 text-lg">Fill in the details about the dealer and sales person</p>
          </div>
          <div className=" p-2 lg:p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Location Information */}
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">State Name</label>
                    <input
                      type="text"
                      name="stateName"
                      value={formData.stateName}
                      onChange={handleInputChange}
                      placeholder="Enter state name"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                    />
                    {errors.stateName && <p className="text-red-500 text-sm mt-2 font-medium">{errors.stateName}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">District Name</label>
                    <input
                      type="text"
                      name="districtName"
                      value={formData.districtName}
                      onChange={handleInputChange}
                      placeholder="Enter district name"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                    />
                    {errors.districtName && (
                      <p className="text-red-500 text-sm mt-2 font-medium">{errors.districtName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">
                      Dealer Code
                      <span className="text-xs text-gray-500 ml-2">(Auto-generated)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        name="dealerCode"
                        value={formData.dealerCode}
                        readOnly
                        placeholder={isLoadingDealerCode ? "Generating..." : "Auto-generated dealer code"}
                        className="w-full px-4 py-3 bg-gray-50 border border-slate-200 rounded-xl shadow-sm text-slate-700 font-medium cursor-not-allowed"
                      />
                      {isLoadingDealerCode && (
                        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500"></div>
                        </div>
                      )}
                    </div>
                    {errorDealerCode && <p className="text-amber-500 text-sm mt-2 font-medium">{errorDealerCode}</p>}
                    {errors.dealerCode && <p className="text-red-500 text-sm mt-2 font-medium">{errors.dealerCode}</p>}
                  </div>
                </div>
              </div>

              {/* Personal Information */}
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">Sales Person Name</label>
                    {userRole === "Admin" ? (
                      <div className="relative" ref={salesPersonDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setIsSalesPersonDropdownOpen(!isSalesPersonDropdownOpen)}
                          className={`w-full px-4 py-3 text-left bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium flex justify-between items-center ${
                            isLoadingSalesPersons ? "opacity-70 cursor-not-allowed" : ""
                          }`}
                          disabled={isLoadingSalesPersons}
                        >
                          {formData.salesPersonName || "Select Sales Person"}
                          <svg
                            className={`w-4 h-4 ml-2 transition-transform ${isSalesPersonDropdownOpen ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                          </svg>
                        </button>
                        {isSalesPersonDropdownOpen && (
                          <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            {isLoadingSalesPersons ? (
                              <div className="px-4 py-2 text-slate-500">Loading sales persons...</div>
                            ) : errorSalesPersons ? (
                              <div className="px-4 py-2 text-red-500">{errorSalesPersons}</div>
                            ) : fetchedSalesPersons.length === 0 ? (
                              <div className="px-4 py-2 text-slate-500">No sales persons found.</div>
                            ) : (
                              <ul>
                                {fetchedSalesPersons.map((person) => (
                                  <li
                                    key={person}
                                    onClick={() => handleSalesPersonSelect(person)}
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
                          userRole === "User" ? "bg-gray-50 cursor-not-allowed" : ""
                        }`}
                      />
                    )}
                    {errors.salesPersonName && (
                      <p className="text-red-500 text-sm mt-2 font-medium">{errors.salesPersonName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">Dealer Name</label>
                    <input
                      type="text"
                      name="dealerName"
                      value={formData.dealerName}
                      onChange={handleInputChange}
                      placeholder="Enter dealer name"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                    />
                    {errors.dealerName && <p className="text-red-500 text-sm mt-2 font-medium">{errors.dealerName}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">Contact Number</label>
                    <input
                      type="tel"
                      name="contactNumber"
                      value={formData.contactNumber}
                      onChange={handleInputChange}
                      placeholder="Enter contact number"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                    />
                    {errors.contactNumber && (
                      <p className="text-red-500 text-sm mt-2 font-medium">{errors.contactNumber}</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">Email Address</label>
                    <input
                      type="email"
                      name="emailAddress"
                      value={formData.emailAddress}
                      onChange={handleInputChange}
                      placeholder="Enter Email Address"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                    />
                    {errors.emailAddress && (
                      <p className="text-red-500 text-sm mt-2 font-medium">{errors.emailAddress}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">Date Of Birth</label>
                    <input
                      type="date"
                      name="dob"
                      value={formData.dob}
                      onChange={handleInputChange}
                      placeholder="Date Of Birth"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                    />
                    {errors.dob && <p className="text-red-500 text-sm mt-2 font-medium">{errors.dob}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">Anniversary</label>
                    <input
                      type="date"
                      name="anniversary"
                      value={formData.anniversary}
                      onChange={handleInputChange}
                      placeholder="Anniversary Date"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                    />
                    {errors.anniversary && (
                      <p className="text-red-500 text-sm mt-2 font-medium">{errors.anniversary}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Business Information */}
              <div className="space-y-6">
                <div className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-3">About Dealer</label>
                      <textarea
                        name="aboutDealer"
                        value={formData.aboutDealer}
                        onChange={handleInputChange}
                        placeholder="Enter information about the dealer"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium min-h-24 resize-none"
                      />
                      {errors.aboutDealer && (
                        <p className="text-red-500 text-sm mt-2 font-medium">{errors.aboutDealer}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-3">Address</label>
                      <textarea
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        placeholder="Enter dealer address"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium min-h-24 resize-none"
                      />
                      {errors.address && <p className="text-red-500 text-sm mt-2 font-medium">{errors.address}</p>}
                    </div>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-3">Dealer Size</label>
                      <select
                        name="dealerSize"
                        value={formData.dealerSize}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                      >
                        <option value="">Select dealer size</option>
                        {isLoadingDealerSizes ? (
                          <option disabled>Loading sizes...</option>
                        ) : errorDealerSizes ? (
                          <option disabled>{errorDealerSizes}</option>
                        ) : (
                          fetchedDealerSizes.map((size) => (
                            <option key={size} value={size}>
                              {size}
                            </option>
                          ))
                        )}
                      </select>
                      {errors.dealerSize && (
                        <p className="text-red-500 text-sm mt-2 font-medium">{errors.dealerSize}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-3">Average Quantity</label>
                      <input
                        type="number"
                        name="avgQty"
                        value={formData.avgQty}
                        onChange={handleInputChange}
                        placeholder="Enter average quantity"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all duration-200 text-slate-700 font-medium"
                      />
                      {errors.avgQty && <p className="text-red-500 text-sm mt-2 font-medium">{errors.avgQty}</p>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-6 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={isSubmitting || isLoadingDealerCode || (userRole === "Admin" && isLoadingSalesPersons)}
                  className={`w-full lg:w-auto bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 hover:from-purple-700 hover:via-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] ${
                    isSubmitting || isLoadingDealerCode || (userRole === "Admin" && isLoadingSalesPersons)
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  {isSubmitting ? "Registering Dealer..." : "Register Dealer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DealerForm