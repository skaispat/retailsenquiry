"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChevronLeft, ChevronRight } from "lucide-react";
import supabase from "../../SupaabseClient";

function MonthlySales({
  isAdmin,
  currentUserSalesPersonName,
  selectedSalesperson,
  currentDate,
  setCurrentDate,
}) {
  const [salesData, setSalesData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const handlePrevMonth = () => {
    if (setCurrentDate && currentDate) {
      setCurrentDate(
        new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
      );
    }
  };

  const handleNextMonth = () => {
    if (setCurrentDate && currentDate) {
      setCurrentDate(
        new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
      );
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchMonthlyData = async () => {
      setIsLoading(true);

      const year = currentDate.getFullYear();
      const month = currentDate.getMonth(); // 0-11
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const monthStr = String(month + 1).padStart(2, "0");
      const startDate = `${year}-${monthStr}-01`;
      const endDate = `${year}-${monthStr}-${String(daysInMonth).padStart(2, "0")}`;

      try {
        let query = supabase
          .from("tracking_history")
          .select("created_at, order_qty, sales_person_name")
          .gte("created_at", `${startDate}T00:00:00.000Z`)
          .lte("created_at", `${endDate}T23:59:59.999Z`);

        if (!isAdmin) {
          query = query.eq("sales_person_name", currentUserSalesPersonName);
        } else if (selectedSalesperson && selectedSalesperson !== "All Salespersons") {
          query = query.eq("sales_person_name", selectedSalesperson);
        }

        const { data, error } = await query;
        if (error) throw error;

        const dailySalesMap = new Map();
        for (let i = 1; i <= daysInMonth; i++) {
          dailySalesMap.set(i, 0);
        }

        if (data) {
          data.forEach((row) => {
            const rawQty = row.order_qty;
            if (rawQty === null || rawQty === undefined) return;

            const qty = parseFloat(String(rawQty).replace(/[^\d.]/g, ""));
            if (isNaN(qty) || qty <= 0) return;

            const date = new Date(row.created_at);
            if (date.getFullYear() === year && date.getMonth() === month) {
              const day = date.getDate();
              dailySalesMap.set(day, (dailySalesMap.get(day) || 0) + qty);
            }
          });
        }

        const dynamicSalesData = Array.from(dailySalesMap.entries()).map(
          ([day, sales]) => ({
            name: `${day}`,
            sales: Math.round(sales),
          })
        );

        if (isMounted) {
          setSalesData(
            dynamicSalesData.length > 0
              ? dynamicSalesData
              : [{ name: "No Valid Data", sales: 0 }]
          );
        }
      } catch (err) {
        console.error("Error fetching monthly sales from tracking_history:", err);
        if (isMounted) {
          setSalesData([{ name: "Error", sales: 0 }]);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchMonthlyData();

    return () => {
      isMounted = false;
    };
  }, [currentDate, isAdmin, currentUserSalesPersonName, selectedSalesperson]);

  if (isLoading) {
    return (
      <div className="p-8 text-center font-semibold text-[#800000]">
        Loading sales data...
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden w-full max-w-4xl mx-auto">
      <div className="bg-gradient-to-r from-[#800000] via-[#990000] to-[#b30000] px-4 sm:px-8 py-4 sm:py-6 flex flex-row justify-between items-center gap-2 sm:gap-4">
        <div>
          <h3 className="text-lg md:text-xl font-bold text-white mb-1 sm:mb-2">
            Monthly Sales
          </h3>
          <p className="text-sm sm:text-base text-red-50 md:text-lg">
            Track your sales
          </p>
        </div>
        <div className="flex items-center space-x-1 sm:space-x-2 bg-white/20 rounded-lg px-1 sm:px-2 py-1 sm:py-1.5 backdrop-blur-sm">
          <button
            onClick={handlePrevMonth}
            className="text-white hover:text-blue-100 transition-colors p-1 rounded-md hover:bg-white/10 active:bg-white/20"
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <span className="text-white font-semibold text-sm sm:text-base min-w-[5rem] sm:min-w-[6rem] text-center">
            {currentDate.toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })}
          </span>
          <button
            onClick={handleNextMonth}
            className="text-white hover:text-blue-100 transition-colors p-1 rounded-md hover:bg-white/10 active:bg-white/20"
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>
      <div className="w-full px-2 sm:px-4 md:px-6 py-2 sm:py-4">
        <div className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl shadow-sm sm:shadow-md p-2 sm:p-4 md:p-6">
          <div className="w-full h-40 xs:h-48 sm:h-64 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={salesData}
                margin={{
                  top: 10,
                  right: window.innerWidth < 640 ? 0 : 20,
                  left: window.innerWidth < 640 ? 0 : 10,
                  bottom: window.innerWidth < 640 ? 15 : 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  fontSize={window.innerWidth < 640 ? 10 : 12}
                  fontWeight={500}
                  tickMargin={window.innerWidth < 640 ? 5 : 10}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={window.innerWidth < 640 ? 10 : 12}
                  fontWeight={500}
                  width={window.innerWidth < 640 ? 30 : 40}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    fontWeight: 500,
                    fontSize: window.innerWidth < 640 ? "12px" : "14px",
                  }}
                />
                <Bar
                  dataKey="sales"
                  fill="url(#salesGradient)"
                  radius={[4, 4, 0, 0]}
                />
                <defs>
                  <linearGradient
                    id="salesGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#cc0000" />
                    <stop offset="100%" stopColor="#800000" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MonthlySales;
