
"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

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

  const [formData, setFormData] = useState({
    orderQty: "",
    orderedProducts: "",
    customerFeedback: "",
    status: "",
    stage: "",
    nextAction: "",
    nextCallDate: "",
    valueOfOrder: "",
  });

  const APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycby8tWRO5JWFmJmDECvf85x8baVHqXNfePy-w_tpk0ZL3lrby_M2Z9jNoRvlLokFIQ8/exec";

  const statuses = masterData
    ? [...new Set(masterData
        .filter(item => item.col1 && !['Status', 'status', 'STATUS'].includes(item.col1))
        .map(item => item.col1)
      )]
    : [];

  const stages = masterData
    ? [...new Set(masterData
        .filter(item => item.col2 && !['Stage', 'stage', 'STAGE'].includes(item.col2))
        .map(item => item.col2)
      )]
    : [];

  const formatDateToDDMMYYYY = (dateString) => {
    console.log("formatDateToDDMMYYYY received:", dateString);

    if (!dateString) return "N/A";

    let date;
    // Regex to match "Date(YYYY,MM,DD,HH,MM,SS)" or "Date(YYYY,MM,DD)"
    // It is important that the month is already 0-indexed if coming from Google Sheets Date() serialization.
    const dateMatch = dateString.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,(\d{1,2}),(\d{1,2}),(\d{1,2}))?\)$/);

    if (dateMatch) {
      const year = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10); // Use directly as it's likely already 0-indexed by the source
      const day = parseInt(dateMatch[3], 10);
      const hours = dateMatch[4] ? parseInt(dateMatch[4], 10) : 0;
      const minutes = dateMatch[5] ? parseInt(dateMatch[5], 10) : 0;
      const seconds = dateMatch[6] ? parseInt(dateMatch[6], 10) : 0;

      console.log(`Parsed components: Year=${year}, Month=${month}, Day=${day}, Hours=${hours}, Minutes=${minutes}, Seconds=${seconds}`);
      date = new Date(year, month, day, hours, minutes, seconds);
    } else {
      // Fallback for other date string formats (e.g., "YYYY-MM-DD", "DD/MM/YYYY")
      console.log("Attempting to parse as a regular date string:", dateString);
      date = new Date(dateString);
    }

    console.log("Date object created:", date);
    if (isNaN(date.getTime())) {
      console.error("Invalid Date object after parsing:", dateString);
      return "N/A";
    }

    const day = String(date.getDate()).padStart(2, '0');
    // Month is 0-indexed in Date object, add 1 for display
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTimestamp = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  useEffect(() => {
    if (!formData.stage) {
      setFieldVisibility(prev => ({
        ...prev,
        showCustomerFeedback: false,
        showNextAction: false,
        showNextCallDate: false,
        showOrderQty: false,
        showOrderedProducts: false,
        showValueOfOrder: false,
        requireStatus: true,
      }));
      return;
    }

    const isOrderStage = ["Order Received", "Order Not Received"].includes(formData.stage);
    const isFollowUpCallStage = ["Follow-Up", "Call Not Picked", "Introductory Call"].includes(formData.stage);
    const isOrderNotReceivedStage = formData.stage === "Order Not Received";

    setFieldVisibility({
      showCustomerFeedback: isFollowUpCallStage || isOrderNotReceivedStage,
      showNextAction: isFollowUpCallStage,
      showNextCallDate: isFollowUpCallStage,
      showOrderQty: isOrderStage,
      showOrderedProducts: isOrderStage,
      showValueOfOrder: isOrderStage,
      requireStatus: true,
    });
  }, [formData.stage]);

  useEffect(() => {
    console.log("TrackerDialog opened or dealerData changed.");

    if (isOpen && dealerData) {
      console.log("✅ Prop 'dealerData' received:", dealerData);
      console.log(
        "🔎 inspecting 'dealerData.col17' (Last Call Date):",
        dealerData.col17
      );
      
      console.log(
        "📊 type of 'dealerData.col17' is:",
        typeof dealerData.col17
      );

      setFormData({
        orderQty: "",
        orderedProducts: "",
        customerFeedback: "",
        status: dealerData.col9 || "",
        stage: dealerData.col10 || "",
        nextAction: "",
        nextCallDate: "",
        valueOfOrder: "",
      });
    } else {
      console.log("Dialog is closing or does not have data, resetting form.");

      setFormData({
        orderQty: "",
        orderedProducts: "",
        customerFeedback: "",
        status: "",
        stage: "",
        nextAction: "",
        nextCallDate: "",
        valueOfOrder: "",
      });
      setErrors({});
    }
  }, [isOpen, dealerData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors(prev => ({
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
    
    if (fieldVisibility.showNextAction && !formData.nextAction) {
      newErrors.nextAction = "Next action is required.";
    }
    
    if (fieldVisibility.showNextCallDate && !formData.nextCallDate) {
      newErrors.nextCallDate = "Next call date is required.";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formIsValid = validateForm();
    if (!formIsValid) {
      toast.error("Please correct the errors in the form.", {
        position: "top-right",
      });
      return;
    }
    setErrors({});

    setIsSubmitting(true);

    try {
      const dealerCode = dealerData?.col1 || "";
      if (!dealerCode) throw new Error("Dealer code is missing");

      const formattedTimestamp = formatTimestamp();
      // Ensure col17 is passed to formatDateToDDMMYYYY
      const formattedLastDateOfCall = dealerData.col17 ? formatDateToDDMMYYYY(dealerData.col17) : "";
      const formattedNextCallDate = formData.nextCallDate ? formatDateToDDMMYYYY(formData.nextCallDate) : "";

      const payload = {
        sheetName: "Tracking History",
        action: "insert",
        rowData: JSON.stringify([
          formattedTimestamp,
          dealerCode,
          formData.stage,
          formData.status,
          formattedLastDateOfCall,
          formData.customerFeedback,
          formData.nextAction,
          formattedNextCallDate,
          formData.orderQty,
          formData.orderedProducts,
          formData.valueOfOrder,
        ]),
      };

      const urlEncodedData = new URLSearchParams(payload);
      await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: urlEncodedData,
        mode: "no-cors",
      });

      toast.success(
        `Tracking data for ${dealerCode} recorded successfully!`,
        { position: "top-right" }
      );
      onClose();
    } catch (error) {
      console.error("Submission error:", error);
      toast.error(
        `Error recording data: ${error.message || "Unknown error"}`,
        { position: "top-right" }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
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
                     Last Call Date:{" "}
                     <span className="font-semibold text-blue-600">
                         {formatDateToDDMMYYYY(dealerData.col17)}
                     </span>
                   </p>
              </div>
            )}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-md"
                  required={fieldVisibility.requireStatus}
                >
                  <option value="">Select Status</option>
                  {statuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                {errors.status && (
                  <p className="text-red-500 text-sm mt-1">{errors.status}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                <select
                  name="stage"
                  value={formData.stage}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-md"
                  required
                >
                  <option value="">Select Stage</option>
                  {stages.map(stage => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
                {errors.stage && (
                  <p className="text-red-500 text-sm mt-1">{errors.stage}</p>
                )}
              </div>
            </div>

            {fieldVisibility.showCustomerFeedback && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Feedback</label>
                <textarea
                  name="customerFeedback"
                  value={formData.customerFeedback}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-md"
                  rows={3}
                  required
                />
                {errors.customerFeedback && (
                  <p className="text-red-500 text-sm mt-1">{errors.customerFeedback}</p>
                )}
              </div>
            )}

            {fieldVisibility.showNextAction && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Action</label>
                <input
                  type="text"
                  name="nextAction"
                  value={formData.nextAction}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-md"
                  required
                />
                {errors.nextAction && (
                  <p className="text-red-500 text-sm mt-1">{errors.nextAction}</p>
                )}
              </div>
            )}

            {fieldVisibility.showNextCallDate && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Call Date</label>
                <input
                  type="date"
                  name="nextCallDate"
                  value={formData.nextCallDate}
                  onChange={handleInputChange}
                  className="w-full p-3 border border-gray-300 rounded-md"
                  required
                />
                {errors.nextCallDate && (
                  <p className="text-red-500 text-sm mt-1">{errors.nextCallDate}</p>
                )}
              </div>
            )}

            {(fieldVisibility.showOrderQty || fieldVisibility.showOrderedProducts || fieldVisibility.showValueOfOrder) && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {fieldVisibility.showOrderQty && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Order Qty</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ordered Products</label>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Value of Order</label>
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
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Recording...' : 'Record Interaction'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}