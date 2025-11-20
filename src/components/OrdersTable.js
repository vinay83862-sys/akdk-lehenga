// OrdersTable.js - COMPLETE VERSION WITH DETAILED ORDER MODAL
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../firebase';
import './OrdersTable.css';
import PrintOrder from './PrintOrder';
import WhatsAppIntegration from './WhatsAppIntegration';
import KanbanView from './KanbanView';

function OrdersTable({ onEditOrder, onNavigate, highlightOrder, searchTerm: initialSearchTerm, filterOrderId, onAddNotification }) {
  // Core states
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [currentOrders, setCurrentOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [salesmen, setSalesmen] = useState([]);
  const [printOrderId, setPrintOrderId] = useState(null);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [stockItems, setStockItems] = useState([]);
  
  // View mode state
  const [viewMode, setViewMode] = useState('table');
  
  // Advanced filter states
  const [showOverdue, setShowOverdue] = useState(false);
  const [showPendingAmount, setShowPendingAmount] = useState(false);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [orderDateRange, setOrderDateRange] = useState({ from: '', to: '' });
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage, setOrdersPerPage] = useState(10);
  const [isFilteredByNotification, setIsFilteredByNotification] = useState(false);

  // Performance & Bulk Operations
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [sortConfig, setSortConfig] = useState([{ key: 'createdAt', direction: 'desc' }]);

  // Export & UI Features
  const [exportFormat, setExportFormat] = useState('csv');
  const [showExportModal, setShowExportModal] = useState(false);

  // WhatsApp Integration State
  const [whatsappModal, setWhatsappModal] = useState({
    show: false,
    order: null
  });

  // Order Details Modal State
  const [showOrderDetails, setShowOrderDetails] = useState(false);

  // AI Suggestions State
  const [aiSuggestions, setAiSuggestions] = useState([]);

  // Theme state
  const [theme, setTheme] = useState('dark');

  const statusColors = {
    'Pending': '#ffc107',
    'Confirmed': '#17a2b8',
    'On Stitching': '#f59e0b',
    'Stitched': '#6f42c1',
    'Ready': '#20c997',
    'Delivered': '#28a745',
    'Cancelled': '#dc3545'
  };

  // ==================== NOTIFICATION FUNCTIONS ====================

  const addNotification = (type, message, icon = '📢') => {
    if (onAddNotification) {
      onAddNotification({
        id: Date.now(),
        type,
        message,
        icon,
        time: new Date().toLocaleTimeString(),
        read: false
      });
    }
  };

  // ==================== BARCODE COPY FUNCTIONALITY ====================

  const copyBarcode = (order) => {
    if (order.lehengaDetails && order.lehengaDetails.length > 0) {
      const lehengaDesign = order.lehengaDetails[0].design;
      const stockItem = stockItems.find(item => item.design === lehengaDesign);
      
      if (stockItem && stockItem.barcode) {
        let barcode = stockItem.barcode.toString();
        
        // Remove first 3 digits if barcode starts with '600'
        if (barcode.startsWith('600')) {
          barcode = barcode.substring(3);
        }
        
        navigator.clipboard.writeText(barcode)
          .then(() => {
            addNotification('success', `Barcode ${barcode} copied to clipboard!`, '📋');
          })
          .catch(err => {
            console.error('Failed to copy: ', err);
            addNotification('error', 'Failed to copy barcode', '❌');
          });
      } else {
        addNotification('warning', 'No barcode found for this design', '⚠️');
      }
    } else {
      addNotification('warning', 'No design information available', '⚠️');
    }
  };

  // ==================== ORDER DETAILS MODAL ====================

  const openOrderDetails = (order) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  // ==================== AI SUGGESTIONS ====================

  const generateAISuggestions = useCallback(() => {
    const suggestions = [];
    
    // Overdue order suggestions
    const overdueOrders = filteredOrders.filter(order => 
      isDeliveryDateOverdue(order.deliveryDate) && 
      order.status !== 'Delivered' && 
      order.status !== 'Cancelled'
    );
    
    if (overdueOrders.length > 0) {
      suggestions.push({
        type: 'warning',
        message: `${overdueOrders.length} orders are overdue. Consider updating their status.`,
        action: () => {
          setShowOverdue(true);
          setStatusFilter('all');
        },
        icon: '⚠️',
        priority: 1
      });
    }
    
    // High value pending amount suggestions
    const highPendingOrders = filteredOrders.filter(order => 
      parseFloat(order.pendingAmount) > 5000
    );
    
    if (highPendingOrders.length > 0) {
      suggestions.push({
        type: 'info',
        message: `${highPendingOrders.length} orders have pending amount > ₹5,000. Send payment reminders.`,
        action: () => {
          setShowPendingAmount(true);
          setStatusFilter('all');
        },
        icon: '💰',
        priority: 2
      });
    }
    
    // Stagnant orders suggestions
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const stagnantOrders = filteredOrders.filter(order => {
      const orderDate = parseOrderDate(order.createdAt);
      return orderDate && orderDate < weekAgo && order.status === 'Pending';
    });
    
    if (stagnantOrders.length > 0) {
      suggestions.push({
        type: 'warning',
        message: `${stagnantOrders.length} orders are pending for more than 7 days. Follow up needed.`,
        action: () => setStatusFilter('pending'),
        icon: '⏰',
        priority: 3
      });
    }

    // Low stock alerts based on orders
    const popularDesigns = {};
    orders.forEach(order => {
      if (order.lehengaDetails) {
        order.lehengaDetails.forEach(lehenga => {
          if (lehenga.design) {
            popularDesigns[lehenga.design] = (popularDesigns[lehenga.design] || 0) + 1;
          }
        });
      }
    });

    const lowStockAlerts = Object.entries(popularDesigns)
      .filter(([design, count]) => {
        const stockItem = stockItems.find(item => item.design === design);
        return stockItem && stockItem.amount < 10000 && count > 2;
      });

    if (lowStockAlerts.length > 0) {
      suggestions.push({
        type: 'error',
        message: `${lowStockAlerts.length} popular designs are running low on stock. Consider restocking.`,
        action: () => onNavigate('stock'),
        icon: '📦',
        priority: 4
      });
    }

    // Sort by priority and limit to 3 suggestions
    setAiSuggestions(suggestions.sort((a, b) => a.priority - b.priority).slice(0, 3));
  }, [filteredOrders, stockItems, orders, onNavigate]);

  // ==================== UTILITY FUNCTIONS ====================

  const parseDeliveryDate = useCallback((dateValue) => {
    if (!dateValue) return null;
    try {
      let date;
      if (typeof dateValue === 'string' && dateValue.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
        const parts = dateValue.split('-');
        date = new Date(parts[2], parts[1] - 1, parts[0]);
      } else if (typeof dateValue === 'string' && dateValue.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        const parts = dateValue.split('/');
        date = new Date(parts[2], parts[1] - 1, parts[0]);
      } else if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
        date = new Date(dateValue);
      } else if (typeof dateValue === 'number') {
        date = new Date(dateValue);
      } else if (typeof dateValue === 'object' && dateValue.seconds) {
        date = new Date(dateValue.seconds * 1000);
      } else {
        date = new Date(dateValue);
      }
      return isNaN(date.getTime()) ? null : date;
    } catch (error) {
      console.error('Error parsing delivery date:', error);
      return null;
    }
  }, []);

  const parseOrderDate = useCallback((timestamp) => {
    if (!timestamp) return null;
    try {
      let date;
      if (typeof timestamp === 'object' && timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
      } else if (typeof timestamp === 'string') {
        const parsedTimestamp = parseInt(timestamp);
        date = isNaN(parsedTimestamp) ? new Date(timestamp) : new Date(parsedTimestamp);
      } else if (typeof timestamp === 'number') {
        date = new Date(timestamp);
      } else {
        return null;
      }
      return isNaN(date.getTime()) ? null : date;
    } catch (error) {
      console.error('Error parsing order date:', error);
      return null;
    }
  }, []);

  const isDeliveryDateOverdue = useCallback((deliveryDate) => {
    const parsedDate = parseDeliveryDate(deliveryDate);
    if (!parsedDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    parsedDate.setHours(0, 0, 0, 0);
    return parsedDate < today;
  }, [parseDeliveryDate]);

  // ==================== CUSTOM HOOKS ====================

  function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
      const handler = setTimeout(() => setDebouncedValue(value), delay);
      return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
  }

  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const memoizedOrders = useMemo(() => orders, [orders]);

  // ==================== CALCULATIONS ====================

  const quickStats = useMemo(() => {
    const today = new Date().toDateString();
    return {
      total: filteredOrders.length,
      today: filteredOrders.filter(order => 
        new Date(order.createdAt).toDateString() === today
      ).length,
      pendingAmount: filteredOrders.reduce((sum, order) => 
        sum + (parseFloat(order.pendingAmount) || 0), 0
      ),
      overdue: filteredOrders.filter(order => 
        isDeliveryDateOverdue(order.deliveryDate) && 
        order.status !== 'Delivered' && 
        order.status !== 'Cancelled'
      ).length,
      revenue: filteredOrders.reduce((sum, order) => 
        sum + (parseFloat(order.totalAmount) || 0), 0
      )
    };
  }, [filteredOrders, isDeliveryDateOverdue]);

  const sortedOrders = useMemo(() => {
    if (!filteredOrders.length) return [];
    return [...filteredOrders].sort((a, b) => {
      for (const sort of sortConfig) {
        let aValue = a[sort.key];
        let bValue = b[sort.key];
        switch (sort.key) {
          case 'customerName': aValue = a.customerName?.toLowerCase() || ''; bValue = b.customerName?.toLowerCase() || ''; break;
          case 'billNumber': aValue = a.billNumber || ''; bValue = b.billNumber || ''; break;
          case 'totalAmount': aValue = parseFloat(a.totalAmount) || 0; bValue = parseFloat(b.totalAmount) || 0; break;
          case 'deliveryDate': aValue = parseDeliveryDate(a.deliveryDate)?.getTime() || 0; bValue = parseDeliveryDate(b.deliveryDate)?.getTime() || 0; break;
          case 'createdAt': aValue = parseOrderDate(a.createdAt)?.getTime() || 0; bValue = parseOrderDate(b.createdAt)?.getTime() || 0; break;
          default: aValue = aValue?.toString().toLowerCase() || ''; bValue = bValue?.toString().toLowerCase() || '';
        }
        if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [filteredOrders, sortConfig, parseDeliveryDate, parseOrderDate]);

  // ==================== EXPORT FUNCTIONALITY ====================

  const exportToExcel = () => {
    try {
      // Create worksheet data
      const worksheetData = filteredOrders.map(order => ({
        'Bill No': order.billNumber,
        'Customer': order.customerName,
        'Phone': order.phoneNumber,
        'Total Amount': order.totalAmount,
        'Paid Amount': order.paidAmount,
        'Pending Amount': order.pendingAmount,
        'Status': order.status,
        'Delivery Date': formatDate(order.deliveryDate),
        'Order Date': formatDateTime(order.createdAt),
        'Notes': order.notes || ''
      }));

      // Create CSV content
      const headers = Object.keys(worksheetData[0] || {});
      const csvContent = [
        headers.join(','),
        ...worksheetData.map(row => 
          headers.map(header => `"${row[header] || ''}"`).join(',')
        )
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `Orders_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addNotification('success', 'Orders exported to CSV', '📊');
    } catch (error) {
      console.error('Export error:', error);
      addNotification('error', 'Failed to export orders', '❌');
    }
  };

  // ==================== THEME TOGGLE ====================

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // ==================== KEYBOARD SHORTCUTS ====================

  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ctrl/Cmd + K for search focus
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector('.search-bar input')?.focus();
      }
      
      // ESC to close modals
      if (e.key === 'Escape') {
        setWhatsappModal({ show: false, order: null });
        setShowOrderDetails(false);
        setShowExportModal(false);
        setShowBulkModal(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // ==================== EFFECTS ====================

  useEffect(() => {
    setLoading(true);
    const ordersRef = ref(db, 'Orders');
    const salesmenRef = ref(db, 'salesmen');
    const stockRef = ref(db, 'Stock');
    
    const unsubscribeOrders = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const ordersArray = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value
        }));
        ordersArray.sort((a, b) => {
          const dateA = a.createdAt || 0;
          const dateB = b.createdAt || 0;
          return dateB - dateA;
        });
        setOrders(ordersArray);
      } else {
        setOrders([]);
      }
      setLoading(false);
      setIsInitialLoad(false);
    }, (error) => {
      setError(error.message);
      setLoading(false);
    });

    const unsubscribeSalesmen = onValue(salesmenRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const salesmenList = Object.entries(data).map(([id, salesman]) => ({
          id,
          ...salesman
        }));
        setSalesmen(salesmenList);
      }
    });

    const unsubscribeStock = onValue(stockRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const stockList = Object.entries(data).map(([id, item]) => ({
          id,
          ...item
        }));
        setStockItems(stockList);
      }
    });

    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    return () => {
      unsubscribeOrders();
      unsubscribeSalesmen();
      unsubscribeStock();
    };
  }, []);

  useEffect(() => {
    let result = memoizedOrders;
    
    if (isFilteredByNotification && filterOrderId) {
      result = result.filter(order => order.id === filterOrderId);
    } else if (debouncedSearchTerm) {
      result = result.filter(order => 
        (order.customerName && order.customerName.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
        (order.billNumber && order.billNumber.toString().includes(debouncedSearchTerm)) ||
        (order.phoneNumber && order.phoneNumber.includes(debouncedSearchTerm)) ||
        (order.lehengaDetails && order.lehengaDetails.some(lehenga => 
          lehenga.design && lehenga.design.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
        ))
      );
    }
    
    if (statusFilter !== 'all') {
      result = result.filter(order => 
        order.status && order.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }
    
    if (showOverdue) {
      result = result.filter(order => isDeliveryDateOverdue(order.deliveryDate) && order.status !== 'Delivered' && order.status !== 'Cancelled');
    }
    
    if (showPendingAmount) {
      result = result.filter(order => (parseFloat(order.pendingAmount) || 0) > 0);
    }
    
    if (dateRange.from || dateRange.to) {
      result = result.filter(order => {
        const deliveryDate = parseDeliveryDate(order.deliveryDate);
        if (!deliveryDate) return false;
        const fromDate = dateRange.from ? new Date(dateRange.from) : null;
        const toDate = dateRange.to ? new Date(dateRange.to) : null;
        let valid = true;
        if (fromDate) {
          fromDate.setHours(0, 0, 0, 0);
          valid = valid && deliveryDate >= fromDate;
        }
        if (toDate) {
          toDate.setHours(23, 59, 59, 999);
          valid = valid && deliveryDate <= toDate;
        }
        return valid;
      });
    }
    
    if (orderDateRange.from || orderDateRange.to) {
      result = result.filter(order => {
        const orderDate = parseOrderDate(order.createdAt);
        if (!orderDate) return false;
        const fromDate = orderDateRange.from ? new Date(orderDateRange.from) : null;
        const toDate = orderDateRange.to ? new Date(orderDateRange.to) : null;
        let valid = true;
        if (fromDate) {
          fromDate.setHours(0, 0, 0, 0);
          valid = valid && orderDate >= fromDate;
        }
        if (toDate) {
          toDate.setHours(23, 59, 59, 999);
          valid = valid && orderDate <= toDate;
        }
        return valid;
      });
    }
    
    setFilteredOrders(result);
    setCurrentPage(1);
  }, [memoizedOrders, debouncedSearchTerm, statusFilter, showOverdue, showPendingAmount, dateRange, orderDateRange, isDeliveryDateOverdue, isFilteredByNotification, filterOrderId, parseDeliveryDate, parseOrderDate]);

  useEffect(() => {
    const indexOfLastOrder = currentPage * ordersPerPage;
    const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
    setCurrentOrders(sortedOrders.slice(indexOfFirstOrder, indexOfLastOrder));
  }, [sortedOrders, currentPage, ordersPerPage]);

  useEffect(() => {
    generateAISuggestions();
  }, [generateAISuggestions]);

  // ==================== BULK OPERATIONS ====================

  const toggleOrderSelection = (orderId) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrders.length === currentOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(currentOrders.map(order => order.id));
    }
  };

  const handleBulkStatusUpdate = async (newStatus) => {
    try {
      setLoading(true);
      const updates = {};
      selectedOrders.forEach(orderId => {
        updates[`Orders/${orderId}/status`] = newStatus;
        updates[`Orders/${orderId}/updatedAt`] = Date.now();
        updates[`Orders/${orderId}/updatedBy`] = 'Bulk Update';
      });
      
      await update(ref(db), updates);
      addNotification('success', `Updated ${selectedOrders.length} orders to ${newStatus}`, '✅');
      setSelectedOrders([]);
      setBulkAction('');
      setShowBulkModal(false);
    } catch (error) {
      addNotification('error', `Bulk update failed: ${error.message}`, '❌');
    } finally {
      setLoading(false);
    }
  };

  // ==================== UI HELPER FUNCTIONS ====================

  const formatDate = (dateValue) => {
    const parsedDate = parseDeliveryDate(dateValue);
    if (!parsedDate) return 'N/A';
    const day = String(parsedDate.getDate()).padStart(2, '0');
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const year = parsedDate.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formatDateTime = (dateValue) => {
    if (!dateValue) return 'N/A';
    try {
      let date;
      if (typeof dateValue === 'object' && dateValue.seconds) {
        date = new Date(dateValue.seconds * 1000);
      } else if (typeof dateValue === 'string') {
        const timestamp = parseInt(dateValue);
        date = isNaN(timestamp) ? new Date(dateValue) : new Date(timestamp);
      } else if (typeof dateValue === 'number') {
        date = new Date(dateValue);
      } else {
        return 'Invalid Date';
      }
      if (isNaN(date.getTime())) return 'Invalid Date';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${day}-${month}-${year} ${hours}:${minutes} ${ampm}`;
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const getStatusClass = (status) => {
    if (!status) return 'status-pending';
    switch(status.toLowerCase()) {
      case 'delivered': return 'status-delivered';
      case 'confirmed': return 'status-confirmed';
      case 'on stitching': return 'status-stitching';
      case 'stitched': return 'status-stitched';
      case 'ready': return 'status-ready';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-pending';
    }
  };

  const getSalesmenNames = (lehengaSalesmen) => {
    if (!lehengaSalesmen || lehengaSalesmen.length === 0) return 'N/A';
    return lehengaSalesmen.map(salesmanId => {
      const salesman = salesmen.find(s => s.id === salesmanId);
      return salesman ? salesman.name : salesmanId;
    }).join(', ');
  };

  const handleSort = (key) => {
    setSortConfig(prev => {
      const existingSort = prev.find(sort => sort.key === key);
      if (existingSort) {
        if (existingSort.direction === 'asc') {
          return prev.filter(sort => sort.key !== key);
        } else {
          return prev.map(sort => 
            sort.key === key 
              ? { ...sort, direction: 'asc' }
              : sort
          );
        }
      } else {
        return [...prev, { key, direction: 'desc' }];
      }
    });
  };

  const getSortIndicator = (key) => {
    const sort = sortConfig.find(s => s.key === key);
    if (!sort) return '↕️';
    return sort.direction === 'asc' ? '↑' : '↓';
  };

  const totalPages = Math.ceil(sortedOrders.length / ordersPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  
  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };
  
  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const getPageNumbers = () => {
    const pageNumbers = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      let startPage = Math.max(1, currentPage - 2);
      let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
      
      if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }
    }
    
    return pageNumbers;
  };

  // ==================== RENDER FUNCTIONS ====================

  const renderSkeletonRows = () => {
    return Array.from({ length: 5 }).map((_, index) => (
      <tr key={`skeleton-${index}`} className="skeleton-row">
        <td><div className="loading-skeleton skeleton-cell"></div></td>
        <td><div className="loading-skeleton skeleton-cell"></div></td>
        <td><div className="loading-skeleton skeleton-cell"></div></td>
        <td><div className="loading-skeleton skeleton-cell"></div></td>
        <td><div className="loading-skeleton skeleton-cell"></div></td>
        <td><div className="loading-skeleton skeleton-cell"></div></td>
        <td><div className="loading-skeleton skeleton-cell"></div></td>
        <td><div className="loading-skeleton skeleton-cell"></div></td>
        <td><div className="loading-skeleton skeleton-cell"></div></td>
        <td><div className="loading-skeleton skeleton-cell"></div></td>
      </tr>
    ));
  };

  // ==================== ORDER DETAILS MODAL ====================

  const OrderDetailsModal = ({ order, onClose }) => (
    <div className="order-details-modal" onClick={onClose}>
      <div className="order-details-content" onClick={(e) => e.stopPropagation()}>
        <div className="order-details-header">
          <h2># Order Details - Bill #{order.billNumber}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="order-details-body">
          {/* Customer Information */}
          <div className="details-section">
            <h3>## Customer Information</h3>
            <div className="details-grid">
              <div className="detail-item">
                <strong>CUSTOMER NAME</strong>
                <span>{order.customerName || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <strong>PHONE NUMBER:</strong>
                <span>{order.phoneNumber || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <strong>BILL NUMBER:</strong>
                <span>{order.billNumber || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="section-divider"></div>

          {/* Payment Information */}
          <div className="details-section">
            <h3>## Payment Information</h3>
            <div className="details-grid">
              <div className="detail-item">
                <strong>TOTAL AMOUNT:</strong>
                <span>💰{order.totalAmount ? parseFloat(order.totalAmount).toLocaleString('en-IN') : '0'}</span>
              </div>
              <div className="detail-item">
                <strong>PAID AMOUNT:</strong>
                <span>💰{order.paidAmount ? parseFloat(order.paidAmount).toLocaleString('en-IN') : '0'}</span>
              </div>
              <div className="detail-item">
                <strong>PENDING AMOUNT:</strong>
                <span>💰{order.pendingAmount ? parseFloat(order.pendingAmount).toLocaleString('en-IN') : '0'}</span>
              </div>
            </div>
          </div>

          <div className="section-divider"></div>

          {/* Order Information */}
          <div className="details-section">
            <h3>## Order Information</h3>
            <div className="details-grid">
              <div className="detail-item">
                <strong>STATUS</strong>
                <span className={`status ${getStatusClass(order.status)}`}>
                  {order.status || 'Pending'}
                </span>
              </div>
              <div className="detail-item">
                <strong>ORDER DATE:</strong>
                <span>{formatDate(order.createdAt)}</span>
              </div>
              <div className="detail-item">
                <strong>DELIVERY DATE:</strong>
                <span>{formatDate(order.deliveryDate)}</span>
              </div>
              <div className="detail-item full-width">
                <strong>NOTES:</strong>
                <span>{order.notes || 'No notes available'}</span>
              </div>
            </div>
          </div>

          <div className="section-divider"></div>

          {/* Timestamps */}
          <div className="details-section">
            <h3>## Timestamps</h3>
            <div className="details-grid">
              <div className="detail-item">
                <strong>CREATED AT:</strong>
                <span>{formatDateTime(order.createdAt)}</span>
              </div>
              <div className="detail-item">
                <strong>CREATED BY:</strong>
                <span>{order.createdBy || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <strong>LAST UPDATED:</strong>
                <span>{order.updatedAt ? formatDateTime(order.updatedAt) : 'N/A'}</span>
              </div>
              <div className="detail-item">
                <strong>UPDATED BY:</strong>
                <span>{order.updatedBy || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Lehenga Details */}
          {order.lehengaDetails && order.lehengaDetails.length > 0 && (
            <>
              <div className="section-divider"></div>
              <div className="details-section">
                <h3>## Lehenga Details ({order.lehengaDetails.length})</h3>
                {order.lehengaDetails.map((lehenga, index) => (
                  <div key={index} className="lehenga-item-card">
                    <h4>### Lehenga #{index + 1}</h4>
                    
                    {/* Design Table - Exact like screenshot */}
                    <table className="lehenga-design-table">
                      <thead>
                        <tr>
                          <th>DESIGN</th>
                          <th>COLOR</th>
                          <th>STITCHING</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>{lehenga.design || 'N/A'}</td>
                          <td>{lehenga.color || 'N/A'}</td>
                          <td>{lehenga.stitchingOption || 'N/A'}</td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Measurements and Details - Exact like screenshot */}
                    <div className="lehenga-specs-grid">
                      <div className="spec-item">
                        <strong>SALESMEN:</strong>
                        <span>{getSalesmenNames(lehenga.salesmen)}</span>
                      </div>
                      <div className="spec-item">
                        <strong>LENGTH:</strong>
                        <span>{lehenga.length || 'N/A'}</span>
                      </div>
                      <div className="spec-item">
                        <strong>WAIST:</strong>
                        <span>{lehenga.waist || 'N/A'}</span>
                      </div>
                      <div className="spec-item">
                        <strong>HIP:</strong>
                        <span>{lehenga.hip || 'Free'}</span>
                      </div>
                      <div className="spec-item">
                        <strong>BLOUSE:</strong>
                        <span>{lehenga.blouseOption || 'N/A'}</span>
                      </div>
                      <div className="spec-item">
                        <strong>MAIN DUPATTA:</strong>
                        <span>{lehenga.mainDupatta || 'N/A'}</span>
                      </div>
                      {/* Extra Dupatta Fields */}
                      {lehenga.extraDupatta === 'Yes' && (
                        <>
                          <div className="spec-item">
                            <strong>EXTRA DUPATTA:</strong>
                            <span>{lehenga.extraDupatta || 'No'}</span>
                          </div>
                          {lehenga.extraDupattaType && (
                            <div className="spec-item">
                              <strong>EXTRA DUPATTA TYPE:</strong>
                              <span>{lehenga.extraDupattaType}</span>
                            </div>
                          )}
                          {lehenga.netDupattaColor && (
                            <div className="spec-item">
                              <strong>NET DUPATTA COLOR:</strong>
                              <span>{lehenga.netDupattaColor}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        
        <div className="order-details-footer">
          <button className="btn-primary" onClick={() => onEditOrder(order.id)}>
            ✏️ Edit Order
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );

  // ==================== MAIN RENDER ====================

  return (
    <div className="orders-management">
      {/* AI Suggestions Bar */}
      {aiSuggestions.length > 0 && (
        <div className="ai-suggestions-bar">
          <div className="suggestions-header">
            <span className="ai-icon">🤖</span>
            <strong>AI Assistant</strong>
            <span className="ai-badge">{aiSuggestions.length} suggestions</span>
          </div>
          <div className="suggestions-list">
            {aiSuggestions.map((suggestion, index) => (
              <div 
                key={index} 
                className={`suggestion-item suggestion-${suggestion.type}`}
                onClick={suggestion.action}
              >
                <span className="suggestion-icon">{suggestion.icon}</span>
                <span className="suggestion-text">{suggestion.message}</span>
                <span className="suggestion-arrow">→</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="table-header">
        <div className="header-title-section">
          <h2>📦 Order Management</h2>
          <div className="orders-count">
            {isFilteredByNotification ? (
              <span>
                Showing specific order from notification • 
                <button className="clear-notification-filter" onClick={() => setIsFilteredByNotification(false)}>
                  Show All Orders
                </button>
              </span>
            ) : (
              `Showing ${currentOrders.length} of ${sortedOrders.length} orders`
            )}
          </div>
        </div>
        
        {/* Quick Stats Dashboard */}
        <div className="quick-stats">
          <div className="stat-card" onClick={() => addNotification('info', 'Analytics feature coming soon!', '📊')}>
            <div className="stat-value">{quickStats.total}</div>
            <div className="stat-label">Total Orders</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{quickStats.today}</div>
            <div className="stat-label">Today</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">💰{quickStats.pendingAmount.toLocaleString('en-IN')}</div>
            <div className="stat-label">Pending Amount</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{quickStats.overdue}</div>
            <div className="stat-label">Overdue</div>
          </div>
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedOrders.length > 0 && (
          <div className="bulk-actions-toolbar">
            <div className="bulk-selection-info">
              <strong>{selectedOrders.length} orders selected</strong>
            </div>
            <div className="bulk-actions">
              <select 
                value={bulkAction} 
                onChange={(e) => {
                  const action = e.target.value;
                  setBulkAction(action);
                  if (action === 'export') {
                    exportToExcel();
                  } else if (action) {
                    setShowBulkModal(true);
                  }
                }}
                className="filter-select"
              >
                <option value="">Bulk Actions</option>
                <option value="confirmed">Mark as Confirmed</option>
                <option value="on stitching">Mark as On Stitching</option>
                <option value="stitched">Mark as Stitched</option>
                <option value="ready">Mark as Ready</option>
                <option value="delivered">Mark as Delivered</option>
                <option value="export">Export Selected</option>
              </select>
              {bulkAction && bulkAction !== 'export' && (
                <button 
                  className="bulk-confirm-btn"
                  onClick={() => setShowBulkModal(true)}
                >
                  Confirm
                </button>
              )}
              <button 
                className="btn-secondary"
                onClick={() => setSelectedOrders([])}
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        <div className="filters">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input 
              type="text" 
              placeholder="Search by name, bill no, phone, or design... (Ctrl+K)" 
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsFilteredByNotification(false);
              }}
            />
            {searchTerm && (
              <button 
                className="clear-search"
                onClick={() => setSearchTerm('')}
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>
          
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="on stitching">On Stitching</option>
            <option value="stitched">Stitched</option>
            <option value="ready">Ready</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* View Mode Toggle */}
          <div className="view-mode-toggle">
            <button
              className={`view-mode-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table View"
            >
              📋
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'kanban' ? 'active' : ''}`}
              onClick={() => setViewMode('kanban')}
              title="Kanban View"
            >
              🗂️
            </button>
          </div>

          <button 
            className={`btn-secondary ${showAdvancedSearch ? 'active' : ''}`}
            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
          >
            <span className="btn-icon">⚙️</span>
            Advanced
          </button>

          <button 
            className="btn-primary"
            onClick={() => onNavigate('addOrder')}
          >
            <span className="btn-icon">➕</span> Add New Order
          </button>

          <button 
            className="btn-secondary"
            onClick={exportToExcel}
            title="Export to Excel"
          >
            <span className="btn-icon">📊</span> Export
          </button>

          <button 
            className="btn-secondary"
            onClick={toggleTheme}
            title="Toggle Theme"
          >
            <span className="btn-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>
        </div>
      </div>

      {/* Advanced Search Panel */}
      {showAdvancedSearch && (
        <div className="advanced-search-panel">
          <div className="advanced-search-header">
            <h4>🔍 Advanced Search Filters</h4>
            <button className="btn-clear-filters" onClick={() => {
              setShowOverdue(false);
              setShowPendingAmount(false);
              setDateRange({ from: '', to: '' });
              setOrderDateRange({ from: '', to: '' });
            }}>
              Clear All Filters
            </button>
          </div>
          
          <div className="advanced-search-grid">
            <div className="filter-group">
              <label className="filter-label">
                <input 
                  type="checkbox" 
                  checked={showOverdue}
                  onChange={(e) => setShowOverdue(e.target.checked)}
                  className="filter-checkbox"
                />
                <span className="filter-text">Show Overdue Orders Only</span>
              </label>
              
              <label className="filter-label">
                <input 
                  type="checkbox" 
                  checked={showPendingAmount}
                  onChange={(e) => setShowPendingAmount(e.target.checked)}
                  className="filter-checkbox"
                />
                <span className="filter-text">Show Orders with Pending Amount</span>
              </label>
            </div>
            
            <div className="date-filter-group">
              <div className="date-filter">
                <label className="date-label">Order Date From:</label>
                <input 
                  type="date" 
                  value={orderDateRange.from}
                  onChange={(e) => setOrderDateRange(prev => ({ ...prev, from: e.target.value }))}
                  className="date-input"
                />
              </div>
              
              <div className="date-filter">
                <label className="date-label">Order Date To:</label>
                <input 
                  type="date" 
                  value={orderDateRange.to}
                  onChange={(e) => setOrderDateRange(prev => ({ ...prev, to: e.target.value }))}
                  className="date-input"
                />
              </div>

              <div className="date-filter">
                <label className="date-label">Delivery Date From:</label>
                <input 
                  type="date" 
                  value={dateRange.from}
                  onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                  className="date-input"
                />
              </div>
              
              <div className="date-filter">
                <label className="date-label">Delivery Date To:</label>
                <input 
                  type="date" 
                  value={dateRange.to}
                  onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                  className="date-input"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Action Modal */}
      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Bulk Status Update</h2>
              <button className="close-btn" onClick={() => setShowBulkModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>Update {selectedOrders.length} orders to <strong>{bulkAction}</strong>?</p>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-primary" 
                onClick={() => handleBulkStatusUpdate(bulkAction)}
              >
                Confirm Update
              </button>
              <button 
                className="btn-secondary" 
                onClick={() => setShowBulkModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Table View or Kanban View */}
      {viewMode === 'table' ? (
        <div className="table-responsive">
          {loading && isInitialLoad ? (
            <table className="orders-table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}></th>
                  <th>Bill No</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Salesmen</th>
                  <th>Delivery Date</th>
                  <th>Timestamp</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>{renderSkeletonRows()}</tbody>
            </table>
          ) : error ? (
            <div className="error-container">
              <div className="error-icon">⚠️</div>
              <h3>Error Loading Orders</h3>
              <p>{error}</p>
              <button className="retry-btn" onClick={() => window.location.reload()}>
                Retry
              </button>
            </div>
          ) : currentOrders.length > 0 ? (
            <>
              <table className="orders-table">
                <thead>
                  <tr>
                    <th style={{ width: '50px' }}>
                      <input 
                        type="checkbox"
                        checked={selectedOrders.length === currentOrders.length && currentOrders.length > 0}
                        onChange={toggleSelectAll}
                        disabled={currentOrders.length === 0}
                      />
                    </th>
                    <th className="sortable-header" onClick={() => handleSort('billNumber')}>
                      Bill No {getSortIndicator('billNumber')}
                    </th>
                    <th className="sortable-header" onClick={() => handleSort('customerName')}>
                      Customer {getSortIndicator('customerName')}
                    </th>
                    <th>Phone</th>
                    <th className="sortable-header" onClick={() => handleSort('totalAmount')}>
                      Amount {getSortIndicator('totalAmount')}
                    </th>
                    <th>Status</th>
                    <th>Salesmen</th>
                    <th className="sortable-header" onClick={() => handleSort('deliveryDate')}>
                      Delivery Date {getSortIndicator('deliveryDate')}
                    </th>
                    <th className="sortable-header" onClick={() => handleSort('createdAt')}>
                      Timestamp {getSortIndicator('createdAt')}
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentOrders.map(order => (
                    <tr key={order.id} className="order-row">
                      <td>
                        <input 
                          type="checkbox"
                          checked={selectedOrders.includes(order.id)}
                          onChange={() => toggleOrderSelection(order.id)}
                        />
                      </td>
                      <td className="bill-number">
                        <div className="bill-number-content">
                          <span 
                            className="bill-number-link"
                            onClick={() => openOrderDetails(order)}
                            title="View Order Details"
                          >
                            {order.billNumber || 'N/A'}
                          </span>
                          <button 
                            className="btn-copy-barcode"
                            onClick={() => copyBarcode(order)}
                            title="Copy Barcode"
                          >
                            📋
                          </button>
                        </div>
                      </td>
                      <td className="customer-name">
                        <div className="customer-info">
                          <div className="customer-main">{order.customerName || 'N/A'}</div>
                          {order.notes && (
                            <div className="customer-notes" title={order.notes}>
                              <span className="note-icon">📝</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="customer-phone">{order.phoneNumber || 'N/A'}</td>
                      <td className="order-amount">
                        <div className="amount-display">
                          <span className="total-amount">💰{order.totalAmount ? parseFloat(order.totalAmount).toLocaleString('en-IN') : '0'}</span>
                          {order.pendingAmount > 0 && (
                            <span className="pending-badge">💰{parseFloat(order.pendingAmount).toLocaleString('en-IN')} pending</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span 
                          className={`status ${getStatusClass(order.status)}`}
                          style={{ backgroundColor: statusColors[order.status] || statusColors.Pending }}
                        >
                          {order.status || 'Pending'}
                        </span>
                      </td>
                      <td className="salesmen-names">
                        {order.lehengaDetails && order.lehengaDetails.length > 0 ? 
                          getSalesmenNames(order.lehengaDetails[0].salesmen) : 'N/A'}
                      </td>
                      <td className="delivery-date">
                        <div className="date-display">
                          {formatDate(order.deliveryDate)}
                          {isDeliveryDateOverdue(order.deliveryDate) && order.status !== 'Delivered' && order.status !== 'Cancelled' && (
                            <span className="date-overdue" title="Overdue">⚠️</span>
                          )}
                        </div>
                      </td>
                      <td className="timestamp">
                        {formatDateTime(order.createdAt)}
                      </td>
                      <td>
                        <div className="action-buttons-horizontal">
                          <button 
                            className="btn-whatsapp"
                            onClick={() => setWhatsappModal({ show: true, order })}
                            title="Send WhatsApp Message"
                          >
                            💬
                          </button>
                          <button 
                            className="btn-print"
                            onClick={() => setPrintOrderId(order.id)}
                            title="Print Order"
                          >
                            🖨️
                          </button>
                          <button 
                            className="btn-edit"
                            onClick={() => onEditOrder(order.id)}
                            title="Edit Order"
                          >
                            ✏️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className="pagination-container">
                  <div className="pagination-info">
                    Page {currentPage} of {totalPages} • {sortedOrders.length} total orders
                  </div>
                  <div className="pagination-controls">
                    <button 
                      className="pagination-btn prev-btn"
                      onClick={prevPage}
                      disabled={currentPage === 1}
                    >
                      <span className="btn-icon">◀</span> Previous
                    </button>
                    
                    <div className="page-numbers">
                      {getPageNumbers().map(number => (
                        <button
                          key={number}
                          className={`page-number ${currentPage === number ? 'active' : ''}`}
                          onClick={() => paginate(number)}
                        >
                          {number}
                        </button>
                      ))}
                    </div>
                    
                    <button 
                      className="pagination-btn next-btn"
                      onClick={nextPage}
                      disabled={currentPage === totalPages}
                    >
                      Next <span className="btn-icon">▶</span>
                    </button>
                  </div>
                  
                  <div className="page-size-selector">
                    <label>Show: </label>
                    <select 
                      value={ordersPerPage} 
                      onChange={(e) => {
                        setOrdersPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <span> per page</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="no-orders-found">
              <div className="no-orders-icon">📦</div>
              <h3>No orders found</h3>
              <p>Try adjusting your search or filter criteria</p>
              <button 
                className="btn-primary"
                onClick={() => onNavigate('addOrder')}
              >
                <span className="btn-icon">➕</span> Create New Order
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Kanban View */
        <div className="kanban-view-container">
          {loading && isInitialLoad ? (
            <div className="loading-kanban">
              <div className="loading-spinner-large"></div>
              <p>Loading Kanban View...</p>
            </div>
          ) : error ? (
            <div className="error-container">
              <div className="error-icon">⚠️</div>
              <h3>Error Loading Orders</h3>
              <p>{error}</p>
              <button className="retry-btn" onClick={() => window.location.reload()}>
                Retry
              </button>
            </div>
          ) : filteredOrders.length > 0 ? (
            <KanbanView 
              orders={filteredOrders}
              onEditOrder={onEditOrder}
              onStatusUpdate={(orderId, newStatus) => {
                // Handle status update in Kanban view
                const updates = {};
                updates[`Orders/${orderId}/status`] = newStatus;
                updates[`Orders/${orderId}/updatedAt`] = Date.now();
                update(ref(db), updates);
                addNotification('success', `Order status updated to ${newStatus}`, '✅');
              }}
            />
          ) : (
            <div className="no-orders-found">
              <div className="no-orders-icon">📦</div>
              <h3>No orders found</h3>
              <p>Try adjusting your search or filter criteria</p>
              <button 
                className="btn-primary"
                onClick={() => onNavigate('addOrder')}
              >
                <span className="btn-icon">➕</span> Create New Order
              </button>
            </div>
          )}
        </div>
      )}

      {/* Order Details Modal */}
      {showOrderDetails && selectedOrder && (
        <OrderDetailsModal 
          order={selectedOrder}
          onClose={() => setShowOrderDetails(false)}
        />
      )}

      {/* WhatsApp Modal */}
      {whatsappModal.show && whatsappModal.order && (
        <WhatsAppIntegration
          order={whatsappModal.order}
          onClose={() => setWhatsappModal({ show: false, order: null })}
          addNotification={addNotification}
          formatDate={formatDate}
        />
      )}

      {/* Print Order Component */}
      {printOrderId && (
        <PrintOrder 
          orderId={printOrderId} 
          onClose={() => setPrintOrderId(null)} 
        />
      )}
    </div>
  );
}

export default OrdersTable;