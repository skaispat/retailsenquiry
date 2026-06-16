import React, { useState, useEffect, useContext } from 'react';
import {
  Truck,
  RefreshCw,
  Calendar,
  User,
  Info,
  MapPin,
  Package,
  ClipboardCheck,
  History,
  X,
  Search
} from 'lucide-react';
import supabase from '../SupaabseClient';
import { AuthContext } from '../App';

function Dispatch() {
  const { isAdmin, currentUser } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('pending');
  const [pendingOrders, setPendingOrders] = useState([]);
  const [dispatchHistory, setDispatchHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [dispatchDate, setDispatchDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [dispatchQty, setDispatchQty] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Fetch tracking history for orders
      let ordersQuery = supabase
        .from('tracking_history')
        .select('id, created_at, order_qty, sales_person_name, deler_distributer_site_name, order_products')
        .not('order_qty', 'is', null)
        .order('created_at', { ascending: false });

      if (!isAdmin() && currentUser?.salesPersonName) {
        ordersQuery = ordersQuery.eq('sales_person_name', currentUser.salesPersonName);
      }

      const { data: ordersData, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;

      // 2. Fetch dispatch history
      let dispatchQuery = supabase
        .from('dispatch')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isAdmin() && currentUser?.salesPersonName) {
        dispatchQuery = dispatchQuery.eq('sales_person_name', currentUser.salesPersonName);
      }

      const { data: dispatchData, error: dispatchError } = await dispatchQuery;
      if (dispatchError) throw dispatchError;

      const formattedDispatch = (dispatchData || []).map(row => {
        const date = new Date(row.dispatch_date || row.created_at);
        const year = date.getFullYear();
        const monthStr = String(date.getMonth() + 1).padStart(2, '0');
        return {
          ...row,
          monthKey: `${year}-${monthStr}`
        };
      });
      setDispatchHistory(formattedDispatch);

      // 3. Process orders to calculate pending quantities
      const dispatchSums = {};
      if (dispatchData) {
        dispatchData.forEach(d => {
          if (!dispatchSums[d.order_id]) {
            dispatchSums[d.order_id] = 0;
          }
          dispatchSums[d.order_id] += Number(d.dispatch_qty) || 0;
        });
      }

      const pending = [];
      if (ordersData) {
        ordersData.forEach(order => {
          const rawQty = order.order_qty;
          if (!rawQty) return;

          // Parse numeric quantity from text like "2 Tons"
          const totalOrderQty = parseFloat(String(rawQty).replace(/[^\d.]/g, ""));
          if (isNaN(totalOrderQty) || totalOrderQty <= 0) return;

          const dispatchedQty = dispatchSums[order.id] || 0;
          const pendingQty = Math.round((totalOrderQty - dispatchedQty) * 100) / 100;

          if (pendingQty > 0) {
            const date = new Date(order.created_at);
            const year = date.getFullYear();
            const monthStr = String(date.getMonth() + 1).padStart(2, '0');
            pending.push({
              ...order,
              displayDate: date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
              monthKey: `${year}-${monthStr}`,
              numericOrderQty: totalOrderQty,
              dispatchedQty,
              pendingQty
            });
          }
        });
      }

      setPendingOrders(pending);

    } catch (err) {
      console.error("Error fetching dispatch data:", err);
      if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('Network Error'))) {
        setError("Low internet connectivity. Please check your connection and try again.");
      } else {
        setError(err.message || "Failed to load dispatch data");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredPendingOrders = pendingOrders.filter(row => {
    const matchesMonth = selectedMonth ? row.monthKey === selectedMonth : true;
    const matchesSearch = searchQuery === '' ||
      String(row.displayDate || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(row.sales_person_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(row.deler_distributer_site_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(row.numericOrderQty || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(row.pendingQty || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMonth && matchesSearch;
  });

  const filteredDispatchHistory = dispatchHistory.filter(row => {
    const matchesMonth = selectedMonth ? row.monthKey === selectedMonth : true;
    const dateString = row.dispatch_date ? new Date(row.dispatch_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const matchesSearch = searchQuery === '' ||
      String(dateString).toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(row.sales_person_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(row.dealer_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(row.order_qty || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(row.dispatch_qty || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(row.pending_qty || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMonth && matchesSearch;
  });

  const handleProcessClick = (order) => {
    setSelectedOrder(order);
    setDispatchQty('');

    // Reset date to today
    const today = new Date();
    setDispatchDate(today.toISOString().split('T')[0]);
    setShowModal(true);
  };

  const handleDispatchSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;

    const qty = parseFloat(dispatchQty);
    if (isNaN(qty) || qty <= 0) {
      alert("Please enter a valid dispatch quantity greater than 0.");
      return;
    }

    if (qty > selectedOrder.pendingQty) {
      alert(`Dispatch quantity cannot exceed pending quantity (${selectedOrder.pendingQty}).`);
      return;
    }

    const calculatedPendingQty = Math.round((selectedOrder.pendingQty - qty) * 100) / 100;

    try {
      setIsSubmitting(true);

      const insertData = {
        order_id: selectedOrder.id,
        dealer_name: selectedOrder.deler_distributer_site_name || '',
        sales_person_name: selectedOrder.sales_person_name || '',
        order_qty: selectedOrder.numericOrderQty,
        dispatch_qty: qty,
        dispatch_date: dispatchDate,
        pending_qty: calculatedPendingQty
      };

      const { error } = await supabase
        .from('dispatch')
        .insert([insertData]);

      if (error) throw error;

      // Close modal and refresh data
      setShowModal(false);
      setSelectedOrder(null);
      await fetchData();

    } catch (err) {
      console.error("Error submitting dispatch:", err);
      alert(err.message || "Failed to process dispatch");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 mx-auto mb-4 animate-spin text-[#800000]" />
          <p className="font-medium text-gray-600">Loading dispatch data...</p>
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
            <h2 className="text-xl font-bold text-gray-800 mb-2">Error Loading Data</h2>
            <p className="text-gray-600">{error}</p>
            <button
              onClick={fetchData}
              className="mt-4 px-4 py-2 bg-[#800000] text-white rounded-lg hover:bg-[#990000] transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-3 bg-gradient-to-br from-slate-50 via-red-50 to-rose-50 sm:p-6">
      <div className="mx-auto space-y-4 max-w-7xl sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1 sm:space-y-2 flex-1 min-w-0 w-full sm:w-auto">
            <h1 className="text-lg font-bold text-transparent sm:text-2xl md:text-3xl bg-gradient-to-r from-[#800000] via-[#a30000] to-[#cc0000] bg-clip-text flex items-center gap-2 sm:gap-3">
              <Truck className="w-6 h-6 sm:w-10 sm:h-10 text-[#800000] shrink-0" />
              <span className="truncate">Monthly Dispatch</span>
            </h1>
            <p className="text-xs font-medium sm:text-base md:text-lg text-slate-600 leading-tight sm:leading-normal">
              Process dispatches and view history
            </p>
          </div>
          <div className="flex flex-row items-center gap-2 w-full sm:w-auto">
            {/* Search Filter */}
            <div className="flex-1 sm:flex-none relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400 group-focus-within:text-[#800000] transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Search dispatch..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#800000]/20 focus:border-[#800000] transition-all bg-white/80 backdrop-blur-sm shadow-sm"
              />
            </div>
            {/* Month Filter */}
            <div className="flex items-center gap-1 sm:gap-2 bg-white px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg border border-gray-200 shadow-sm focus-within:ring-2 focus-within:ring-[#800000] flex-shrink-0">
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
            className={`py-3 px-3 sm:px-6 font-semibold text-xs sm:text-base border-b-2 transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 ${activeTab === 'pending' ? 'border-[#800000] text-[#800000]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('pending')}
          >
            <ClipboardCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Pending Orders
            <span className="ml-1.5 px-2 py-0.5 rounded-full bg-red-100 text-[#800000] text-[10px] sm:text-xs">
              {filteredPendingOrders.length}
            </span>
          </button>
          <button
            className={`py-3 px-3 sm:px-6 font-semibold text-xs sm:text-base border-b-2 transition-colors flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 ${activeTab === 'history' ? 'border-[#800000] text-[#800000]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('history')}
          >
            <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Dispatch History
            <span className="ml-1.5 px-2 py-0.5 rounded-full bg-red-100 text-[#800000] text-[10px] sm:text-xs">
              {filteredDispatchHistory.length}
            </span>
          </button>
        </div>

        {/* Data Tables */}
        {activeTab === 'pending' ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-[#800000] to-[#b30000] text-white">
                    <th className="p-4 font-semibold text-sm sm:text-base whitespace-nowrap">Order Date</th>
                    {isAdmin() && <th className="p-4 font-semibold text-sm sm:text-base whitespace-nowrap">Sales Person</th>}
                    <th className="p-4 font-semibold text-sm sm:text-base whitespace-nowrap">Dealer Name</th>
                    <th className="p-4 font-semibold text-sm sm:text-base whitespace-nowrap text-center">Order Qty</th>
                    <th className="p-4 font-semibold text-sm sm:text-base whitespace-nowrap text-right">Pending Qty</th>
                    <th className="p-4 font-semibold text-sm sm:text-base whitespace-nowrap text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredPendingOrders.length > 0 ? (
                    filteredPendingOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-red-50/50 transition-colors">
                        <td className="p-4 text-sm sm:text-base font-medium text-gray-700 whitespace-nowrap">{order.displayDate}</td>
                        {isAdmin() && <td className="p-4 text-sm sm:text-base text-gray-600 whitespace-nowrap">{order.sales_person_name}</td>}
                        <td className="p-4 text-sm sm:text-base text-gray-600">{order.deler_distributer_site_name || '-'}</td>
                        <td className="p-4 text-sm sm:text-base text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-medium text-gray-600">{order.numericOrderQty}</span>
                            {order.dispatchedQty > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 whitespace-nowrap">
                                {order.dispatchedQty} Dispatched
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-sm sm:text-base text-[#800000] text-right font-bold">{order.pendingQty}</td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => handleProcessClick(order)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#800000] hover:bg-[#990000] text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                          >
                            <Truck className="w-4 h-4" />
                            Process
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={isAdmin() ? "7" : "6"} className="p-8 text-center text-gray-500 font-medium">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <ClipboardCheck className="w-8 h-8 text-gray-400" />
                          No pending orders found.
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
                  <tr className="bg-gradient-to-r from-gray-700 to-gray-900 text-white">
                    <th className="p-4 font-semibold text-sm sm:text-base whitespace-nowrap">Dispatch Date</th>
                    {isAdmin() && <th className="p-4 font-semibold text-sm sm:text-base whitespace-nowrap">Sales Person</th>}
                    <th className="p-4 font-semibold text-sm sm:text-base whitespace-nowrap">Dealer/Site</th>
                    <th className="p-4 font-semibold text-sm sm:text-base whitespace-nowrap text-right">Order Qty</th>
                    <th className="p-4 font-semibold text-sm sm:text-base whitespace-nowrap text-right text-emerald-300">Dispatch Qty</th>
                    <th className="p-4 font-semibold text-sm sm:text-base whitespace-nowrap text-right text-amber-300">Pending Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDispatchHistory.length > 0 ? (
                    filteredDispatchHistory.map((row) => (
                      <tr key={row.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="p-4 text-sm sm:text-base font-medium text-gray-700 whitespace-nowrap">
                          {new Date(row.dispatch_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        {isAdmin() && <td className="p-4 text-sm sm:text-base text-gray-600 whitespace-nowrap">{row.sales_person_name}</td>}
                        <td className="p-4 text-sm sm:text-base text-gray-600">{row.dealer_name || '-'}</td>
                        <td className="p-4 text-sm sm:text-base text-gray-600 text-right">{row.order_qty}</td>
                        <td className="p-4 text-sm sm:text-base font-bold text-emerald-600 text-right">
                          {row.dispatch_qty}
                        </td>
                        <td className="p-4 text-sm sm:text-base font-medium text-amber-600 text-right">
                          {row.pending_qty}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={isAdmin() ? "6" : "5"} className="p-8 text-center text-gray-500 font-medium">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <History className="w-8 h-8 text-gray-400" />
                          No dispatch history found.
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

      {/* Process Dispatch Modal */}
      {showModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#800000]" />
                Process Dispatch
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleDispatchSubmit} className="p-6">

              {/* Order Summary Info */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">Dealer</span>
                    <p className="text-sm font-semibold text-gray-800 truncate" title={selectedOrder.deler_distributer_site_name}>
                      {selectedOrder.deler_distributer_site_name || '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase">Sales Person</span>
                    <p className="text-sm font-semibold text-gray-800 truncate" title={selectedOrder.sales_person_name}>
                      {selectedOrder.sales_person_name || '-'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                  <div>
                    <span className="text-xs font-medium text-gray-500 uppercase block mb-0.5">Order Qty</span>
                    <span className="text-sm font-bold text-gray-700">{selectedOrder.numericOrderQty}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-medium text-gray-500 uppercase block mb-0.5">Pending Qty</span>
                    <span className="text-base font-bold text-[#800000]">{selectedOrder.pendingQty}</span>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    Dispatch Date
                  </label>
                  <input
                    type="date"
                    required
                    value={dispatchDate}
                    onChange={(e) => setDispatchDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-[#800000] focus:border-[#800000] transition-colors shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-gray-400" />
                    Dispatch Quantity
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={selectedOrder.pendingQty}
                      required
                      value={dispatchQty}
                      onChange={(e) => setDispatchQty(e.target.value)}
                      placeholder={`Max: ${selectedOrder.pendingQty}`}
                      className="w-full px-4 py-2.5 bg-white border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-[#800000] focus:border-[#800000] transition-colors shadow-sm text-lg font-medium"
                    />
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm font-medium">Tons</span>
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    Remaining after dispatch: <span className="font-semibold text-gray-700">
                      {(selectedOrder.pendingQty - (parseFloat(dispatchQty) || 0)).toFixed(2)}
                    </span>
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex items-center gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !dispatchQty || parseFloat(dispatchQty) <= 0 || parseFloat(dispatchQty) > selectedOrder.pendingQty}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-[#800000] border border-transparent rounded-lg hover:bg-[#990000] focus:ring-2 focus:ring-[#800000] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Truck className="w-4 h-4" />
                      Confirm Dispatch
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default Dispatch;
