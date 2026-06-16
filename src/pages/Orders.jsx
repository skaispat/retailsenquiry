import React, { useState, useEffect, useContext } from 'react';
import { ShoppingCart, RefreshCw, Calendar, User, Info, Target, LayoutDashboard, List, Package, DollarSign, MapPin } from 'lucide-react';
import supabase from '../SupaabseClient';
import { AuthContext } from '../App';

function Orders() {
  const { isAdmin, currentUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('summary');
  const [ordersData, setOrdersData] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const filteredOrdersData = selectedMonth
    ? ordersData.filter(row => row.monthKey === selectedMonth)
    : ordersData;

  const filteredRecentOrders = selectedMonth
    ? recentOrders.filter(row => row.monthKey === selectedMonth)
    : recentOrders;

  const totalTargetSum = filteredOrdersData.reduce((acc, row) => {
    if (row.target !== "Not Set" && !isNaN(row.target)) {
      return acc + parseFloat(row.target);
    }
    return acc;
  }, 0);

  const totalOrderSum = filteredOrdersData.reduce((acc, row) => {
    return acc + (row.total_qty || 0);
  }, 0);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Construct tracking history query
      let query = supabase
        .from('tracking_history')
        .select('id, created_at, order_qty, sales_person_name, deler_distributer_site_name, order_products, value_of_order')
        .not('order_qty', 'is', null)
        .order('created_at', { ascending: false });

      if (!isAdmin() && currentUser?.salesPersonName) {
        query = query.eq('sales_person_name', currentUser.salesPersonName);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      // Fetch targets from monthly_target
      let targetQuery = supabase
        .from('monthly_target')
        .select('sales_person_name, month, target');

      if (!isAdmin() && currentUser?.salesPersonName) {
        targetQuery = targetQuery.eq('sales_person_name', currentUser.salesPersonName);
      }

      const { data: targetData, error: targetError } = await targetQuery;

      if (targetError) throw targetError;

      // Create target map
      const targetMap = {};
      if (targetData) {
        targetData.forEach(t => {
          if (!t.month || !t.sales_person_name) return;
          const targetMonthKey = t.month.substring(0, 7); // Extracts "YYYY-MM"
          const tKey = `${t.sales_person_name}_${targetMonthKey}`;
          targetMap[tKey] = t.target;
        });
      }

      // Group by sales_person_name and month
      const groupedData = {};

      if (data) {
        data.forEach(row => {
          const rawQty = row.order_qty;
          if (!rawQty) return;

          // Parse quantity from text like "2 Tons"
          const qty = parseFloat(String(rawQty).replace(/[^\d.]/g, ""));
          if (isNaN(qty) || qty <= 0) return;

          const date = new Date(row.created_at);
          // Format as YYYY-MM for sorting, and a readable format for display
          const year = date.getFullYear();
          const monthStr = String(date.getMonth() + 1).padStart(2, '0');
          const monthKey = `${year}-${monthStr}`;
          const displayMonth = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

          const personName = row.sales_person_name || 'Unknown';
          const key = `${personName}_${monthKey}`;

          if (!groupedData[key]) {
            groupedData[key] = {
              id: key,
              sales_person_name: personName,
              monthKey: monthKey,
              displayMonth: displayMonth,
              total_qty: 0,
              target: targetMap[key] || "Not Set",
              year: year,
              month: date.getMonth()
            };
          }

          groupedData[key].total_qty += qty;
        });
      }

      // Ensure users with targets but no orders are included
      if (targetData) {
        targetData.forEach(t => {
          if (!t.month || !t.sales_person_name) return;
          const targetMonthKey = t.month.substring(0, 7); // Extracts "YYYY-MM"
          const key = `${t.sales_person_name}_${targetMonthKey}`;

          if (!groupedData[key]) {
            const [year, month] = targetMonthKey.split('-');
            const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
            const displayMonth = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

            groupedData[key] = {
              id: key,
              sales_person_name: t.sales_person_name,
              monthKey: targetMonthKey,
              displayMonth: displayMonth,
              total_qty: 0,
              target: t.target,
              year: parseInt(year, 10),
              month: parseInt(month, 10) - 1
            };
          }
        });
      }

      // Populate recent orders
      const formattedRecentOrders = (data || []).map(row => {
        const date = new Date(row.created_at);
        const year = date.getFullYear();
        const monthStr = String(date.getMonth() + 1).padStart(2, '0');
        const monthKey = `${year}-${monthStr}`;

        return {
          id: row.id || Math.random().toString(),
          ...row,
          monthKey,
          displayDate: date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
        };
      });
      setRecentOrders(formattedRecentOrders);

      // Convert to array and sort by month (newest first) then target (descending) then salesperson name
      const aggregatedArray = Object.values(groupedData).sort((a, b) => {
        if (a.monthKey !== b.monthKey) {
          return b.monthKey.localeCompare(a.monthKey); // Newest month first
        }

        const targetA = a.target === "Not Set" || isNaN(a.target) ? 0 : parseFloat(a.target);
        const targetB = b.target === "Not Set" || isNaN(b.target) ? 0 : parseFloat(b.target);

        if (targetB !== targetA) {
          return targetB - targetA; // Descending order
        }

        return a.sales_person_name.localeCompare(b.sales_person_name);
      });

      setOrdersData(aggregatedArray);
    } catch (err) {
      console.error("Error fetching orders data:", err);
      if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('Network Error'))) {
        setError("Low internet connectivity. Please check your connection and try again.");
      } else {
        setError(err.message || "Failed to load orders data");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 mx-auto mb-4 animate-spin text-[#800000]" />
          <p className="font-medium text-gray-600">Loading orders data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-3 sm:p-6 bg-gradient-to-br from-slate-50 via-red-50 to-rose-50">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-xl shadow-md p-8 text-center border border-red-100">
            <Info className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Error Loading Orders</h2>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-3 bg-gradient-to-br from-slate-50 via-red-50 to-rose-50 sm:p-6">
      <div className="mx-auto space-y-4 max-w-7xl sm:space-y-6">
        {/* Header */}
        <div className="flex flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
          <div className="space-y-1 sm:space-y-2 flex-1 min-w-0">
            <h1 className="text-lg font-bold text-transparent sm:text-2xl md:text-3xl bg-gradient-to-r from-[#800000] via-[#a30000] to-[#cc0000] bg-clip-text flex items-center gap-2 sm:gap-3">
              <ShoppingCart className="w-6 h-6 sm:w-10 sm:h-10 text-[#800000] shrink-0" />
              <span className="truncate">Monthly Orders</span>
            </h1>
            <p className="text-xs font-medium sm:text-base md:text-lg text-slate-600 leading-tight sm:leading-normal">
              Monthly order quantities per sales person
            </p>
          </div>

          <div className="flex items-center flex-shrink-0 mt-1 sm:mt-0">
            {/* Month Filter */}
            <div className="flex items-center gap-1 sm:gap-2 bg-white px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-[#800000]">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-[#800000] shrink-0" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="focus:outline-none text-gray-700 font-medium bg-transparent w-[105px] sm:w-auto cursor-pointer text-xs sm:text-base"
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6 bg-white/50 backdrop-blur-sm rounded-t-xl px-2 sm:px-4 pt-2 overflow-x-auto">
          <button
            className={`py-3 px-3 sm:px-6 font-semibold text-xs sm:text-base border-b-2 transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 ${activeTab === 'summary' ? 'border-[#800000] text-[#800000]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('summary')}
          >
            <LayoutDashboard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Monthly Summary
          </button>
          <button
            className={`py-3 px-3 sm:px-6 font-semibold text-xs sm:text-base border-b-2 transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 ${activeTab === 'recent' ? 'border-[#800000] text-[#800000]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('recent')}
          >
            <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Recent Orders
          </button>
        </div>

        {/* Data Tables */}
        {activeTab === 'summary' ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-[#800000] to-[#b30000] text-white">
                    <th className="p-4 font-semibold text-sm sm:text-base whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Month
                      </div>
                    </th>
                    <th className="p-4 font-semibold text-sm sm:text-base whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Sales Person
                      </div>
                    </th>
                    <th className="p-4 font-semibold text-sm sm:text-base whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Target {isAdmin() && <span className="text-red-200 ml-1">({totalTargetSum.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " mt"})</span>}
                      </div>
                    </th>
                    <th className="p-4 font-semibold text-sm sm:text-base whitespace-nowrap text-center">
                      Total Order Qty {isAdmin() && <span className="text-red-200 ml-1">({totalOrderSum.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " mt"})</span>}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOrdersData.length > 0 ? (
                    filteredOrdersData.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-red-50/50 transition-colors group"
                      >
                        <td className="p-4 text-sm sm:text-base font-medium text-gray-700 whitespace-nowrap group-hover:text-[#800000] transition-colors">
                          {row.displayMonth}
                        </td>
                        <td className="p-4 text-sm sm:text-base text-gray-600 whitespace-nowrap">
                          {row.sales_person_name}
                        </td>
                        <td className="p-4 text-sm sm:text-base text-gray-600 whitespace-nowrap">
                          {row.target !== "Not Set" ? `${row.target} Tons` : "Not Set"}
                        </td>
                        <td className="p-4 text-sm sm:text-base font-bold text-[#800000] text-center whitespace-nowrap">
                          {row.total_qty.toLocaleString(undefined, { maximumFractionDigits: 2 })} Tons
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="p-8 text-center text-gray-500 font-medium">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Info className="w-8 h-8 text-gray-400" />
                          No order data found.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-[#800000] to-[#b30000] text-white">
                    <th className="p-4 font-semibold text-sm sm:text-base whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Date
                      </div>
                    </th>
                    {isAdmin() && (
                      <th className="p-4 font-semibold text-sm sm:text-base whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Sales Person
                        </div>
                      </th>
                    )}
                    <th className="p-4 font-semibold text-sm sm:text-base whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Dealer/Distributer Name
                      </div>
                    </th>
                    {/* <th className="p-4 font-semibold text-sm sm:text-base whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Products
                      </div>
                    </th> */}

                    <th className="p-4 font-semibold text-sm sm:text-base whitespace-nowrap text-center">
                      Order Qty
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRecentOrders.length > 0 ? (
                    filteredRecentOrders.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-red-50/50 transition-colors group"
                      >
                        <td className="p-4 text-sm sm:text-base font-medium text-gray-700 whitespace-nowrap group-hover:text-[#800000] transition-colors">
                          {row.displayDate}
                        </td>
                        {isAdmin() && (
                          <td className="p-4 text-sm sm:text-base text-gray-600 whitespace-nowrap">
                            {row.sales_person_name}
                          </td>
                        )}
                        <td className="p-4 text-sm sm:text-base text-gray-600">
                          {row.deler_distributer_site_name || '-'}
                        </td>
                        {/* <td className="p-4 text-sm sm:text-base text-gray-600">
                          {row.order_products || '-'}
                        </td> */}

                        <td className="p-4 text-sm sm:text-base font-bold text-[#800000] text-center whitespace-nowrap">
                          {row.order_qty}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={isAdmin() ? "5" : "4"} className="p-8 text-center text-gray-500 font-medium">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Info className="w-8 h-8 text-gray-400" />
                          No recent orders found.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Orders;
