import React, { useState, useEffect, useContext } from 'react';
import { ShoppingCart, RefreshCw, Calendar, User, Info, Target } from 'lucide-react';
import supabase from '../SupaabseClient';
import { AuthContext } from '../App';

function Orders() {
  const { isAdmin } = useContext(AuthContext);
  const [ordersData, setOrdersData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const filteredOrdersData = selectedMonth
    ? ordersData.filter(row => row.monthKey === selectedMonth)
    : ordersData;

  const fetchOrders = async () => {
    if (!isAdmin()) {
      setError("You don't have permission to access this page.");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Fetch all tracking history that has order_qty
      const { data, error: fetchError } = await supabase
        .from('tracking_history')
        .select('created_at, order_qty, sales_person_name')
        .not('order_qty', 'is', null)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Fetch targets from monthly_target
      const { data: targetData, error: targetError } = await supabase
        .from('monthly_target')
        .select('sales_person_name, month, target');

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

      // Convert to array and sort by month (newest first) then salesperson name
      const aggregatedArray = Object.values(groupedData).sort((a, b) => {
        if (a.monthKey !== b.monthKey) {
          return b.monthKey.localeCompare(a.monthKey); // Newest month first
        }
        return a.sales_person_name.localeCompare(b.sales_person_name);
      });

      setOrdersData(aggregatedArray);
    } catch (err) {
      console.error("Error fetching orders data:", err);
      setError(err.message || "Failed to load orders data");
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 sm:space-y-2">
            <h1 className="text-xl font-bold text-transparent sm:text-2xl md:text-3xl bg-gradient-to-r from-[#800000] via-[#a30000] to-[#cc0000] bg-clip-text flex items-center gap-3">
              <ShoppingCart className="w-8 h-8 sm:w-10 sm:h-10 text-[#800000]" />
              Monthly Orders
            </h1>
            <p className="text-sm font-medium sm:text-base md:text-lg text-slate-600">
              Monthly order quantities per sales person
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-center w-full sm:w-auto">
            {/* Month Filter */}
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm w-full sm:w-auto focus-within:ring-2 focus-within:ring-[#800000]">
              <Calendar className="w-5 h-5 text-[#800000]" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="focus:outline-none text-gray-700 font-medium bg-transparent w-full sm:w-auto cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Data Table */}
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
                      Target
                    </div>
                  </th>
                  <th className="p-4 font-semibold text-sm sm:text-base whitespace-nowrap text-right">
                    Total Order Qty
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
                      <td className="p-4 text-sm sm:text-base font-bold text-[#800000] text-right whitespace-nowrap">
                        {row.total_qty.toLocaleString(undefined, { maximumFractionDigits: 2 })} Tons
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="p-8 text-center text-gray-500 font-medium">
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
      </div>
    </div>
  );
}

export default Orders;
