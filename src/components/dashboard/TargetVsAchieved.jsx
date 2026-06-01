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
  Cell
} from "recharts";
import supabase from "../../SupaabseClient";

function TargetVsAchieved({ isAdmin, currentUserSalesPersonName, selectedSalesperson, currentDate }) {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchTargetData = async () => {
      setIsLoading(true);
      try {
        const now = currentDate || new Date();
        const year = now.getFullYear();
        const monthStr = String(now.getMonth() + 1).padStart(2, '0');
        const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();

        const startDate = `${year}-${monthStr}-01`;
        const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

        // 1. Fetch Target
        let targetQuery = supabase
          .from("monthly_target")
          .select("target, sales_person_name")
          .gte("month", startDate)
          .lte("month", endDate);

        if (!isAdmin) {
          targetQuery = targetQuery.eq("sales_person_name", currentUserSalesPersonName);
        } else if (selectedSalesperson && selectedSalesperson !== "All Salespersons") {
          targetQuery = targetQuery.eq("sales_person_name", selectedSalesperson);
        }

        const { data: targetData, error: targetError } = await targetQuery;
        if (targetError) throw targetError;

        let totalTarget = 0;
        if (targetData) {
          targetData.forEach(row => {
            totalTarget += parseFloat(row.target || 0);
          });
        }

        // 2. Fetch Achieved
        let achievedQuery = supabase
          .from("tracking_history")
          .select("order_qty, sales_person_name")
          .gte("created_at", `${startDate}T00:00:00.000Z`)
          .lte("created_at", `${endDate}T23:59:59.999Z`);

        if (!isAdmin) {
          achievedQuery = achievedQuery.eq("sales_person_name", currentUserSalesPersonName);
        } else if (selectedSalesperson && selectedSalesperson !== "All Salespersons") {
          achievedQuery = achievedQuery.eq("sales_person_name", selectedSalesperson);
        }

        const { data: achievedData, error: achievedError } = await achievedQuery;
        if (achievedError) throw achievedError;

        let totalAchieved = 0;
        if (achievedData) {
          achievedData.forEach(row => {
            const qty = parseFloat(String(row.order_qty).replace(/[^\d.]/g, ""));
            if (!isNaN(qty)) {
              totalAchieved += qty;
            }
          });
        }

        if (isMounted) {
          const remaining = totalTarget > totalAchieved ? totalTarget - totalAchieved : 0;
          setData([
            { name: "Target", value: totalTarget, fill: "#800000" }, // Maroon
            { name: "Achieved", value: totalAchieved, fill: "#10b981" }, // Emerald Green
            { name: "Remaining", value: remaining, fill: "#f59e0b" } // Amber
          ]);
        }
      } catch (err) {
        console.error("Error fetching target vs achieved:", err);
        if (isMounted) {
          setData([
            { name: "Target", value: 0, fill: "#800000" },
            { name: "Achieved", value: 0, fill: "#10b981" },
            { name: "Remaining", value: 0, fill: "#f59e0b" }
          ]);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchTargetData();
    return () => { isMounted = false; };
  }, [isAdmin, currentUserSalesPersonName, selectedSalesperson, currentDate]);

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden w-full h-full">
      <div className="bg-gradient-to-r from-[#800000] via-[#990000] to-[#b30000] px-3 sm:px-8 py-3 sm:py-6 flex flex-row justify-between items-center gap-2">
        <div className="flex-1">
          <h3 className="text-sm sm:text-lg md:text-xl font-bold text-white mb-0.5 sm:mb-2 leading-tight">Target vs Achieved</h3>
          <p className="text-[10px] sm:text-sm text-red-50 md:text-lg leading-tight">
            Current month progress
          </p>
        </div>

        {/* Indicators */}
        {!isLoading && data.length > 0 && (
          <div className="flex flex-col gap-1 sm:gap-2 bg-white/20 backdrop-blur-sm p-2 sm:p-3 rounded-xl border border-white/30 flex-shrink-0">
            {data.map((item, index) => (
              <div key={index} className="flex items-center gap-1.5 sm:gap-3 text-white text-[10px] sm:text-sm">
                <div className="flex items-center gap-1.5 sm:gap-2 w-16 sm:w-24">
                  <span
                    className="w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: item.fill }}
                  ></span>
                  <span className="font-medium opacity-90 truncate">{item.name}</span>
                </div>
                <span className="opacity-60 hidden sm:inline">-</span>
                <span className="font-bold tracking-wide">{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="p-2 sm:p-8">
        <div className="h-40 xs:h-48 sm:h-80">
          {isLoading ? (
            <div className="text-center text-slate-500 pt-20 text-lg">
              Loading chart...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  fontSize={window.innerWidth < 640 ? 12 : 14}
                  fontWeight={500}
                  tickMargin={10}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={window.innerWidth < 640 ? 12 : 14}
                  fontWeight={500}
                />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    fontWeight: 500,
                  }}
                  formatter={(value) => [value, ""]}
                />
                <Bar
                  dataKey="value"
                  radius={[4, 4, 0, 0]}
                  barSize={window.innerWidth < 640 ? 40 : 60}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

export default TargetVsAchieved;
