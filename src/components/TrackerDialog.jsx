"use client";

import { useState, useEffect, useContext } from "react";
import { RefreshCw } from "lucide-react";
import { AuthContext } from "../App";
import supabase from "../SupaabseClient";

export default function TrackerDialog({
  isOpen,
  onClose,
  dealerData,
  masterData,
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [fieldVisibility, setFieldVisibility] = useState({
    showCustomerFeedback: false,
    showNextAction: false,
    showNextCallDate: false,
    showOrderQty: false,
    showOrderedProducts: false,
    showValueOfOrder: false,
    requireStatus: true,
  });

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("success");
  const [modalMessage, setModalMessage] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // State for sales person names from master table
  const [salesPersonNames, setSalesPersonNames] = useState([]);

  // State for location coordinates
  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
    error: null,
    isLoading: false
  });

  const [formData, setFormData] = useState({
    orderQty: "",
    orderedProducts: "",
    customerFeedback: "",
    status: "",
    stage: "",
    nextAction: "",
    valueOfOrder: "",
    subStage: "",
    salesPersonName: ""
  });

  const [showNotInterestedSection, setShowNotInterestedSection] = useState(false);
  const [showPaymentCollectionSection, setShowPaymentCollectionSection] = useState(false);
  const [notInterestedReason, setNotInterestedReason] = useState("");
  const [paymentCollection, setPaymentCollection] = useState("");
  const [nextCollectionDate, setNextCollectionDate] = useState("");
  const [whyNotCollection, setWhyNotCollection] = useState("");

  // Get current user from context
  const { currentUser } = useContext(AuthContext);

  // Get entity type from Supabase data
  const entityType = dealerData?.supabase_data?.select_value || "";

  // Check if current user is admin
  const isAdmin = currentUser?.role?.toLowerCase() === "admin";

  // Define statuses and stages from masterData
  const statuses = masterData
    ? [
        ...new Set(
          masterData
            .filter(
              (item) =>
                item.col1 && !["Status", "status", "STATUS"].includes(item.col1)
            )
            .map((item) => item.col1)
        ),
      ]
    : [];

  const stages = masterData
    ? [
        ...new Set(
          masterData
            .filter(
              (item) =>
                item.col2 && !["Stage", "stage", "STAGE"].includes(item.col2)
            )
            .map((item) => item.col2)
        ),
      ]
    : [];

  // Fetch current location when dialog opens
  useEffect(() => {
    if (isOpen) {
      getCurrentLocation();
    } else {
      // Reset location when dialog closes
      setLocation({
        latitude: null,
        longitude: null,
        error: null,
        isLoading: false
      });
    }
  }, [isOpen]);

  // Function to get current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocation(prev => ({
        ...prev,
        error: "Geolocation is not supported by this browser.",
        isLoading: false
      }));
      return;
    }

    setLocation(prev => ({ ...prev, isLoading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          error: null,
          isLoading: false
        });
      },
      (error) => {
        let errorMessage = "Unable to retrieve your location.";
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied by user.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out.";
            break;
          default:
            errorMessage = "An unknown error occurred.";
            break;
        }
        
        setLocation({
          latitude: null,
          longitude: null,
          error: errorMessage,
          isLoading: false
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000, 
        maximumAge: 120000 
      }
    );
  };

  // Fetch sales person names from master table
  useEffect(() => {
    const fetchSalesPersonNames = async () => {
      if (!isOpen) return;
      
      try {
        
        const { data, error } = await supabase
          .from('master')
          .select('sales_person_name')
          .not('sales_person_name', 'is', null)
          .not('sales_person_name', 'eq', '')
          .order('sales_person_name');

        if (error) {
          throw error;
        }

        // Extract unique names and filter out invalid values
        const uniqueNames = [...new Set(data
          .map(item => item.sales_person_name)
          .filter(name => 
            name && 
            name.trim() !== "" &&
            !['Sales Person', 'sales person', 'SALES PERSON', 'Sales Person Name'].includes(name)
          )
        )];

        setSalesPersonNames(uniqueNames);

      } catch (error) {
        setSalesPersonNames([]);
      }
    };

    if (isOpen && isAdmin) {
      fetchSalesPersonNames();
    }
  }, [isOpen, isAdmin]);

  /**
   * Get stage options based on entity type
   */
  const getStageOptions = () => {
    if (entityType === "Site/Engineer") {
      return [
        "Follow-up",
        "Call not picked",
        "Order Closed",
        "Order Pending",
      ];
    } else {
      return [
        "Follow-Up",
        "Call Not Picked",
        "Introductory Call",
        "First Visit",
        "Order Received",
        "Order Not Received",
        "Not Interested",
        "Payment Enquiry",
        ...stages.filter(stage => ![
          "Follow-Up", "Call", "Call Not Picked", "Introductory Call", 
          "First Visit",
          "Order Received", "Order Not Received", "Not Interested", 
          "Payment Enquiry"
        ].includes(stage))
      ];
    }
  };

  /**
   * Get sub-stage options for Site/Engineer Order stages
   */
  const getSubStageOptions = () => {
    if (entityType === "Site/Engineer" && 
        (formData.stage === "Order Closed" || formData.stage === "Order Pending")) {
      return ["Order Received", "Order Not Received"];
    }
    return [];
  };

  const subStageOptions = getSubStageOptions();

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
    }, 2000);
  };

  /**
   * Closes the modal popup manually
   */
  const closeModal = () => {
    setShowModal(false);
    setModalMessage("");
  };

  const formatDateToDDMMYYYY = (dateString) => {
    if (!dateString) return "N/A";

    let date;
    const dateMatch = dateString.match(
      /^Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,(\d{1,2}),(\d{1,2}),(\d{1,2}))?\)$/
    );

    if (dateMatch) {
      const year = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10);
      const day = parseInt(dateMatch[3], 10);
      const hours = dateMatch[4] ? parseInt(dateMatch[4], 10) : 0;
      const minutes = dateMatch[5] ? parseInt(dateMatch[5], 10) : 0;
      const seconds = dateMatch[6] ? parseInt(dateMatch[6], 10) : 0;
      date = new Date(year, month, day, hours, minutes, seconds);
    } else {
      date = new Date(dateString);
    }

    if (isNaN(date.getTime())) {
      return "N/A";
    }

    const dayStr = String(date.getDate()).padStart(2, "0");
    const monthStr = String(date.getMonth() + 1).padStart(2, "0");
    const yearStr = date.getFullYear();
    return `${dayStr}/${monthStr}/${yearStr}`;
  };

  useEffect(() => {
    if (!formData.stage) {
      setFieldVisibility((prev) => ({
        ...prev,
        showCustomerFeedback: false,
        showNextAction: false,
        showNextCallDate: false,
        showOrderQty: false,
        showOrderedProducts: false,
        showValueOfOrder: false,
        requireStatus: true,
      }));
      setShowNotInterestedSection(false);
      setShowPaymentCollectionSection(false);
      return;
    }

    // Handle special stages for all entity types
    if (formData.stage === "Not Interested") {
      setShowNotInterestedSection(true);
      setShowPaymentCollectionSection(false);
    } else if (formData.stage === "Payment Enquiry") {
      setShowPaymentCollectionSection(true);
      setShowNotInterestedSection(false);
    } else {
      setShowNotInterestedSection(false);
      setShowPaymentCollectionSection(false);
    }

    // Define stage visibility based on entity type and selected stage
    const isOrderStage = formData.stage === "Order Received" || 
                        (entityType === "Site/Engineer" && formData.stage === "Order Closed");
    const isOrderNotReceivedStage = formData.stage === "Order Not Received" || 
                                   (entityType === "Site/Engineer" && formData.stage === "Order Pending");
    const isFollowUpCallStage = [
      "Follow-Up",
      "Call Not Picked",
      "Introductory Call",
      "Call",
      "First Visit",
      "Follow-up",
      "Call not picked"
    ].includes(formData.stage);

    const isSiteEngineerOrderClosed = entityType === "Site/Engineer" && formData.stage === "Order Closed";

    setFieldVisibility({
      showCustomerFeedback: (isFollowUpCallStage || isOrderNotReceivedStage || isSiteEngineerOrderClosed) && 
                           !["Call Not Picked", "Call not picked"].includes(formData.stage),
      showNextAction: isFollowUpCallStage || isOrderNotReceivedStage,
      showNextCallDate: false,
      showOrderQty: isOrderStage,
      showOrderedProducts: isOrderStage,
      showValueOfOrder: (isOrderStage || isOrderNotReceivedStage) && 
                       formData.stage !== "Order Not Received" && 
                       formData.stage !== "Order Pending" &&
                       !isSiteEngineerOrderClosed,
      requireStatus: true,
    });
  }, [formData.stage, entityType]);

  useEffect(() => {
    if (isOpen && dealerData) {
      // Set default sales person name
      const defaultSalesPersonName = isAdmin ? "" : (currentUser?.salesPersonName || "");
      
      setFormData({
        orderQty: "",
        orderedProducts: "",
        customerFeedback: "",
        status: dealerData.col9 || "",
        stage: dealerData.col10 || "",
        nextAction: "",
        valueOfOrder: "",
        subStage: "",
        salesPersonName: defaultSalesPersonName
      });
    } else {
      setFormData({
        orderQty: "",
        orderedProducts: "",
        customerFeedback: "",
        status: "",
        stage: "",
        nextAction: "",
        valueOfOrder: "",
        subStage: "",
        salesPersonName: ""
      });
      setErrors({});
      setNotInterestedReason("");
      setPaymentCollection("");
      setNextCollectionDate("");
      setWhyNotCollection("");
      setShowNotInterestedSection(false);
      setShowPaymentCollectionSection(false);
    }
  }, [isOpen, dealerData, isAdmin, currentUser]);

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

  const validateForm = () => {
    const newErrors = {};

    if (fieldVisibility.showCustomerFeedback && !formData.customerFeedback) {
      newErrors.customerFeedback = "Customer feedback is required.";
    }

    if (fieldVisibility.requireStatus && !formData.status) {
      newErrors.status = "Status is required.";
    }

    if (!formData.stage) {
      newErrors.stage = "Stage is required.";
    }

    // Validate sales person name
    if (!formData.salesPersonName) {
      newErrors.salesPersonName = "Sales person name is required.";
    }

    if (fieldVisibility.showNextAction && !formData.nextAction) {
      newErrors.nextAction = "Next action is required.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formIsValid = validateForm();
    if (!formIsValid) {
      showToast("Please correct the errors in the form.", "error");
      return;
    }

    // Check if location is available
    if (!location.latitude || !location.longitude) {
      setShowConfirmModal(true);
      return;
    }

    executeSubmission();
  };

  const executeSubmission = async () => {
    setErrors({});
    setIsSubmitting(true);

    try {
      const dealerCode = dealerData?.col1 || "";
      const dealerName = dealerData?.col5 || "";
      const select_value = dealerData?.select_value || "";
      const areaName = dealerData?.supabase_data?.area_name || "";
      
      if (!dealerCode) throw new Error("Dealer code is missing");

      const formattedTimestamp = new Date().toISOString();
      const formattedLastDateOfCall = dealerData.col17 || null;

      // Conditional logic for customer feedback
      const whatDidCustomerSay =
        formData.stage === "Not Interested"
          ? notInterestedReason
          : formData.stage === "Payment Enquiry" && paymentCollection === "No"
          ? whyNotCollection
          : (entityType === "Site/Engineer" && formData.stage === "Order Closed")
          ? formData.customerFeedback
          : formData.customerFeedback;

      const nextDateOfCall =
        formData.stage === "Payment Enquiry" && paymentCollection === "No"
          ? nextCollectionDate
          : null;

      // Construct the Supabase insert object for tracking_history
      const insertData = {
        dealer_code: dealerCode || null,
        stage: formData.stage || null,
        status: formData.status || null,
        last_date_of_call: formattedLastDateOfCall || null,
        what_did_customer_says: whatDidCustomerSay || null,
        next_action: formData.nextAction || null,
        next_date_of_call: nextDateOfCall || null,
        order_qty: formData.orderQty || null,
        order_products: formData.orderedProducts || null,
        value_of_order: (entityType === "Site/Engineer" && formData.stage === "Order Closed") 
          ? null
          : formData.valueOfOrder || null,
        sales_person_name: formData.salesPersonName || currentUser?.salesPersonName || "Unknown",
        payment_yes_no: formData.stage === "Payment Enquiry" ? paymentCollection : null,
        deler_distributer_site_name: dealerName || null,
        area_name: areaName || null,
        select_value: select_value,
        // Add longitude and latitude to the tracking_history table
        longitude: location.longitude,
        latitude: location.latitude,
      };

      // Insert into tracking_history table
      const { data: trackingData, error: trackingError } = await supabase
        .from("tracking_history")
        .insert([insertData])
        .select();

      if (trackingError) throw trackingError;

      // Update FMS table with key columns only
      const fmsUpdateData = {
        stage: formData.stage || null,
        status: formData.status || null,
        what_did_the_customer_say: whatDidCustomerSay || null,
        order_qty: formData.orderQty || null,
        next_action: formData.nextAction || null,
        order_products: formData.orderedProducts || null,
        value_of_order: (entityType === "Site/Engineer" && formData.stage === "Order Closed") 
          ? null
          : formData.valueOfOrder || null,
        last_date_of_call: new Date(),
        next_date_of_call: nextDateOfCall || null,
        actual: formData.stage === "Not Interested" || formData.stage === "Order Closed"
          ? new Date()
          : null,
        area_name: areaName || null,
        // Add location to FMS table if you have the columns there too
        longitude: location.longitude,
        latitude: location.latitude,
      };

      // Update FMS table using update instead of upsert
      const { data: fmsData, error: fmsError } = await supabase
        .from("FMS")
        .update(fmsUpdateData)
        .eq('dc_dealer_code', dealerCode);

      if (fmsError) throw fmsError;

      showToast(
        `Tracking data for ${dealerCode} recorded successfully!`,
        "success"
      );

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      showToast(
        `Error recording data: ${error.message || "Unknown error"}`,
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const stageOptions = getStageOptions();

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
          <div className="sticky top-0 bg-white/90 backdrop-blur-md px-8 py-6 border-b border-slate-200 flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-bold text-slate-800">
                Record Dealer Interaction
              </h2>
              {dealerData && (
                <div className="flex items-center gap-x-6 mt-2">
                  <p className="text-lg text-slate-600">
                    Dealer Code:{" "}
                    <span className="font-semibold text-green-600">
                      {dealerData.col1}
                    </span>
                  </p>
                  <p className="text-lg text-slate-600">
                    Entity Type:{" "}
                    <span className="font-semibold text-blue-600">
                      {entityType}
                    </span>
                  </p>
                  <p className="text-lg text-slate-600">
                    Area Name:{" "}
                    <span className="font-semibold text-purple-600">
                      {dealerData.supabase_data?.area_name || "N/A"}
                    </span>
                  </p>
                  <p className="text-lg text-slate-600">
                    Last Call Date:{" "}
                    <span className="font-semibold text-blue-600">
                      {formatDateToDDMMYYYY(dealerData.col17)}
                    </span>
                  </p>
                </div>
              )}
              
              {/* Location Status */}
              <div className="mt-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Location Status:
                  </span>
                  {location.isLoading ? (
                    <span className="text-amber-600 text-sm flex items-center gap-2 font-medium">
                      <div className="w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                      Fetching your coordinates...
                    </span>
                  ) : location.error ? (
                    <span className="text-red-600 text-sm flex items-center gap-2 font-medium">
                      <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      {location.error}
                    </span>
                  ) : location.latitude && location.longitude ? (
                    <span className="text-emerald-600 text-sm flex items-center gap-2 font-medium">
                      <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Captured ({location.latitude.toFixed(6)}, {location.longitude.toFixed(6)})
                    </span>
                  ) : (
                    <span className="text-slate-500 text-sm font-medium italic">Pending...</span>
                  )}
                </div>
                {(location.error || (!location.isLoading && !location.latitude)) && (
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    className="mt-2 text-indigo-600 text-sm hover:text-indigo-800 flex items-center gap-1.5 font-bold underline transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry fetching location
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-md"
                    required={fieldVisibility.requireStatus}
                  >
                    <option value="">Select Status</option>
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  {errors.status && (
                    <p className="text-red-500 text-sm mt-1">{errors.status}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stage
                  </label>
                  <select
                    name="stage"
                    value={formData.stage}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-md"
                    required
                  >
                    <option value="">Select Stage</option>
                    {stageOptions.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                  {errors.stage && (
                    <p className="text-red-500 text-sm mt-1">{errors.stage}</p>
                  )}
                </div>
              </div>

              {/* Sales Person Name Field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sales Person Name {isAdmin && <span className="text-red-500">*</span>}
                </label>
                {isAdmin ? (
                  <>
                    <select
                      name="salesPersonName"
                      value={formData.salesPersonName}
                      onChange={handleInputChange}
                      className="w-full p-3 border border-gray-300 rounded-md"
                      required
                    >
                      <option value="">Select Sales Person</option>
                      {salesPersonNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    {errors.salesPersonName && (
                      <p className="text-red-500 text-sm mt-1">{errors.salesPersonName}</p>
                    )}
                  </>
                ) : (
                  <input
                    type="text"
                    value={currentUser?.salesPersonName || "Unknown User"}
                    className="w-full p-3 border border-gray-300 rounded-md bg-gray-100"
                    readOnly
                    disabled
                  />
                )}
              </div>

              {/* Not Interested Section */}
              {showNotInterestedSection && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Why Customer Not Interested
                  </label>
                  <textarea
                    value={notInterestedReason}
                    onChange={(e) => setNotInterestedReason(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md"
                    rows="3"
                    placeholder="Enter reason..."
                  />
                </div>
              )}

              {/* Payment Collection Section */}
              {showPaymentCollectionSection && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Enquiry
                    </label>
                    <select
                      value={paymentCollection}
                      onChange={(e) => {
                        setPaymentCollection(e.target.value);
                        if (e.target.value === "Yes") {
                          setNextCollectionDate("");
                          setWhyNotCollection("");
                        }
                      }}
                      className="w-full p-3 border border-gray-300 rounded-md"
                    >
                      <option value="">Select</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>

                  {paymentCollection === "No" && (
                    <>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Next Date
                        </label>
                        <input
                          type="date"
                          value={nextCollectionDate}
                          onChange={(e) =>
                            setNextCollectionDate(e.target.value)
                          }
                          className="w-full p-3 border border-gray-300 rounded-md"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Why Not Collection
                        </label>
                        <textarea
                          value={whyNotCollection}
                          onChange={(e) => setWhyNotCollection(e.target.value)}
                          className="w-full p-3 border border-gray-300 rounded-md"
                          rows="3"
                          placeholder="Enter reason..."
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Customer Feedback for Site/Engineer Order Closed */}
              {fieldVisibility.showCustomerFeedback && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {entityType === "Site/Engineer" && formData.stage === "Order Closed" 
                      ? "Order Details / Customer Feedback" 
                      : "Customer Feedback"}
                  </label>
                  <textarea
                    name="customerFeedback"
                    value={formData.customerFeedback}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-md"
                    rows={3}
                    required={fieldVisibility.showCustomerFeedback}
                    placeholder={
                      entityType === "Site/Engineer" && formData.stage === "Order Closed" 
                        ? "Enter order details and customer feedback..." 
                        : "Enter customer feedback..."
                    }
                  />
                  {errors.customerFeedback && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.customerFeedback}
                    </p>
                  )}
                </div>
              )}

              {fieldVisibility.showNextAction && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Next Action
                  </label>
                  <input
                    type="text"
                    name="nextAction"
                    value={formData.nextAction}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-md"
                    required
                  />
                  {errors.nextAction && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.nextAction}
                    </p>
                  )}
                </div>
              )}

              {(fieldVisibility.showOrderQty ||
                fieldVisibility.showOrderedProducts ||
                fieldVisibility.showValueOfOrder) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {fieldVisibility.showOrderQty && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Order Qty
                      </label>
                      <input
                        type="number"
                        name="orderQty"
                        value={formData.orderQty}
                        onChange={handleInputChange}
                        className="w-full p-3 border border-gray-300 rounded-md"
                      />
                    </div>
                  )}

                  {fieldVisibility.showOrderedProducts && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ordered Products
                      </label>
                      <input
                        type="text"
                        name="orderedProducts"
                        value={formData.orderedProducts}
                        onChange={handleInputChange}
                        className="w-full p-3 border border-gray-300 rounded-md"
                      />
                    </div>
                  )}

                  {fieldVisibility.showValueOfOrder && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Value of Order
                      </label>
                      <input
                        type="number"
                        name="valueOfOrder"
                        value={formData.valueOfOrder}
                        onChange={handleInputChange}
                        className="w-full p-3 border border-gray-300 rounded-md"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-4 pt-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <div className="flex flex-col items-end gap-2">
                  <button
                    type="submit"
                    className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-lg shadow-blue-200 transition-all active:scale-95"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Recording...
                      </span>
                    ) : (
                      "Record Interaction"
                    )}
                  </button>
                  {(!location.latitude || !location.longitude) && !isSubmitting && !location.isLoading && (
                    <p className="text-xs text-amber-600 font-medium italic">
                      * Location not available. You can still submit.
                    </p>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Modal popup */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-10 flex items-center justify-center z-[60] p-4">
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

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full mx-4 transform transition-all duration-300 scale-100">
            <div className="p-8 text-center">
              <div className="mx-auto mb-6 w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
                <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center">
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
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    ></path>
                  </svg>
                </div>
              </div>

              <h2 className="text-2xl font-bold mb-4 text-slate-800">
                Location Missing
              </h2>

              <p className="text-slate-600 text-lg mb-8 leading-relaxed">
                Location fetching failed or is not available. Do you want to record the interaction anyway?
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    executeSubmission();
                  }}
                  className="w-full px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  Yes, Submit Anyway
                </button>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="w-full px-8 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-all duration-200"
                >
                  No, Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}