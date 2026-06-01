"use client";

import React, { useState, useEffect, useContext, useMemo, useRef } from "react";
import { Users, Store, ShoppingBag, AlertCircle, X, Target } from "lucide-react";
import MonthlySales from "../components/dashboard/MonthlySales";
import TargetVsAchieved from "../components/dashboard/TargetVsAchieved";
import { AuthContext } from "../App";
import supabase from "../SupaabseClient";

function Dashboard() {
  const { currentUser, isAuthenticated } = useContext(AuthContext);

  const currentUserSalesPersonName =
    currentUser?.salesPersonName || "Unknown User";
  const userRole = currentUser?.role || "User";

  const [isLoading, setIsLoading] = useState(true);
  const [allFMSData, setAllFMSData] = useState([]);
  const [error, setError] = useState(null);

  const [totalCount, setTotalCount] = useState(0);
  const [activeDealersCount, setActiveDealersCount] = useState(0);
  const [totalOrdersCount, setTotalOrdersCount] = useState(0);
  const [pendingEnquiriesCount, setPendingEnquiriesCount] = useState(0);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedSalesperson, setSelectedSalesperson] = useState("");
  const [uniqueSalespersons, setUniqueSalespersons] = useState([]);
  const [selectedMonthDate, setSelectedMonthDate] = useState(new Date());

  const isAdmin = userRole.toLowerCase() === "admin";

  const [isDataDialogOpen, setIsDataDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogData, setDialogData] = useState([]);
  const [dialogHeaders, setDialogHeaders] = useState([]);

  // Set Target state
  const [isSetTargetDialogOpen, setIsSetTargetDialogOpen] = useState(false);
  const [activeSalespersons, setActiveSalespersons] = useState([]);
  const [targets, setTargets] = useState({});
  const [targetIds, setTargetIds] = useState({});
  const [prevTargets, setPrevTargets] = useState({});
  const [isSubmittingTarget, setIsSubmittingTarget] = useState(false);

  const [currentUserTarget, setCurrentUserTarget] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchUserTarget = async () => {
      if (!isAuthenticated || !currentUser) return;

      try {
        const now = new Date();
        const year = now.getFullYear();
        const monthStr = String(now.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();

        const startDate = `${year}-${monthStr}-01`;
        const endDate = `${year}-${monthStr}-${lastDay}`;

        if (isAdmin) {
          const { data, error } = await supabase
            .from("monthly_target")
            .select("target")
            .gte("month", startDate)
            .lte("month", endDate);

          if (error) {
            console.error("Error fetching admin target sum:", error);
            return;
          }

          if (isMounted && data) {
            const sum = data.reduce((acc, curr) => acc + (curr.target || 0), 0);
            setCurrentUserTarget(sum > 0 ? sum : "Not Set");
          }
        } else {
          const { data, error } = await supabase
            .from("monthly_target")
            .select("target")
            .eq("sales_person_name", currentUserSalesPersonName)
            .gte("month", startDate)
            .lte("month", endDate)
            .order("created_at", { ascending: false })
            .limit(1);

          if (error) {
            console.error("Error fetching user target:", error);
            return;
          }

          if (isMounted && data && data.length > 0) {
            setCurrentUserTarget(data[0].target);
          } else if (isMounted) {
            setCurrentUserTarget("Not Set");
          }
        }
      } catch (err) {
        console.error("Error:", err);
      }
    };

    fetchUserTarget();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, currentUser, isAdmin, currentUserSalesPersonName]);

  // Helper function to normalize names (remove spaces and make lowercase)
  const normalizeName = (name) => {
    if (!name) return "";
    return String(name).toLowerCase().replace(/\s+/g, "").trim();
  };

  // FMS columns configuration
  const FMS_COLUMNS_INFO = {
    timestamp: { label: "Timestamp", property: "timestamp", type: "datetime" },
    dealer_code: {
      label: "Dealer Code",
      property: "dealer_code",
      type: "text",
    },
    dealer_name: {
      label: "Dealer Name",
      property: "dealer_name",
      type: "text",
    },
    dealer_region: {
      label: "Dealer Region",
      property: "dealer_region",
      type: "text",
    },
    sales_person_name: {
      label: "Sales Person Name",
      property: "sales_person_name",
      type: "text",
    },
    email: { label: "Email", property: "email", type: "text" },
    contact_no: {
      label: "Contact No",
      property: "contact_number",
      type: "number",
    },
    address: { label: "Address", property: "address", type: "text" },
    last_called_on: {
      label: "Last Called On",
      property: "last_date_of_call",
      type: "date",
    },
    order_status: { label: "Order Status", property: "status", type: "text" },
    customer_feedback: {
      label: "What did the Customer Say",
      property: "what_did_the_customer_say",
      type: "text",
    },
    next_follow_up: {
      label: "Next Follow Up Date",
      property: "next_date_of_call",
      type: "date",
    },
    next_action: {
      label: "Next Action",
      property: "next_action",
      type: "text",
    },
    dealer_size: {
      label: "Dealer Size",
      property: "dealer_size",
      type: "text",
    },
    order_quantity: {
      label: "Order Quantity",
      property: "order_qty",
      type: "number",
    },
    ordered_products: {
      label: "Ordered Products",
      property: "order_products",
      type: "text",
    },
    value_of_order: {
      label: "Value of Order",
      property: "value_of_order",
      type: "number",
    },
    last_order_before: {
      label: "Last Order Before",
      property: "last_order_before",
      type: "date",
    },
    area_name: { label: "Area Name", property: "area_name", type: "text" },
    select_value: {
      label: "Select Value",
      property: "select_value",
      type: "text",
    },
    planned: { label: "Planned", property: "planned", type: "text" },
    actual: { label: "Actual", property: "actual", type: "text" },
  };

  const FMS_DISPLAY_COLUMNS_FOR_DIALOG = [
    "dealer_name",
    "last_called_on",
    "customer_feedback",
    "sales_person_name",
    "dealer_code",
    "contact_no",
    "next_follow_up",
    "dealer_region",
    "order_status",
    "next_action",
    "dealer_size",
    "order_quantity",
    "ordered_products",
    "value_of_order",
    "last_order_before",
    "area_name",
    "select_value",
    "planned",
    "actual",
  ];

  const formatDate = (dateValue) => {
    if (!dateValue) return "—";
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) {
        return dateValue;
      }
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error(
        "Date formatting error:",
        error,
        "Original value:",
        dateValue,
      );
      return dateValue;
    }
  };

  // Helper function to parse date from various formats
  const parseSupabaseDate = (dateString) => {
    if (!dateString) return null;

    try {
      const cleanedDate = dateString.toString().trim();

      // 1. Handle DD/MM/YYYY format
      if (cleanedDate.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        const parts = cleanedDate.split("/");
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }

      // 2. Handle YYYY-MM-DD format
      if (cleanedDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return new Date(cleanedDate);
      }

      // 3. Handle other formats with fallback
      return new Date(cleanedDate);
    } catch (error) {
      console.error("Date parsing error:", error);
      return null;
    }
  };

  // Filter data based on salesperson and timestamp
  const currentFilteredData = useMemo(() => {
    if (allFMSData.length === 0 || !isAuthenticated || !currentUser) {
      return [];
    }

    let tempFilteredData = [...allFMSData];

    // Apply salesperson filter for admin users
    if (
      isAdmin &&
      selectedSalesperson &&
      selectedSalesperson !== "All Salespersons"
    ) {
      const selectedSalespersonNormalized = normalizeName(selectedSalesperson);
      tempFilteredData = tempFilteredData.filter(
        (row) =>
          row.sales_person_name_normalized === selectedSalespersonNormalized,
      );
    }

    // Apply date filtering by timestamp
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      tempFilteredData = tempFilteredData.filter((row) => {
        const timestampToUse = row.timestamp_raw || row.timestamp;
        if (!timestampToUse) return false;

        try {
          let rowDate;
          if (typeof timestampToUse === "string") {
            let isoTimestamp = timestampToUse.trim();
            if (isoTimestamp.includes(" "))
              isoTimestamp = isoTimestamp.replace(" ", "T");
            if (isoTimestamp.match(/[+-]\d{2}$/))
              isoTimestamp = isoTimestamp + ":00";
            rowDate = new Date(isoTimestamp);
          } else {
            rowDate = new Date(timestampToUse);
          }

          if (isNaN(rowDate.getTime())) return false;
          return rowDate >= start && rowDate <= end;
        } catch (error) {
          return false;
        }
      });
    }

    return tempFilteredData;
  }, [
    allFMSData,
    startDate,
    endDate,
    isAdmin,
    selectedSalesperson,
    isAuthenticated,
    currentUser,
  ]);

  // Fetch data from Supabase
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!isMounted) return;
      setIsLoading(true);
      setError(null);

      if (!isAuthenticated || !currentUser) {
        if (isMounted) {
          setIsLoading(false);
          setError("Please log in to view the dashboard.");
        }
        return;
      }

      try {
        let allFetchedData = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;
        const MAX_RECORDS = 50000; // Production safety limit to prevent memory crashes

        while (hasMore && isMounted && allFetchedData.length < MAX_RECORDS) {
          const { data, error } = await supabase
            .from("FMS")
            .select("*")
            .order("timestamp", { ascending: false })
            .range(from, from + step - 1);

          if (error) {
            throw new Error(`Supabase error: ${error.message}`);
          }

          if (data && data.length > 0) {
            allFetchedData = [...allFetchedData, ...data];
            from += step;
            if (data.length < step) {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }

        if (!isMounted) return;
        const data = allFetchedData;

        if (data && data.length > 0) {
          const currentUserNormalizedName = normalizeName(
            currentUserSalesPersonName,
          );

          const allRows = data.map((row) => {
            const rowData = {
              id: row.id,
              timestamp: row.timestamp,
              timestamp_raw: row.timestamp,
              // FIXED: Use dc_dealer_code as dealer_code
              dealer_code: row.dc_dealer_code || row.dealer_code || null,
              dealer_name: row.dealer_name,
              dealer_region: row.dealer_region || row.district_name,
              sales_person_name: row.sales_person_name,
              email: row.email || row.email_address,
              contact_number: row.contact_number || row.contact_no,
              address: row.address,
              last_date_of_call: row.last_date_of_call,
              status: row.status,
              stage: row.stage,
              what_did_the_customer_say:
                row.what_did_the_customer_say || row.what_did_live_costs,
              next_date_of_call: row.next_date_of_call,
              next_action: row.next_action || row.next_sector,
              dealer_size: row.dealer_size,
              order_qty: row.order_qty,
              order_products: row.order_products || row.order_problem,
              value_of_order: row.value_of_order,
              last_order_before: row.last_order_before,
              area_name: row.area_name,
              select_value: row.select_value,
              planned: row.planned,
              actual: row.actual,
              sales_person_name_normalized: normalizeName(
                row.sales_person_name,
              ),
            };

            // Format date fields
            Object.keys(FMS_COLUMNS_INFO).forEach((key) => {
              const columnInfo = FMS_COLUMNS_INFO[key];
              if (columnInfo.property === "timestamp") {
                return;
              }
              if (
                (columnInfo.type === "date" ||
                  columnInfo.type === "datetime") &&
                rowData[columnInfo.property]
              ) {
                rowData[columnInfo.property] = formatDate(
                  rowData[columnInfo.property],
                );
              }
            });

            return rowData;
          });

          // Filter by salesperson for non-admin users
          let filteredRows = allRows;
          if (!isAdmin) {
            filteredRows = allRows.filter(
              (row) =>
                row.sales_person_name_normalized === currentUserNormalizedName,
            );
          }

          if (isMounted) {
            setAllFMSData(filteredRows);
          }

          // Extract unique salespersons
          const salespersons = new Set();
          filteredRows.forEach((row) => {
            const salespersonName = row.sales_person_name;
            if (
              salespersonName &&
              typeof salespersonName === "string" &&
              salespersonName.trim() !== ""
            ) {
              salespersons.add(salespersonName.trim());
            }
          });

          if (isMounted) {
            setUniqueSalespersons([...Array.from(salespersons).sort()]);
          }
        } else {
          if (isMounted) {
            setAllFMSData([]);
            setUniqueSalespersons([]);
            setError("No data found in the FMS table.");
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        if (isMounted) setError(`Failed to load data: ${error.message}`);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [
    isAuthenticated,
    currentUser,
    currentUserSalesPersonName,
    userRole,
    isAdmin,
  ]);

  // Calculate all counts
  // FIXED: Calculate all counts with proper active dealer logic
  useEffect(() => {
    if (allFMSData.length === 0) {
      setTotalCount(0);
      setActiveDealersCount(0);
      setTotalOrdersCount(0);
      setPendingEnquiriesCount(0);
      return;
    }

    // Start with all data
    let dataForCounts = [...allFMSData];

    // 1. Apply salesperson filter if selected (for all counts)
    if (
      isAdmin &&
      selectedSalesperson &&
      selectedSalesperson !== "All Salespersons"
    ) {
      const selectedSalespersonNormalized = normalizeName(selectedSalesperson);
      dataForCounts = dataForCounts.filter(
        (row) =>
          row.sales_person_name_normalized === selectedSalespersonNormalized,
      );
    }

    // console.log(
    //   "🔍 Data after salesperson filter for counts:",
    //   dataForCounts.length,
    // );

    // 2. TOTAL COUNT: Filter by timestamp when dates are selected
    let totalFilteredData = [...dataForCounts];
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      totalFilteredData = totalFilteredData.filter((row) => {
        const timestampToUse = row.timestamp_raw || row.timestamp;
        if (!timestampToUse) return false;

        try {
          let rowDate;
          if (typeof timestampToUse === "string") {
            let isoTimestamp = timestampToUse.trim();
            if (isoTimestamp.includes(" "))
              isoTimestamp = isoTimestamp.replace(" ", "T");
            if (isoTimestamp.match(/[+-]\d{2}$/))
              isoTimestamp = isoTimestamp + ":00";
            rowDate = new Date(isoTimestamp);
          } else {
            rowDate = new Date(timestampToUse);
          }

          if (isNaN(rowDate.getTime())) return false;
          return rowDate >= start && rowDate <= end;
        } catch (error) {
          return false;
        }
      });
    }

    setTotalCount(totalFilteredData.length);
    // console.log(
    //   "📊 Total records count (timestamp filtered):",
    //   totalFilteredData.length,
    // );

    // 3. TOTAL ORDERS COUNT: Use timestamp-filtered data
    const ordersCount = totalFilteredData.filter((row) => {
      return row.value_of_order && String(row.value_of_order).trim() !== "";
    }).length;
    setTotalOrdersCount(ordersCount);
    // console.log("📊 Total orders count:", ordersCount);

    // 4. PENDING ENQUIRIES COUNT: Use timestamp-filtered data
    const pendingCount = totalFilteredData.filter((row) => {
      const planned = row.planned;
      const actual = row.actual;
      return (
        planned !== null &&
        planned !== undefined &&
        planned !== "" &&
        (actual === null || actual === undefined || actual === "")
      );
    }).length;
    setPendingEnquiriesCount(pendingCount);
    // console.log("📊 Pending enquiries count:", pendingCount);

    // 5. ACTIVE DEALERS COUNT: SPECIAL LOGIC - ONLY when stage is "Order Received"
    // console.log("🎯 ========== ACTIVE DEALERS CALCULATION ==========");

    const activeDealers = new Set();
    const activeDealerDetails = [];

    // Start with dataForCounts (already filtered by salesperson if needed)
    let dataForActiveDealers = [...dataForCounts];

    // console.log(
    //   "📊 Total records to check for active dealers:",
    //   dataForActiveDealers.length,
    // );

    // Step 1: Filter by stage = "Order Received"
    const orderReceivedRecords = dataForActiveDealers.filter((row) => {
      const stage = row.stage || "";
      const normalizedStage = stage.toString().trim().toLowerCase();
      return normalizedStage === "order received";
    });

    // console.log(
    //   "📊 Records with stage = 'Order Received':",
    //   orderReceivedRecords.length,
    // );

    // Debug: Show first few order received records
    if (orderReceivedRecords.length > 0) {
      // console.log("🔍 Sample of 'Order Received' records (first 5):");
      orderReceivedRecords.slice(0, 5).forEach((row, index) => {
        // console.log(`Record ${index + 1}:`, {
        //   dealer_code: row.dealer_code,
        //   dealer_name: row.dealer_name,
        //   stage: row.stage,
        //   status: row.status,
        //   last_date_of_call: row.last_date_of_call,
        //   sales_person_name: row.sales_person_name,
        // });
      });
    }

    // Step 2: Apply date filter to last_date_of_call if dates are selected
    let filteredOrderReceivedRecords = [...orderReceivedRecords];

    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // console.log("🕐 Filtering by last_date_of_call date range:", {
      //   start: start.toISOString(),
      //   end: end.toISOString(),
      //   formattedStart: start.toLocaleDateString("en-GB"),
      //   formattedEnd: end.toLocaleDateString("en-GB"),
      // });

      filteredOrderReceivedRecords = filteredOrderReceivedRecords.filter(
        (row) => {
          const lastCallDate = row.last_date_of_call;
          if (!lastCallDate) {
            // console.log(
            //   "❌ No last_date_of_call for dealer:",
            //   row.dealer_code,
            //   row.dealer_name,
            // );
            return false;
          }

          try {
            const parsedDate = parseSupabaseDate(lastCallDate);
            if (!parsedDate || isNaN(parsedDate.getTime())) {
              // console.log(
              //   "❌ Could not parse date:",
              //   lastCallDate,
              //   "for dealer:",
              //   row.dealer_code,
              // );
              return false;
            }

            const isInRange = parsedDate >= start && parsedDate <= end;

            if (isInRange) {
              // console.log("✅ Date in range:", {
              //   dealer_code: row.dealer_code,
              //   last_date_of_call: lastCallDate,
              //   parsedDate: parsedDate.toISOString(),
              // });
            }

            return isInRange;
          } catch (error) {
            console.error("Date filtering error:", error);
            return false;
          }
        },
      );

      // console.log(
      //   "📊 Records after last_date_of_call date filtering:",
      //   filteredOrderReceivedRecords.length,
      // );
    }

    // Step 3: Count unique dealers
    filteredOrderReceivedRecords.forEach((row) => {
      const dealerCode = row.dealer_code;
      if (!dealerCode || dealerCode.trim() === "") {
        return;
      }

      if (!activeDealers.has(dealerCode)) {
        activeDealers.add(dealerCode);
        activeDealerDetails.push({
          dealer_code: dealerCode,
          dealer_name: row.dealer_name,
          last_date_of_call: row.last_date_of_call,
          stage: row.stage,
          status: row.status,
          sales_person_name: row.sales_person_name,
        });

        // console.log("✅ ADDED Active Dealer:", {
        //   dealer_code: dealerCode,
        //   dealer_name: row.dealer_name,
        //   stage: row.stage,
        //   last_date_of_call: row.last_date_of_call,
        //   sales_person_name: row.sales_person_name,
        // });
      }
    });

    const activeDealersCount = activeDealers.size;

    // console.log("\n🎯 ========== ACTIVE DEALERS SUMMARY ==========");
    // console.log("📊 Unique active dealers found:", activeDealersCount);
    // console.log(
    //   "📊 Active dealer details (first 10):",
    //   activeDealerDetails.slice(0, 10),
    // );
    // console.log("📊 Active dealer codes:", Array.from(activeDealers));

    setActiveDealersCount(activeDealersCount);

    // console.log("\n📈 ========== FINAL COUNTS SUMMARY ==========");
    // console.log("📊 Total Records:", totalFilteredData.length);
    // console.log("📊 Active Dealers:", activeDealersCount);
    // console.log("📊 Total Orders:", ordersCount);
    // console.log("📊 Pending Enquiries:", pendingCount);
    // console.log(
    //   "📝 Active dealers: stage='Order Received' + last_date_of_call date filter",
    // );
  }, [allFMSData, startDate, endDate, isAdmin, selectedSalesperson]);

  const handleSetTargetClick = async () => {
    setIsSetTargetDialogOpen(true);
    try {
      const { data: usersData, error: usersError } = await supabase
        .from("master")
        .select("sales_person_name")
        .eq("status", "TRUE")
        .eq("role", "User");

      if (usersError) throw usersError;

      let uniqueNames = [];
      if (usersData) {
        uniqueNames = [
          ...new Set(usersData.map((d) => d.sales_person_name).filter(Boolean)),
        ].sort();
        setActiveSalespersons(uniqueNames);
      }

      // Fetch existing targets for the current and previous month
      const now = new Date();
      const year = now.getFullYear();
      const monthStr = String(now.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();

      const startDate = `${year}-${monthStr}-01`;
      const endDate = `${year}-${monthStr}-${lastDay}`;

      // Previous month
      let prevYear = year;
      let prevMonthNum = now.getMonth(); // 0 to 11
      if (prevMonthNum === 0) {
        prevMonthNum = 12;
        prevYear -= 1;
      }
      const prevMonthStr = String(prevMonthNum).padStart(2, '0');
      const prevLastDay = new Date(prevYear, prevMonthNum, 0).getDate();
      const prevStartDate = `${prevYear}-${prevMonthStr}-01`;
      const prevEndDate = `${prevYear}-${prevMonthStr}-${prevLastDay}`;

      const { data: targetsData, error: targetsError } = await supabase
        .from("monthly_target")
        .select("*")
        .gte("month", prevStartDate)
        .lte("month", endDate);

      if (targetsError && targetsError.code !== 'PGRST116') {
        console.error("Error fetching existing targets:", targetsError);
      }

      const initialTargets = {};
      const initialTargetIds = {};
      const initialPrevTargets = {};

      uniqueNames.forEach(name => {
        initialTargets[name] = "";
        initialPrevTargets[name] = "—";
      });

      if (targetsData) {
        // Find targets that fall within the current month or previous month
        targetsData.forEach(t => {
          if (!uniqueNames.includes(t.sales_person_name)) return;

          if (t.month >= startDate && t.month <= endDate) {
            initialTargets[t.sales_person_name] = t.target;
            initialTargetIds[t.sales_person_name] = t.id;
          } else if (t.month >= prevStartDate && t.month <= prevEndDate) {
            initialPrevTargets[t.sales_person_name] = t.target;
          }
        });
      }

      setTargets(initialTargets);
      setTargetIds(initialTargetIds);
      setPrevTargets(initialPrevTargets);
    } catch (err) {
      console.error("Error fetching active sales persons or targets:", err);
    }
  };

  const handleTargetChange = (name, value) => {
    setTargets(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTargetSubmit = async (e) => {
    e.preventDefault();
    setIsSubmittingTarget(true);
    try {
      // Calculate precise IST time to avoid UTC day rollover issues
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
      const istDate = new Date(now.getTime() + istOffset);

      const currentMonthDate = istDate.toISOString().split("T")[0]; // YYYY-MM-DD strictly in IST
      const currentTimestamp = istDate.toISOString().replace("Z", "+05:30"); // ISO8601 with +05:30 offset

      const inserts = [];
      const updates = [];

      activeSalespersons.forEach((name) => {
        if (targets[name] !== undefined && targets[name].toString().trim() !== "") {
          const record = {
            sales_person_name: name,
            target: parseFloat(targets[name]),
          };

          if (targetIds[name]) {
            // Update existing
            record.id = targetIds[name];
            updates.push(record);
          } else {
            // Insert new
            record.month = currentMonthDate;
            record.created_at = currentTimestamp;
            inserts.push(record);
          }
        }
      });

      if (inserts.length === 0 && updates.length === 0) {
        alert("Please enter at least one target value.");
        setIsSubmittingTarget(false);
        return;
      }

      // Execute inserts
      if (inserts.length > 0) {
        const { error: insertError } = await supabase
          .from("monthly_target")
          .insert(inserts);
        if (insertError) throw insertError;
      }

      // Execute updates
      if (updates.length > 0) {
        await Promise.all(
          updates.map(async (record) => {
            const { error: updateError } = await supabase
              .from("monthly_target")
              .update({ target: record.target })
              .eq("id", record.id);
            if (updateError) throw updateError;
          })
        );
      }

      // console.log("Submit Targets success");

      setIsSetTargetDialogOpen(false);
      setTargets({});
      setTargetIds({});
    } catch (error) {
      console.error("Error saving targets:", error);
      alert("Failed to save targets: " + error.message);
    } finally {
      setIsSubmittingTarget(false);
    }
  };

  const handleCardClick = (kpiType) => {
    let dataForDialog = [];
    let title = "";

    let headers = FMS_DISPLAY_COLUMNS_FOR_DIALOG.map(
      (columnKey) => FMS_COLUMNS_INFO[columnKey],
    ).filter(Boolean);

    // Apply base filters
    let baseData = [...allFMSData];
    if (
      isAdmin &&
      selectedSalesperson &&
      selectedSalesperson !== "All Salespersons"
    ) {
      const selectedSalespersonNormalized = normalizeName(selectedSalesperson);
      baseData = baseData.filter(
        (row) =>
          row.sales_person_name_normalized === selectedSalespersonNormalized,
      );
    }

    if (kpiType === "totalRecords") {
      title = "All Records";
      headers = headers.slice(0, 4);
      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dataForDialog = baseData.filter((row) => {
          const timestampToUse = row.timestamp_raw || row.timestamp;
          if (!timestampToUse) return false;
          try {
            let rowDate;
            if (typeof timestampToUse === "string") {
              let isoTimestamp = timestampToUse.trim();
              if (isoTimestamp.includes(" "))
                isoTimestamp = isoTimestamp.replace(" ", "T");
              if (isoTimestamp.match(/[+-]\d{2}$/))
                isoTimestamp = isoTimestamp + ":00";
              rowDate = new Date(isoTimestamp);
            } else {
              rowDate = new Date(timestampToUse);
            }
            if (isNaN(rowDate.getTime())) return false;
            return rowDate >= start && rowDate <= end;
          } catch (error) {
            return false;
          }
        });
      } else {
        dataForDialog = baseData;
      }
    } else if (kpiType === "activeDealers") {
      title = "Active Dealers";

      const activeDealersColumnsOrder = [
        "dealer_name",
        "dealer_region",
        "sales_person_name",
      ];
      headers = activeDealersColumnsOrder
        .map((columnKey) => FMS_COLUMNS_INFO[columnKey])
        .filter(Boolean);

      const uniqueDealerCodes = new Set();

      // Start with base data
      let tempData = [...baseData];

      // Step 1: Filter by stage = "Order Received"
      tempData = tempData.filter((row) => {
        const stage = row.stage || "";
        const normalizedStage = stage.toString().trim().toLowerCase();
        return normalizedStage === "order received";
      });

      // console.log(
      //   "📋 Active dealers dialog: Found",
      //   tempData.length,
      //   "records with 'Order Received' stage",
      // );

      // Step 2: Apply date filter to last_date_of_call if dates are selected
      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        tempData = tempData.filter((row) => {
          const lastCallDate = row.last_date_of_call;
          if (!lastCallDate) return false;
          try {
            const parsedDate = parseSupabaseDate(lastCallDate);
            if (!parsedDate || isNaN(parsedDate.getTime())) return false;
            return parsedDate >= start && parsedDate <= end;
          } catch (error) {
            return false;
          }
        });

        // console.log(
        //   "📋 Active dealers dialog: After date filtering:",
        //   tempData.length,
        //   "records",
        // );
      }

      // Get unique dealers
      tempData.forEach((row) => {
        const dealerCode = row.dealer_code;
        if (!dealerCode) return;

        if (!uniqueDealerCodes.has(dealerCode)) {
          uniqueDealerCodes.add(dealerCode);
          dataForDialog.push(row);
        }
      });

      // console.log("📋 Active dealers dialog data count:", dataForDialog.length);
    } else if (kpiType === "totalOrders") {
      title = "Total Orders";
      const totalOrdersColumnsOrder = [
        "dealer_name",
        "sales_person_name",
        "order_quantity",
        "last_order_before",
      ];
      headers = totalOrdersColumnsOrder
        .map((columnKey) => FMS_COLUMNS_INFO[columnKey])
        .filter(Boolean);

      let tempData = [...baseData];
      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        tempData = tempData.filter((row) => {
          const timestampToUse = row.timestamp_raw || row.timestamp;
          if (!timestampToUse) return false;
          try {
            let rowDate;
            if (typeof timestampToUse === "string") {
              let isoTimestamp = timestampToUse.trim();
              if (isoTimestamp.includes(" "))
                isoTimestamp = isoTimestamp.replace(" ", "T");
              if (isoTimestamp.match(/[+-]\d{2}$/))
                isoTimestamp = isoTimestamp + ":00";
              rowDate = new Date(isoTimestamp);
            } else {
              rowDate = new Date(timestampToUse);
            }
            if (isNaN(rowDate.getTime())) return false;
            return rowDate >= start && rowDate <= end;
          } catch (error) {
            return false;
          }
        });
      }
      dataForDialog = tempData.filter(
        (row) => row.value_of_order && String(row.value_of_order).trim() !== "",
      );
    } else if (kpiType === "pendingEnquiries") {
      title = "Pending Enquiries";
      let tempData = [...baseData];
      if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        tempData = tempData.filter((row) => {
          const timestampToUse = row.timestamp_raw || row.timestamp;
          if (!timestampToUse) return false;
          try {
            let rowDate;
            if (typeof timestampToUse === "string") {
              let isoTimestamp = timestampToUse.trim();
              if (isoTimestamp.includes(" "))
                isoTimestamp = isoTimestamp.replace(" ", "T");
              if (isoTimestamp.match(/[+-]\d{2}$/))
                isoTimestamp = isoTimestamp + ":00";
              rowDate = new Date(isoTimestamp);
            } else {
              rowDate = new Date(timestampToUse);
            }
            if (isNaN(rowDate.getTime())) return false;
            return rowDate >= start && rowDate <= end;
          } catch (error) {
            return false;
          }
        });
      }
      dataForDialog = tempData.filter((row) => {
        const planned = row.planned;
        const actual = row.actual;
        return (
          planned !== null &&
          planned !== undefined &&
          planned !== "" &&
          (actual === null || actual === undefined || actual === "")
        );
      });
    }

    setDialogTitle(title);
    setDialogData(dataForDialog);
    setDialogHeaders(headers);
    setIsDataDialogOpen(true);
  };

  const getGreeting = () => {
    const currentHour = new Date().getHours();
    if (currentHour >= 5 && currentHour < 12) return "Good morning";
    if (currentHour >= 12 && currentHour < 17) return "Good afternoon";
    return "Good evening";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-b-2 border-green-600 rounded-full animate-spin"></div>
          <p className="font-medium text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error && allFMSData.length === 0) {
    return (
      <div className="min-h-screen p-3 bg-gradient-to-br from-slate-50 via-red-50 to-rose-50 sm:p-6">
        <div className="mx-auto space-y-4 max-w-7xl sm:space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 sm:space-y-2">
              <h1 className="text-2xl font-bold text-transparent sm:text-3xl md:text-4xl bg-gradient-to-r from-[#800000] via-[#a30000] to-[#cc0000] bg-clip-text">
                Dashboard
              </h1>
              <p className="text-sm font-medium sm:text-base md:text-lg text-slate-600">
                {getGreeting()}, {currentUserSalesPersonName}!
              </p>
            </div>
          </div>
          <div className="p-6 text-center border rounded-lg shadow-md bg-white/80 backdrop-blur-sm sm:rounded-xl sm:shadow-lg border-white/20">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-3 bg-gradient-to-br from-slate-50 via-red-50 to-rose-50 sm:p-6">
      <div className="mx-auto space-y-4 max-w-7xl sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start justify-between sm:block w-full sm:w-auto">
            <div className="space-y-1 sm:space-y-2">
              <h1 className="text-2xl font-bold text-transparent sm:text-3xl md:text-4xl bg-gradient-to-r from-[#800000] via-[#a30000] to-[#cc0000] bg-clip-text">
                Dashboard
              </h1>
            </div>

            {/* Mobile Target Box */}
            {currentUserTarget !== null && (
              <div className="sm:hidden px-4 py-1.5 rounded-lg shadow-md bg-gradient-to-br from-[#990000] via-[#800000] to-[#660000] flex items-center justify-center min-w-[110px] border border-white/20 mt-1">
                <span className="text-xs font-bold text-white tracking-wide">Target : {currentUserTarget} Tons</span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center w-full lg:w-auto mt-2 sm:mt-0">
            {/* Desktop Target Box */}
            {currentUserTarget !== null && (
              <div className="hidden sm:flex px-5 py-2 sm:py-2.5 rounded-lg shadow-md sm:rounded-xl sm:shadow-lg bg-gradient-to-br from-[#990000] via-[#800000] to-[#660000] items-center justify-center min-w-[140px] border border-white/20">
                <span className="text-sm sm:text-base font-bold text-white tracking-wide">Target : {currentUserTarget} Tons</span>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-x-4 sm:gap-x-8 gap-y-3 px-4 py-3 border rounded-lg shadow-md bg-white/80 backdrop-blur-sm sm:rounded-xl sm:shadow-lg border-white/20 w-full lg:w-auto">
              {/* From */}
              <div className="flex items-center gap-2 text-slate-700">
                <label
                  htmlFor="startDate"
                  className="text-xs font-semibold text-[#800000] sm:text-sm md:text-base whitespace-nowrap"
                >
                  From:
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="p-1 text-xs border border-gray-300 rounded-md sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#800000] bg-white"
                />
              </div>

              {/* To */}
              <div className="flex items-center gap-2 text-slate-700">
                <label
                  htmlFor="endDate"
                  className="text-xs font-semibold text-[#800000] sm:text-sm md:text-base whitespace-nowrap"
                >
                  To:
                </label>
                <input
                  type="date"
                  id="endDate"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="p-1 text-xs border border-gray-300 rounded-md sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#800000] bg-white"
                />
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2 text-slate-700">
                  {/* <label
                  htmlFor="salespersonFilter"
                  className="text-xs font-semibold text-[#800000] sm:text-sm md:text-base whitespace-nowrap"
                >
                  Salesperson:
                </label> */}
                  <select
                    id="salespersonFilter"
                    value={selectedSalesperson}
                    onChange={(e) => setSelectedSalesperson(e.target.value)}
                    className="p-1 text-xs border border-gray-300 rounded-md sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#800000] bg-white min-w-[140px] max-w-[180px]"
                  >
                    <option value="">Area Sales Managers</option>
                    {uniqueSalespersons.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {currentUser?.username === 'admin' && (
                <div className="flex items-center gap-2 text-slate-700">
                  <span><pre>  </pre></span>
                  <button
                    onClick={handleSetTargetClick}
                    className="flex items-center justify-center gap-1.5 p-1.5 px-3 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-[#800000] to-[#b30000] rounded-md focus:outline-none focus:ring-2 focus:ring-[#800000] focus:ring-offset-1 min-w-[140px] max-w-[180px] shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer"
                  >
                    <Target className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                    Set Target
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Records Card */}
          <div
            className="bg-white/80 backdrop-blur-sm rounded-lg sm:rounded-xl shadow-md sm:shadow-lg border border-white/20 overflow-hidden group active:scale-[0.99] sm:hover:scale-[1.02] transition-all duration-300 cursor-pointer"
            onClick={() => handleCardClick("totalRecords")}
          >
            <div className="h-full p-3 bg-gradient-to-br from-[#990000] via-[#800000] to-[#660000] sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[0.65rem] xs:text-xs sm:text-sm font-semibold text-red-100 uppercase tracking-wider mb-1">
                    Total Records
                  </h3>
                  <div className="mb-1 text-xl font-bold text-white sm:text-2xl md:text-3xl">
                    {totalCount.toLocaleString()}
                  </div>
                </div>
                <div className="bg-white/20 p-1.5 sm:p-3 rounded-md sm:rounded-lg">
                  <Users className="w-5 h-5 text-white sm:h-6 sm:w-6 md:h-8 md:w-8" />
                </div>
              </div>
            </div>
          </div>
          {/* Active Dealers Card */}
          <div
            className="bg-white/80 backdrop-blur-sm rounded-lg sm:rounded-xl shadow-md sm:shadow-lg border border-white/20 overflow-hidden group active:scale-[0.99] sm:hover:scale-[1.02] transition-all duration-300 cursor-pointer"
            onClick={() => handleCardClick("activeDealers")}
          >
            <div className="h-full p-3 bg-gradient-to-br from-[#8A0000] via-[#730000] to-[#590000] sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[0.65rem] xs:text-xs sm:text-sm font-semibold text-red-100 uppercase tracking-wider mb-1">
                    Active Dealers
                  </h3>
                  <div className="mb-1 text-xl font-bold text-white sm:text-2xl md:text-3xl">
                    {activeDealersCount}
                  </div>
                </div>
                <div className="bg-white/20 p-1.5 sm:p-3 rounded-md sm:rounded-lg">
                  <Store className="w-5 h-5 text-white sm:h-6 sm:w-6 md:h-8 md:w-8" />
                </div>
              </div>
            </div>
          </div>
          {/* Total Orders Card */}
          <div
            className="bg-white/80 backdrop-blur-sm rounded-lg sm:rounded-xl shadow-md sm:shadow-lg border border-white/20 overflow-hidden group active:scale-[0.99] sm:hover:scale-[1.02] transition-all duration-300 cursor-pointer"
            onClick={() => handleCardClick("totalOrders")}
          >
            <div className="h-full p-3 bg-gradient-to-br from-[#b30000] via-[#990000] to-[#800000] sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[0.65rem] xs:text-xs sm:text-sm font-semibold text-red-100 uppercase tracking-wider mb-1">
                    Total Orders
                  </h3>
                  <div className="mb-1 text-xl font-bold text-white sm:text-2xl md:text-3xl">
                    {totalOrdersCount.toLocaleString()}
                  </div>
                </div>
                <div className="bg-white/20 p-1.5 sm:p-3 rounded-md sm:rounded-lg">
                  <ShoppingBag className="w-5 h-5 text-white sm:h-6 sm:w-6 md:h-8 md:w-8" />
                </div>
              </div>
            </div>
          </div>
          {/* Pending Enquiries Card */}
          <div
            className="bg-white/80 backdrop-blur-sm rounded-lg sm:rounded-xl shadow-md sm:shadow-lg border border-white/20 overflow-hidden group active:scale-[0.99] sm:hover:scale-[1.02] transition-all duration-300 cursor-pointer"
            onClick={() => handleCardClick("pendingEnquiries")}
          >
            <div className="p-3 bg-gradient-to-br from-[#800000] via-[#660000] to-[#4D0000] sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[0.65rem] xs:text-xs sm:text-sm font-semibold text-red-100 uppercase tracking-wider mb-1">
                    Pending Enquiries
                  </h3>
                  <div className="mb-1 text-xl font-bold text-white sm:text-2xl md:text-3xl">
                    {pendingEnquiriesCount}
                  </div>
                </div>
                <div className="bg-white/20 p-1.5 sm:p-3 rounded-md sm:rounded-lg">
                  <AlertCircle className="w-5 h-5 text-white sm:h-6 sm:w-6 md:h-8 md:w-8" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Pass filteredData and FMS_COLUMNS_INFO to chart components */}
          <MonthlySales
            isAdmin={isAdmin}
            currentUserSalesPersonName={currentUserSalesPersonName}
            selectedSalesperson={selectedSalesperson}
            currentDate={selectedMonthDate}
            setCurrentDate={setSelectedMonthDate}
          />
          <TargetVsAchieved
            isAdmin={isAdmin}
            currentUserSalesPersonName={currentUserSalesPersonName}
            selectedSalesperson={selectedSalesperson}
            currentDate={selectedMonthDate}
          />
        </div>
      </div>

      {isDataDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-0">
          <div className="relative w-full max-w-4xl h-[50vh] rounded-lg sm:rounded-xl bg-white/90 backdrop-blur-sm p-6 shadow-2xl animate-in zoom-in-95 max-h-[70vh] overflow-hidden transform scale-100 opacity-100 border border-white/30">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-transparent bg-gradient-to-r from-[#800000] via-[#a30000] to-[#cc0000] bg-clip-text">
                {dialogTitle}
                {selectedSalesperson &&
                  selectedSalesperson !== "All Salespersons" &&
                  isAdmin && (
                    <span className="ml-2 text-lg font-medium text-gray-500">
                      ({selectedSalesperson})
                    </span>
                  )}
              </h2>
              <button
                onClick={() => setIsDataDialogOpen(false)}
                className="p-2 text-gray-500 transition-colors rounded-full hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-auto h-[calc(50vh-140px)] border border-gray-200 rounded-lg">
              <div className="min-w-full">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="sticky top-0 z-10 bg-gray-100">
                    <tr>
                      {dialogHeaders.map((header) => (
                        <th
                          key={header.property}
                          scope="col"
                          className="px-6 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase whitespace-nowrap"
                        >
                          {header.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {dialogData.length === 0 ? (
                      <tr>
                        <td
                          colSpan={dialogHeaders.length}
                          className="px-6 py-12 text-base font-medium text-center text-gray-500"
                        >
                          No data available for this selection.
                        </td>
                      </tr>
                    ) : (
                      dialogData.map((row, rowIndex) => (
                        <tr
                          key={row.id || `row-${rowIndex}`}
                          className="hover:bg-gray-50"
                        >
                          {dialogHeaders.map((header) => (
                            <td
                              key={`${row.id}-${header.property}`}
                              className={`px-6 py-4 text-sm text-gray-800 ${header.property === "dealer_name"
                                ? "whitespace-normal break-words min-w-[200px] max-w-[300px]"
                                : "whitespace-nowrap"
                                }`}
                            >
                              {row[header.property] || "—"}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Set Target Modal */}
      {isSetTargetDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in-0">
          <div className="relative w-full max-w-2xl max-h-[90vh] rounded-lg sm:rounded-xl bg-white/90 backdrop-blur-sm shadow-2xl animate-in zoom-in-95 border border-white/30 flex flex-col">
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-[#800000]">Set Target</h2>
              <button
                onClick={() => setIsSetTargetDialogOpen(false)}
                className="p-2 text-gray-500 transition-colors rounded-full hover:bg-gray-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <form id="targetForm" onSubmit={handleTargetSubmit} className="space-y-4">
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Sales Person
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Prev Month Target
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Target Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {activeSalespersons.length === 0 ? (
                        <tr>
                          <td colSpan="3" className="px-6 py-4 text-center text-sm text-gray-500">
                            No active sales persons found.
                          </td>
                        </tr>
                      ) : (
                        activeSalespersons.map((name, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-600 bg-gray-50 border-r border-gray-100">
                              {prevTargets[name]}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <input
                                type="number"
                                value={targets[name] || ""}
                                onChange={(e) => handleTargetChange(name, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#800000] focus:border-[#800000]"
                                placeholder="Enter target amount"
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </form>
            </div>

            <div className="p-6 pt-4 border-t border-gray-200 bg-gray-50 rounded-b-lg sm:rounded-b-xl flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsSetTargetDialogOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 transition-colors border border-gray-300 rounded-lg hover:bg-gray-100 bg-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="targetForm"
                disabled={isSubmittingTarget || activeSalespersons.length === 0}
                className="px-4 py-2 text-sm font-medium text-white transition-colors bg-[#800000] rounded-lg hover:bg-[#990000] disabled:opacity-50"
              >
                {isSubmittingTarget ? "Saving..." : "Save Targets"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
