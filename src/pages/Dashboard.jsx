"use client";

import React, { useState, useEffect, useContext, useMemo, useRef } from "react";
import { Users, Store, ShoppingBag, AlertCircle, X } from "lucide-react";
import MonthlySales from "../components/dashboard/MonthlySales";
import OrderStatus from "../components/dashboard/OrderStatus";
import { AuthContext } from "../App";
import supabase from "../SupaabseClient";

function Dashboard() {
  const { currentUser, isAuthenticated } = useContext(AuthContext);

  const currentUserSalesPersonName = currentUser?.salesPersonName || "Unknown User";
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

  const isAdmin = userRole.toLowerCase() === "admin";

  const [isDataDialogOpen, setIsDataDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("");
  const [dialogData, setDialogData] = useState([]);
  const [dialogHeaders, setDialogHeaders] = useState([]);

  // FMS columns configuration
  const FMS_COLUMNS_INFO = {
    timestamp: { label: "Timestamp", property: "timestamp", type: "datetime" },
    dealer_code: { label: "Dealer Code", property: "dealer_code", type: "text" },
    dealer_name: { label: "Dealer Name", property: "dealer_name", type: "text" },
    dealer_region: { label: "Dealer Region", property: "dealer_region", type: "text" },
    sales_person_name: { label: "Sales Person Name", property: "sales_person_name", type: "text" },
    email: { label: "Email", property: "email", type: "text" },
    contact_no: { label: "Contact No", property: "contact_number", type: "number" },
    address: { label: "Address", property: "address", type: "text" },
    last_called_on: { label: "Last Called On", property: "last_date_of_call", type: "date" },
    order_status: { label: "Order Status", property: "status", type: "text"},
    customer_feedback: { label: "What did the Customer Say", property: "what_did_the_customer_say", type: "text" },
    next_follow_up: { label: "Next Follow Up Date", property: "next_date_of_call", type: "date" },
    next_action: { label: "Next Action", property: "next_action", type: "text" },
    dealer_size: { label: "Dealer Size", property: "dealer_size", type: "text" },
    order_quantity: { label: "Order Quantity", property: "order_qty", type: "number" },
    ordered_products: { label: "Ordered Products", property: "order_products", type: "text" },
    value_of_order: { label: "Value of Order", property: "value_of_order", type: "number" },
    last_order_before: { label: "Last Order Before", property: "last_order_before", type: "date" },
    area_name: { label: "Area Name", property: "area_name", type: "text" },
    select_value: { label: "Select Value", property: "select_value", type: "text" },
    planned: { label: "Planned", property: "planned", type: "text" },
    actual: { label: "Actual", property: "actual", type: "text" },
  };

  const FMS_DISPLAY_COLUMNS_FOR_DIALOG = [
    "sales_person_name",
    "dealer_code", 
    "dealer_name",
    "contact_no",
    "next_follow_up",
    "dealer_region",
    "last_called_on",
    "order_status",
    "customer_feedback",
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
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      console.error('Date formatting error:', error, 'Original value:', dateValue);
      return dateValue;
    }
  };

  // FIXED: Fetch data from Supabase with proper timestamp handling
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      if (!isAuthenticated || !currentUser) {
        console.log("DEBUG: Not authenticated or currentUser missing.");
        setIsLoading(false);
        setError("Please log in to view the dashboard.");
        return;
      }

      try {
        console.log("🔄 Fetching data from Supabase FMS table...");

        let query = supabase
          .from('FMS')
          .select('*')
          .order('timestamp', { ascending: false });

        if (userRole.toLowerCase() !== 'admin') {
          query = query.eq('sales_person_name', currentUserSalesPersonName);
        }

        const { data, error } = await query;

        if (error) {
          throw new Error(`Supabase error: ${error.message}`);
        }

        console.log("✅ FMS data loaded successfully from Supabase");

        if (data && data.length > 0) {
          const allRows = data.map((row, rowIndex) => {
            const rowData = { 
              _rowIndex: rowIndex,
              id: row.id,
              timestamp: row.timestamp,
              timestamp_raw: row.timestamp, // FIXED: Store raw timestamp for filtering
              dealer_code: row.dealer_code || row.reg_xyy || row.dc_dealer_code || null,
              dealer_name: row.dealer_name,
              dealer_region: row.dealer_region || row.district_name,
              sales_person_name: row.sales_person_name,
              email: row.email || row.email_address,
              contact_number: row.contact_number || row.contact_no,
              address: row.address,
              last_date_of_call: row.last_date_of_call,
              status: row.status,
              stage: row.stage,
              what_did_the_customer_say: row.what_did_the_customer_say || row.what_did_live_costs,
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
            };

            // FIXED: Format date fields but keep timestamp raw
            Object.keys(FMS_COLUMNS_INFO).forEach(key => {
              const columnInfo = FMS_COLUMNS_INFO[key];
              // Skip timestamp - we need it raw for filtering
              if (columnInfo.property === 'timestamp') {
                return;
              }
              if ((columnInfo.type === 'date' || columnInfo.type === 'datetime') && rowData[columnInfo.property]) {
                rowData[columnInfo.property] = formatDate(rowData[columnInfo.property]);
              }
            });

            return rowData;
          });

          setAllFMSData(allRows);

          const salespersons = new Set();
          allRows.forEach(row => {
            const salespersonName = row.sales_person_name;
            if (salespersonName && typeof salespersonName === 'string' && salespersonName.trim() !== '') {
              salespersons.add(salespersonName.trim());
            }
          });
          setUniqueSalespersons([...Array.from(salespersons).sort()]);

        } else {
          console.log("No data found in FMS table for user:", currentUserSalesPersonName);
          setAllFMSData([]);
          setUniqueSalespersons([]);
          setTotalCount(0);
          setActiveDealersCount(0);
          setTotalOrdersCount(0);
          setPendingEnquiriesCount(0);
          setError("No data found in the FMS table.");
        }
      } catch (error) {
        console.error("DEBUG: Error fetching data:", error);
        setError(`Failed to load data: ${error.message}`);
        setTotalCount(0);
        setActiveDealersCount(0);
        setTotalOrdersCount(0);
        setPendingEnquiriesCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated, currentUser, currentUserSalesPersonName, userRole]);

  // FIXED: Enhanced filtering with proper Supabase timestamp handling
  const currentFilteredData = useMemo(() => {
    if (allFMSData.length === 0 || !isAuthenticated || !currentUser) {
      return [];
    }

    let tempFilteredData = [...allFMSData];

    // First filter by salesperson
    tempFilteredData = tempFilteredData.filter((row) => {
      const rowSalespersonName = row.sales_person_name;
      const currentUserNameNormalized = currentUserSalesPersonName ? currentUserSalesPersonName.trim().toLowerCase() : '';
      const rowSalespersonNameNormalized = rowSalespersonName ? String(rowSalespersonName).trim().toLowerCase() : '';

      if (isAdmin) {
        if (selectedSalesperson === "" || selectedSalesperson === "All Salespersons") {
          return true;
        }
        return rowSalespersonNameNormalized === selectedSalesperson.trim().toLowerCase();
      } else {
        return rowSalespersonNameNormalized === currentUserNameNormalized;
      }
    });

    // FIXED: Filter by date range using raw timestamp with proper Supabase format handling
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      console.log("🕐 Date filtering - Start:", start.toISOString(), "End:", end.toISOString());

      tempFilteredData = tempFilteredData.filter((row) => {
        const timestampToUse = row.timestamp_raw || row.timestamp;
        
        if (!timestampToUse) {
          console.log("❌ No timestamp for row:", row.dealer_code, row.dealer_name);
          return false;
        }
        
        try {
          let rowDate;
          
          // FIXED: Handle Supabase timestamp format: "2025-10-31 17:53:14+00"
          if (typeof timestampToUse === 'string') {
            let isoTimestamp = timestampToUse.trim();
            
            // Replace space with 'T' for ISO format
            if (isoTimestamp.includes(' ')) {
              isoTimestamp = isoTimestamp.replace(' ', 'T');
            }
            
            // Fix timezone format: "+00" -> "+00:00"
            if (isoTimestamp.match(/[+-]\d{2}$/)) {
              isoTimestamp = isoTimestamp + ':00';
            }
            
            rowDate = new Date(isoTimestamp);
          } else {
            rowDate = new Date(timestampToUse);
          }
          
          if (isNaN(rowDate.getTime())) {
            console.log("❌ Invalid timestamp:", timestampToUse, "for row:", row.dealer_code);
            return false;
          }
          
          const isInRange = rowDate >= start && rowDate <= end;
          
          if (isInRange) {
            console.log("✅ Date match:", row.dealer_code, row.dealer_name, "Date:", rowDate.toLocaleDateString());
          }
          
          return isInRange;
        } catch (error) {
          console.error('Date filtering error:', error, 'Date value:', timestampToUse);
          return false;
        }
      });
      
      console.log("📊 Records after date filtering:", tempFilteredData.length);
    }

    console.log("✅ Final filtered data count:", tempFilteredData.length);
    
    return tempFilteredData;
  }, [allFMSData, startDate, endDate, isAdmin, currentUserSalesPersonName, selectedSalesperson, isAuthenticated, currentUser]);

  const filteredDataRef = useRef([]);
  useEffect(() => {
    filteredDataRef.current = currentFilteredData;
    console.log("🔄 filteredDataRef updated with:", currentFilteredData.length, "records");
  }, [currentFilteredData]);

  // FIXED: Enhanced active dealers counting
  useEffect(() => {
    console.log("🔄 Recalculating counts with filtered data");
    console.log("📊 Current filtered data length:", currentFilteredData.length);
    console.log("📊 Date filters:", { startDate, endDate });

    if (currentFilteredData.length === 0) {
      console.log("❌ No filtered data, resetting all counts to 0");
      setTotalCount(0);
      setActiveDealersCount(0);
      setTotalOrdersCount(0);
      setPendingEnquiriesCount(0);
      return;
    }
    
    setTotalCount(currentFilteredData.length);
    
    const activeDealers = new Set();
    
    console.log("🔍 Analyzing first 5 records for active dealer criteria:");
    currentFilteredData.slice(0, 5).forEach((row, index) => {
      console.log(`Record ${index + 1}:`, {
        dealer_code: row.dealer_code,
        dealer_name: row.dealer_name,
        stage: row.stage,
        select_value: row.select_value,
        status: row.status,
        timestamp: row.timestamp_raw
      });
    });

    currentFilteredData.forEach((row) => {
      const dealerCode = row.dealer_code;
      const selectValue = row.select_value;
      const stage = row.stage;
      const status = row.status;
      
      if (!dealerCode || dealerCode.trim() === "") {
        return;
      }
      
      const normalizedStage = stage ? String(stage).trim().toLowerCase() : '';
      const normalizedStatus = status ? String(status).trim().toLowerCase() : '';
      const normalizedSelectValue = selectValue ? String(selectValue).trim().toLowerCase() : '';
      
      const hasOrderReceived = 
        normalizedStage === "order received" || 
        normalizedStage.includes("order received") ||
        normalizedStatus === "order received" ||
        normalizedStatus.includes("order received");
      
      const isDealerType = 
        normalizedSelectValue === "dealer" || 
        normalizedSelectValue.includes("dealer");

      if (hasOrderReceived ) {
        activeDealers.add(dealerCode);
        console.log("✅ ADDED Active dealer:", {
          dealerCode,
          dealerName: row.dealer_name,
          stage: stage,
          status: status,
          selectValue: selectValue
        });
      }
    });

    const activeDealersCount = activeDealers.size;
    console.log("🎯 Final active dealers count:", activeDealersCount);
    console.log("🎯 Active dealer codes:", Array.from(activeDealers));
    setActiveDealersCount(activeDealersCount);
    
    const ordersCount = currentFilteredData.filter(row => {
      const hasOrder = row.value_of_order && String(row.value_of_order).trim() !== "";
      return hasOrder;
    }).length;
    setTotalOrdersCount(ordersCount);

    const pendingCount = currentFilteredData.filter(row => {
      const planned = row.planned;
      const actual = row.actual;
      const isPending = planned !== null && 
             planned !== undefined && 
             planned !== "" && 
             (actual === null || actual === undefined || actual === "");
      return isPending;
    }).length;

    setPendingEnquiriesCount(pendingCount);

    console.log("📈 Final counts:", {
      total: currentFilteredData.length,
      activeDealers: activeDealersCount,
      totalOrders: ordersCount,
      pendingEnquiries: pendingCount
    });
  }, [currentFilteredData, startDate, endDate]);

  // FIXED: handleCardClick for Active Dealers
  const handleCardClick = (kpiType) => {
    let dataForDialog = [];
    let title = "";
    
    const headers = FMS_DISPLAY_COLUMNS_FOR_DIALOG.map(columnKey => 
      FMS_COLUMNS_INFO[columnKey]
    ).filter(Boolean);

    const dataToFilter = filteredDataRef.current;

    if (kpiType === "totalRecords") {
      title = "All Records";
      dataForDialog = dataToFilter;
    } else if (kpiType === "activeDealers") {
      title = "Active Dealers";
      const uniqueDealerCodes = new Set();
      
      dataForDialog = dataToFilter.filter(row => {
        const dealerCode = row.dealer_code;
        const selectValue = row.select_value;
        const stage = row.stage;
        const status = row.status;
        
        if (!dealerCode || dealerCode.trim() === "") {
          return false;
        }
        
        const normalizedStage = stage ? String(stage).trim().toLowerCase() : '';
        const normalizedStatus = status ? String(status).trim().toLowerCase() : '';
        const normalizedSelectValue = selectValue ? String(selectValue).trim().toLowerCase() : '';
        
        const hasOrderReceived = 
          normalizedStage === "order received" || 
          normalizedStage.includes("order received") ||
          normalizedStatus === "order received" ||
          normalizedStatus.includes("order received");
        
        const isDealerType = 
          normalizedSelectValue === "dealer" || 
          normalizedSelectValue.includes("dealer");

        if (hasOrderReceived  && !uniqueDealerCodes.has(dealerCode)) {
          uniqueDealerCodes.add(dealerCode);
          return true;
        }
        return false;
      });
      
      console.log("📋 Active dealers dialog data count:", dataForDialog.length);
    } else if (kpiType === "totalOrders") {
      title = "Total Orders";
      dataForDialog = dataToFilter.filter(row => row.value_of_order && String(row.value_of_order).trim() !== "");
    } else if (kpiType === "pendingEnquiries") {
      title = "Pending Enquiries";
      dataForDialog = dataToFilter.filter(row => {
        const planned = row.planned;
        const actual = row.actual;
        return planned !== null && 
               planned !== undefined && 
               planned !== "" && 
               (actual === null || actual === undefined || actual === "");
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error && allFMSData.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-3 sm:p-6">
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 sm:space-y-2">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Dashboard
              </h1>
              <p className="text-sm sm:text-base md:text-lg text-slate-600 font-medium">
                {getGreeting()}, {currentUserSalesPersonName}!
              </p>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-lg sm:rounded-xl shadow-md sm:shadow-lg border border-white/20 p-6 text-center">
            <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 sm:space-y-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Dashboard
            </h1>
           <p className="text-sm sm:text-base md:text-lg text-slate-600 font-medium">
  {getGreeting()}, {currentUserSalesPersonName}!
</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 bg-white/80 backdrop-blur-sm rounded-lg sm:rounded-xl px-3 py-2 sm:px-4 sm:py-3 shadow-md sm:shadow-lg border border-white/20 w-full sm:w-auto">
            <div className="flex items-center justify-center sm:justify-start gap-2 text-slate-700">
              <span className="font-semibold text-blue-600 text-xs sm:text-sm md:text-base">
                Today:
              </span>
              <span className="font-medium text-xs sm:text-sm md:text-base">
                {new Date().toLocaleDateString("en-GB")}
              </span>
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-slate-700">
              <label htmlFor="startDate" className="font-semibold text-blue-600 text-xs sm:text-sm md:text-base">From:</label>
              <input type="date" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="p-1 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-2 text-slate-700">
              <label htmlFor="endDate" className="font-semibold text-blue-600 text-xs sm:text-sm md:text-base">To:</label>
              <input type="date" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="p-1 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {isAdmin && (
              <div className="flex items-center justify-center sm:justify-start gap-2 text-slate-700">
                <label htmlFor="salespersonFilter" className="font-semibold text-blue-600 text-xs sm:text-sm md:text-base">Salesperson:</label>
                <select id="salespersonFilter" value={selectedSalesperson} onChange={(e) => setSelectedSalesperson(e.target.value)} className="p-1 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">All Salespersons</option>
                  {uniqueSalespersons.map((name) => (<option key={name} value={name}>{name}</option>))}
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Records Card */}
          <div
            className="bg-white/80 backdrop-blur-sm rounded-lg sm:rounded-xl shadow-md sm:shadow-lg border border-white/20 overflow-hidden group active:scale-[0.99] sm:hover:scale-[1.02] transition-all duration-300 cursor-pointer"
            onClick={() => handleCardClick("totalRecords")}
          >
            <div className="h-full bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-500 p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[0.65rem] xs:text-xs sm:text-sm font-semibold text-blue-100 uppercase tracking-wider mb-1">Total Records</h3>
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1">
                    {totalCount.toLocaleString()}
                  </div>
                </div>
                <div className="bg-white/20 p-1.5 sm:p-3 rounded-md sm:rounded-lg">
                  <Users className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white" />
                </div>
              </div>
            </div>
          </div>
          {/* Active Dealers Card */}
          <div
            className="bg-white/80 backdrop-blur-sm rounded-lg sm:rounded-xl shadow-md sm:shadow-lg border border-white/20 overflow-hidden group active:scale-[0.99] sm:hover:scale-[1.02] transition-all duration-300 cursor-pointer"
            onClick={() => handleCardClick("activeDealers")}
          >
            <div className="h-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[0.65rem] xs:text-xs sm:text-sm font-semibold text-purple-100 uppercase tracking-wider mb-1">Active Dealers</h3>
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1">
                    {activeDealersCount}
                  </div>
                </div>
                <div className="bg-white/20 p-1.5 sm:p-3 rounded-md sm:rounded-lg">
                  <Store className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white" />
                </div>
              </div>
            </div>
          </div>
          {/* Total Orders Card */}
          <div
            className="bg-white/80 backdrop-blur-sm rounded-lg sm:rounded-xl shadow-md sm:shadow-lg border border-white/20 overflow-hidden group active:scale-[0.99] sm:hover:scale-[1.02] transition-all duration-300 cursor-pointer"
            onClick={() => handleCardClick("totalOrders")}
          >
            <div className="h-full bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[0.65rem] xs:text-xs sm:text-sm font-semibold text-pink-100 uppercase tracking-wider mb-1">Total Orders</h3>
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1">
                    {totalOrdersCount.toLocaleString()}
                  </div>
                </div>
                <div className="bg-white/20 p-1.5 sm:p-3 rounded-md sm:rounded-lg">
                  <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white" />
                </div>
              </div>
            </div>
          </div>
          {/* Pending Enquiries Card */}
          <div
            className="bg-white/80 backdrop-blur-sm rounded-lg sm:rounded-xl shadow-md sm:shadow-lg border border-white/20 overflow-hidden group active:scale-[0.99] sm:hover:scale-[1.02] transition-all duration-300 cursor-pointer"
            onClick={() => handleCardClick("pendingEnquiries")}
          >
            <div className="bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 p-3 sm:p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[0.65rem] xs:text-xs sm:text-sm font-semibold text-amber-100 uppercase tracking-wider mb-1">Pending Enquiries</h3>
                  <div className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1">
                    {pendingEnquiriesCount}
                  </div>
                </div>
                <div className="bg-white/20 p-1.5 sm:p-3 rounded-md sm:rounded-lg">
                  <AlertCircle className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Pass filteredData and FMS_COLUMNS_INFO to chart components */}
          <MonthlySales filteredData={currentFilteredData} FMS_COLUMNS_INFO={FMS_COLUMNS_INFO} />
          <OrderStatus filteredData={currentFilteredData} FMS_COLUMNS_INFO={FMS_COLUMNS_INFO} />
        </div>
      </div>

      {isDataDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in-0 p-4">
          <div className="relative w-full max-w-4xl h-[50vh] rounded-lg sm:rounded-xl bg-white/90 backdrop-blur-sm p-6 shadow-2xl animate-in zoom-in-95 max-h-[70vh] overflow-hidden transform scale-100 opacity-100 border border-white/30">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                {dialogTitle}
                {selectedSalesperson && selectedSalesperson !== "All Salespersons" && isAdmin && (
                  <span className="text-lg font-medium text-gray-500 ml-2">({selectedSalesperson})</span>
                )}
              </h2>
              <button
                onClick={() => setIsDataDialogOpen(false)}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="overflow-auto h-[calc(50vh-140px)] border border-gray-200 rounded-lg">
              <div className="min-w-full">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-100 sticky top-0 z-10">
                    <tr>
                      {dialogHeaders.map((header) => (
                        <th
                          key={header.property}
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap"
                        >
                          {header.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {dialogData.length === 0 ? (
                      <tr>
                        <td colSpan={dialogHeaders.length} className="px-6 py-12 text-center text-gray-500 font-medium text-base">
                          No data available for this selection.
                        </td>
                      </tr>
                    ) : (
                      dialogData.map((row, rowIndex) => (
                        <tr key={row.id || `row-${rowIndex}`} className="hover:bg-gray-50">
                          {dialogHeaders.map((header) => (
                            <td
                              key={`${row.id}-${header.property}`}
                              className="px-6 py-4 whitespace-nowrap text-sm text-gray-800"
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
    </div>
  );
}

export default Dashboard;