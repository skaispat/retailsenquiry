"use client";

import { useState, useEffect } from "react";

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

  // Modal states - Added from previous components
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState("success"); // "success" or "error"
  const [modalMessage, setModalMessage] = useState("");

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

  const [showNotInterestedSection, setShowNotInterestedSection] =
    useState(false);
  const [showPaymentCollectionSection, setShowPaymentCollectionSection] =
    useState(false);
  const [notInterestedReason, setNotInterestedReason] = useState("");
  const [paymentCollection, setPaymentCollection] = useState("");
  const [nextCollectionDate, setNextCollectionDate] = useState("");
  const [whyNotCollection, setWhyNotCollection] = useState("");

  const APPS_SCRIPT_URL =
    "https://script.google.com/macros/s/AKfycby8tWRO5JWFmJmDECvf85x8baVHqXNfePy-w_tpk0ZL3lrby_M2Z9jNoRvlLokFIQ8/exec";

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

  // console.log("Statges:", stages);

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

  const formatDateToDDMMYYYY = (dateString) => {
    console.log("formatDateToDDMMYYYY received:", dateString);

    if (!dateString) return "N/A";

    let date;
    // Regex to match "Date(YYYY,MM,DD,HH,MM,SS)" or "Date(YYYY,MM,DD)"
    // It is important that the month is already 0-indexed if coming from Google Sheets Date() serialization.
    const dateMatch = dateString.match(
      /^Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,(\d{1,2}),(\d{1,2}),(\d{1,2}))?\)$/
    );

    if (dateMatch) {
      const year = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10); // Use directly as it's likely already 0-indexed by the source
      const day = parseInt(dateMatch[3], 10);
      const hours = dateMatch[4] ? parseInt(dateMatch[4], 10) : 0;
      const minutes = dateMatch[5] ? parseInt(dateMatch[5], 10) : 0;
      const seconds = dateMatch[6] ? parseInt(dateMatch[6], 10) : 0;

      console.log(
        `Parsed components: Year=${year}, Month=${month}, Day=${day}, Hours=${hours}, Minutes=${minutes}, Seconds=${seconds}`
      );
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

    const day = String(date.getDate()).padStart(2, "0");
    // Month is 0-indexed in Date object, add 1 for display
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTimestamp = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
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
      // Reset conditional sections
      setShowNotInterestedSection(false);
      setShowPaymentCollectionSection(false);
      return;
    }

    // Handle special stages
    if (formData.stage === "Not Interested") {
      setShowNotInterestedSection(true);
      setShowPaymentCollectionSection(false);
    } else if (formData.stage === "Payment Collection") {
      setShowPaymentCollectionSection(true);
      setShowNotInterestedSection(false);
    } else {
      setShowNotInterestedSection(false);
      setShowPaymentCollectionSection(false);
    }

    const isOrderStage = formData.stage === "Order Received";
    const isOrderNotReceivedStage = formData.stage === "Order Not Received";
    const isFollowUpCallStage = [
      "Follow-Up",
      "Call Not Picked",
      "Introductory Call",
      "Call",
  "First Visit/ Call",
    ].includes(formData.stage);

    // setFieldVisibility({
    //   showCustomerFeedback: isFollowUpCallStage || isOrderNotReceivedStage,
    //   showNextAction: isFollowUpCallStage || isOrderNotReceivedStage,
    //   showNextCallDate: isFollowUpCallStage || isOrderNotReceivedStage,
    //   showOrderQty: isOrderStage,
    //   showOrderedProducts: isOrderStage,
    //   showValueOfOrder: isOrderStage || isOrderNotReceivedStage,
    //   requireStatus: true,
    // });

    setFieldVisibility({
  showCustomerFeedback: (isFollowUpCallStage || isOrderNotReceivedStage) && formData.stage !== "Call Not Picked",
  showNextAction: isFollowUpCallStage || isOrderNotReceivedStage,
  showNextCallDate: isFollowUpCallStage || isOrderNotReceivedStage,
  showOrderQty: isOrderStage,
  showOrderedProducts: isOrderStage,
  showValueOfOrder: (isOrderStage || isOrderNotReceivedStage) && formData.stage !== "Order Not Received",
  requireStatus: true,
});
  }, [formData.stage]);

  useEffect(() => {
    // console.log("TrackerDialog opened or dealerData changed.");

    if (isOpen && dealerData) {
      // console.log("✅ Prop 'dealerData' received:", dealerData);
      // console.log(
      //   "🔎 inspecting 'dealerData.col17' (Last Call Date):",
      //   dealerData.col17
      // );

      // console.log("📊 type of 'dealerData.col17' is:", typeof dealerData.col17);

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
      // console.log("Dialog is closing or does not have data, resetting form.");

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

      // Add these reset lines here
      setNotInterestedReason("");
      setPaymentCollection("");
      setNextCollectionDate("");
      setWhyNotCollection("");
      setShowNotInterestedSection(false);
      setShowPaymentCollectionSection(false);
    }
  }, [isOpen, dealerData]);

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
      showToast("Please correct the errors in the form.", "error");
      return;
    }
    setErrors({});

    setIsSubmitting(true);

    try {
      const dealerCode = dealerData?.col1 || "";
      if (!dealerCode) throw new Error("Dealer code is missing");

      const formattedTimestamp = formatTimestamp();
      // Ensure col17 is passed to formatDateToDDMMYYYY
      const formattedLastDateOfCall = dealerData.col17
        ? formatDateToDDMMYYYY(dealerData.col17)
        : "";
      const formattedNextCallDate = formData.nextCallDate
        ? formatDateToDDMMYYYY(formData.nextCallDate)
        : "";

      // const payload = {
      //   sheetName: "Tracking History",
      //   action: "insert",
      //   rowData: JSON.stringify([
      //     formattedTimestamp,
      //     dealerCode,
      //     formData.stage,
      //     formData.status,
      //     formattedLastDateOfCall,

      //     formData.stage === "Not Interested"
      //       ? notInterestedReason
      //       : formData.stage === "Payment Collection" &&
      //         paymentCollection === "No"
      //       ? whyNotCollection
      //       : formData.customerFeedback,


      //     formData.nextAction, // G
      //     // Column H - conditional data
      //     formData.stage === "Payment Collection" && paymentCollection === "No"
      //       ? nextCollectionDate
      //       : formattedNextCallDate,

      //     formData.customerFeedback,
      //     formData.nextAction,
      //     formattedNextCallDate,
      //     formData.orderQty,
      //     formData.orderedProducts,
      //     formData.valueOfOrder,

      //     "", // L - empty
      //     // Column M - conditional data
      //     formData.stage === "Payment Collection" ? paymentCollection : "",
      //   ]),
      // };


      const payload = {
  sheetName: "Tracking History",
  action: "insert",
  rowData: JSON.stringify([
    formattedTimestamp, // A
    dealerCode, // B
    formData.stage, // C
    formData.status, // D
    formattedLastDateOfCall, // E
    // Column F - conditional data
    formData.stage === "Not Interested" ? notInterestedReason : 
    (formData.stage === "Payment Collection" && paymentCollection === "No" ? whyNotCollection : formData.customerFeedback),
    formData.nextAction, // G
    // Column H - conditional data
    formData.stage === "Payment Collection" && paymentCollection === "No" ? nextCollectionDate : formattedNextCallDate,
    formData.orderQty, // I
    formData.orderedProducts, // J
    formData.valueOfOrder, // K
    "", // L - empty
    // Column M - conditional data
    formData.stage === "Payment Collection" ? paymentCollection : "",
  ]),
};


      const urlEncodedData = new URLSearchParams(payload);
      const response = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: urlEncodedData,
        mode: "no-cors",
      });

      console.log("response from fetch:", response);

      showToast(
        `Tracking data for ${dealerCode} recorded successfully!`,
        "success"
      );

      // Close the dialog after a short delay to allow user to see the success message
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error("Submission error:", error);
      showToast(
        `Error recording data: ${error.message || "Unknown error"}`,
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

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
                    {stages.map((stage) => (
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
                      Collection
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

              {fieldVisibility.showCustomerFeedback && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Feedback
                  </label>
                  <textarea
                    name="customerFeedback"
                    value={formData.customerFeedback}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-md"
                    rows={3}
                    required
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

              {fieldVisibility.showNextCallDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Next Call Date
                  </label>
                  <input
                    type="date"
                    name="nextCallDate"
                    value={formData.nextCallDate}
                    onChange={handleInputChange}
                    className="w-full p-3 border border-gray-300 rounded-md"
                    required
                  />
                  {errors.nextCallDate && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.nextCallDate}
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
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Recording..." : "Record Interaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Centered Modal Popup - Same style as previous components */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-10 flex items-center justify-center z-[60] p-4">
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
    </>
  );
}
