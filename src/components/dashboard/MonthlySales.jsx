/*
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

function MonthlySales() {
  const [isLoading, setIsLoading] = useState(true);
  const [salesData, setSalesData] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          "https://docs.google.com/spreadsheets/d/15_ZUjQA-cSyFMt-70BxPBWVUZ185ioQzTqt5ElWXaZk/gviz/tq?tqx=out:json&sheet=FMS"
        );
        const text = await response.text();
        const jsonStart = text.indexOf("{");
        const jsonEnd = text.lastIndexOf("}") + 1;
        const jsonData = text.substring(jsonStart, jsonEnd);
        const data = JSON.parse(jsonData);

        if (data?.table?.rows) {
          const monthNames = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ];

          const monthlySalesMap = new Map();

          data.table.rows.forEach((row, index) => {
            const rawZ = row.c?.[25]?.v; // Column Z - Sales
            const rawP = row.c?.[15]?.v; // Column P - Date

            if (!rawZ || !rawP) return;

            const cleanedZ = parseFloat(String(rawZ).replace(/[^\d.]/g, ""));
            if (isNaN(cleanedZ) || cleanedZ <= 0) return;

            let monthKey = "";

            try {
              if (typeof rawP === "string" && rawP.startsWith("Date(")) {
                const match = rawP.match(/Date\((\d+),(\d+),(\d+)\)/);
                if (match) {
                  const year = parseInt(match[1], 10);
                  const month = parseInt(match[2], 10);
                  monthKey = `${monthNames[month]} ${year}`;
                }
              } else {
                const date = new Date(rawP);
                if (!isNaN(date.getTime())) {
                  monthKey = `${
                    monthNames[date.getMonth()]
                  } ${date.getFullYear()}`;
                }
              }
            } catch (err) {
              console.warn("Failed to parse date from P:", rawP);
            }

            if (!monthKey) return;

            monthlySalesMap.set(
              monthKey,
              (monthlySalesMap.get(monthKey) || 0) + cleanedZ
            );
          });

          const dynamicSalesData = Array.from(monthlySalesMap.entries())
            .map(([month, sales]) => {
              const dateObj = new Date("1 " + month);
              return {
                name: month,
                sales: Math.round(sales),
                dateSort: isNaN(dateObj.getTime()) ? new Date() : dateObj,
              };
            })
            .sort((a, b) => a.dateSort - b.dateSort)
            .slice(-12)
            .map(({ name, sales }) => ({ name, sales }));

          setSalesData(
            dynamicSalesData.length
              ? dynamicSalesData
              : [{ name: "No Valid Data", sales: 0 }]
          );
        }
      } catch (err) {
        console.error("❌ Fetch Error:", err);
        setSalesData([{ name: "Fetch Error", sales: 0 }]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="p-8 text-center font-semibold text-blue-600">
        Loading sales data...
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden w-full max-w-4xl mx-auto">
      <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-6 sm:px-8 py-6">
        <h3 className="md:text-2xl font-bold text-white mb-2">Monthly Sales</h3>
        <p className="text-blue-50 md:text-lg">
          Track your sales performance over time
        </p>
      </div>
      <div className="w-full px-2 sm:px-4 md:px-6 py-4">
        <div className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl shadow-sm sm:shadow-md p-3 sm:p-4 md:p-6">
          <div className="w-full h-48 xs:h-56 sm:h-64 md:h-80">
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
                  barSize={window.innerWidth < 640 ? 20 : 30}
                />
                <defs>
                  <linearGradient
                    id="salesGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#1d4ed8" />
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
*/

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

// Helper function to parse and format dates from various Google Sheets formats
const parseDate = (dateValue) => {
  if (!dateValue) return null;
  try {
    let date;
    if (typeof dateValue === 'string' && dateValue.startsWith('Date(')) {
      const match = dateValue.match(/Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,(\d{1,2}),(\d{1,2}),(\d{1,2}))?\)/);
      if (match) {
        date = new Date(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
      }
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'number' && dateValue > 0) {
      // Excel/Google Sheets numeric date format
      const excelEpoch = new Date(1899, 11, 30);
      date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
    } else if (typeof dateValue === 'string') {
      date = new Date(dateValue);
      if (isNaN(date.getTime())) {
        // Try DD/MM/YYYY
        const ddmmyyyy = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (ddmmyyyy) {
          date = new Date(ddmmyyyy[3], parseInt(ddmmyyyy[2]) - 1, ddmmyyyy[1]);
        } else {
          // Try MM/DD/YYYY as fallback
          const mmddyyyy = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          if (mmddyyyy) {
            date = new Date(mmddyyyy[3], parseInt(mmddyyyy[1]) - 1, mmddyyyy[2]);
          }
        }
      }
    }
    return (!date || isNaN(date.getTime())) ? null : date;
  } catch (error) {
    console.error('Error parsing date:', error, 'Original value:', dateValue);
    return null;
  }
};


function MonthlySales({ filteredData, FMS_COLUMNS_INFO }) {
  const [salesData, setSalesData] = useState([]);
  const [isLoading, setIsLoading] = useState(true); 

  useEffect(() => {
    if (!filteredData || filteredData.length === 0) {
      setSalesData([{ name: "No Valid Data", sales: 0 }]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];

    const monthlySalesMap = new Map();

    const salesValueColProperty = Object.values(FMS_COLUMNS_INFO).find(info => info.label === "Value of Order")?.property || "col25";
    const timestampColProperty = Object.values(FMS_COLUMNS_INFO).find(info => info.label === "Timestamp")?.property || "col0";

    filteredData.forEach((row) => {
      const rawSales = row[salesValueColProperty]; 
      const rawTimestamp = row[timestampColProperty]; 

      if (!rawSales || !rawTimestamp) return;

      const cleanedSales = parseFloat(String(rawSales).replace(/[^\d.]/g, ""));
      if (isNaN(cleanedSales) || cleanedSales <= 0) return;

      const date = parseDate(rawTimestamp); // Use the new parseDate helper
      if (!date) return;

      const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;

      monthlySalesMap.set(
        monthKey,
        (monthlySalesMap.get(monthKey) || 0) + cleanedSales
      );
    });

    // Sort data chronologically and limit to the last 12 months
    const dynamicSalesData = Array.from(monthlySalesMap.entries())
      .map(([month, sales]) => {
        const [monthName, year] = month.split(" ");
        const monthIndex = monthNames.indexOf(monthName);
        const dateObj = new Date(parseInt(year), monthIndex); 
        return {
          name: month,
          sales: Math.round(sales),
          dateSort: dateObj,
        };
      })
      .sort((a, b) => a.dateSort.getTime() - b.dateSort.getTime()) 
      .slice(-12) 
      .map(({ name, sales }) => ({ name, sales }));

    setSalesData(
      dynamicSalesData.length
        ? dynamicSalesData
        : [{ name: "No Valid Data", sales: 0 }]
    );
    setIsLoading(false);
  }, [filteredData, FMS_COLUMNS_INFO]); 

  if (isLoading) {
    return (
      <div className="p-8 text-center font-semibold text-blue-600">
        Loading sales data...
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden w-full max-w-4xl mx-auto">
      <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 px-6 sm:px-8 py-6">
        <h3 className="md:text-2xl font-bold text-white mb-2">Monthly Sales</h3>
        <p className="text-blue-50 md:text-lg">
          Track your sales performance over time
        </p>
      </div>
      <div className="w-full px-2 sm:px-4 md:px-6 py-4">
        <div className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl shadow-sm sm:shadow-md p-3 sm:p-4 md:p-6">
          <div className="w-full h-48 xs:h-56 sm:h-64 md:h-80">
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
                  barSize={window.innerWidth < 640 ? 20 : 30}
                />
                <defs>
                  <linearGradient
                    id="salesGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#1d4ed8" />
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