// OrdersTable.js - Enhanced with Advanced Search (Fixed View Details)
import React, { useState, useEffect, useCallback } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import './OrdersTable.css';
import PrintOrder from './PrintOrder';

function OrdersTable({ onEditOrder, onNavigate, highlightOrder }) {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [currentOrders, setCurrentOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [salesmen, setSalesmen] = useState([]);
  const [printOrderId, setPrintOrderId] = useState(null);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  
  // Advanced search filters
  const [showOverdue, setShowOverdue] = useState(false);
  const [showPendingAmount, setShowPendingAmount] = useState(false);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [ordersPerPage, setOrdersPerPage] = useState(10);

  const statusColors = {
    'Pending': '#ffc107',
    'Confirmed': '#17a2b8',
    'On Stitching': '#f59e0b',
    'Stitched': '#6f42c1',
    'Ready': '#20c997',
    'Delivered': '#28a745',
    'Cancelled': '#dc3545'
  };

  useEffect(() => {
    const ordersRef = ref(db, 'Orders');
    const salesmenRef = ref(db, 'salesmen');
    
    onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const ordersArray = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value
        }));
        
        // Sort orders by createdAt (newest first)
        ordersArray.sort((a, b) => {
          const dateA = a.createdAt || 0;
          const dateB = b.createdAt || 0;
          return dateB - dateA;
        });
        
        setOrders(ordersArray);
      } else {
        setOrders([]);
      }
    });

    onValue(salesmenRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const salesmenList = Object.entries(data).map(([id, salesman]) => ({
          id,
          ...salesman
        }));
        setSalesmen(salesmenList);
      }
    });
  }, []);

  // Auto-open highlighted order
  useEffect(() => {
    if (highlightOrder && orders.length > 0) {
      const orderToHighlight = orders.find(order => order.id === highlightOrder);
      if (orderToHighlight) {
        setSelectedOrder(orderToHighlight);
        setShowModal(true);
      }
    }
  }, [highlightOrder, orders]);

  // Wrap isDeliveryDateOverdue with useCallback to fix dependency
  const isDeliveryDateOverdue = useCallback((deliveryDate) => {
    const parsedDate = parseDeliveryDate(deliveryDate);
    if (!parsedDate) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    parsedDate.setHours(0, 0, 0, 0);
    
    return parsedDate < today;
  }, []);

  const parseDeliveryDate = (dateValue) => {
    if (!dateValue) return null;
    
    try {
      let date;
      
      // Handle DD-MM-YYYY format
      if (typeof dateValue === 'string' && dateValue.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
        const parts = dateValue.split('-');
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        date = new Date(year, month, day);
      } 
      // Handle DD/MM/YYYY format
      else if (typeof dateValue === 'string' && dateValue.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        const parts = dateValue.split('/');
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        date = new Date(year, month, day);
      }
      // Handle YYYY-MM-DD format
      else if (typeof dateValue === 'string' && dateValue.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
        date = new Date(dateValue);
      }
      // Handle timestamps
      else if (typeof dateValue === 'number') {
        date = new Date(dateValue);
      }
      // Handle Firebase timestamp objects
      else if (typeof dateValue === 'object' && dateValue.seconds) {
        date = new Date(dateValue.seconds * 1000);
      }
      else {
        date = new Date(dateValue);
      }
      
      return isNaN(date.getTime()) ? null : date;
    } catch (error) {
      console.error('Error parsing delivery date:', error);
      return null;
    }
  };

  // Filter orders based on all criteria
  useEffect(() => {
    let result = orders;
    
    // Apply basic search filter
    if (searchTerm) {
      result = result.filter(order => 
        (order.customerName && order.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (order.billNumber && order.billNumber.toString().includes(searchTerm)) ||
        (order.phoneNumber && order.phoneNumber.includes(searchTerm)) ||
        (order.lehengaDetails && order.lehengaDetails.some(lehenga => 
          lehenga.design && lehenga.design.toLowerCase().includes(searchTerm.toLowerCase())
        ))
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(order => 
        order.status && order.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }
    
    // Apply advanced filters
    if (showOverdue) {
      result = result.filter(order => isDeliveryDateOverdue(order.deliveryDate) && order.status !== 'Delivered' && order.status !== 'Cancelled');
    }
    
    if (showPendingAmount) {
      result = result.filter(order => (order.pendingAmount || 0) > 0);
    }
    
    // Apply date range filter
    if (dateRange.from || dateRange.to) {
      result = result.filter(order => {
        const orderDate = parseDeliveryDate(order.deliveryDate);
        if (!orderDate) return false;
        
        const fromDate = dateRange.from ? new Date(dateRange.from) : null;
        const toDate = dateRange.to ? new Date(dateRange.to) : null;
        
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
  }, [orders, searchTerm, statusFilter, showOverdue, showPendingAmount, dateRange, isDeliveryDateOverdue]);

  // Pagination logic
  useEffect(() => {
    const indexOfLastOrder = currentPage * ordersPerPage;
    const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
    setCurrentOrders(filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder));
  }, [filteredOrders, currentPage, ordersPerPage]);

  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);

  const openOrderDetails = (order) => {
    setSelectedOrder(order);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedOrder(null);
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
        if (!isNaN(timestamp)) {
          date = new Date(timestamp);
        } else {
          date = new Date(dateValue);
        }
      } else if (typeof dateValue === 'number') {
        date = new Date(dateValue);
      } else {
        return 'Invalid Date';
      }
      
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      
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

  const handleDeleteOrder = (order) => {
    if (window.confirm(`Are you sure you want to delete order ${order.billNumber} for ${order.customerName}?`)) {
      console.log('Delete order:', order);
      alert('Delete functionality will be implemented here');
    }
  };

  // Pagination controls
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

  const handlePageSizeChange = (e) => {
    const newSize = Number(e.target.value);
    setOrdersPerPage(newSize);
    setCurrentPage(1);
  };

  const clearAdvancedFilters = () => {
    setShowOverdue(false);
    setShowPendingAmount(false);
    setDateRange({ from: '', to: '' });
  };

  return (
    <div className="orders-table-container">
      <div className="table-header">
        <div className="header-title-section">
          <h2>📦 Order Management</h2>
          <div className="orders-count">
            Showing {currentOrders.length} of {filteredOrders.length} orders
            {searchTerm && ` for "${searchTerm}"`}
            {statusFilter !== 'all' && ` in ${statusFilter}`}
            {(showOverdue || showPendingAmount || dateRange.from || dateRange.to) && ' (with filters)'}
          </div>
        </div>
        
        <div className="filters">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input 
              type="text" 
              placeholder="Search by name, bill no, phone, or design..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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

          <button 
            className="btn-secondary"
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
        </div>
      </div>

      {/* Advanced Search Panel */}
      {showAdvancedSearch && (
        <div className="form-section" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
          <div className="section-header">
            <h3>🔍 Advanced Search Filters</h3>
            <button 
              className="btn-secondary btn-sm"
              onClick={clearAdvancedFilters}
            >
              Clear Filters
            </button>
          </div>
          
          <div className="form-grid">
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={showOverdue}
                  onChange={(e) => setShowOverdue(e.target.checked)}
                />
                Show Overdue Orders Only
              </label>
            </div>
            
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={showPendingAmount}
                  onChange={(e) => setShowPendingAmount(e.target.checked)}
                />
                Show Orders with Pending Amount
              </label>
            </div>
            
            <div className="form-group">
              <label>Delivery Date From:</label>
              <input 
                type="date" 
                value={dateRange.from}
                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                className="form-control"
              />
            </div>
            
            <div className="form-group">
              <label>Delivery Date To:</label>
              <input 
                type="date" 
                value={dateRange.to}
                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                className="form-control"
              />
            </div>
          </div>
        </div>
      )}

      <div className="table-responsive">
        {currentOrders.length > 0 ? (
          <>
            <table className="orders-table">
              <thead>
                <tr>
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
              <tbody>
                {currentOrders.map(order => (
                  <tr key={order.id} className="order-row">
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
                          className="btn-print-bill"
                          onClick={() => setPrintOrderId(order.id)}
                          title="Print Order"
                        >
                          🖨️
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
                        <span className="total-amount">₹{order.totalAmount ? parseFloat(order.totalAmount).toLocaleString('en-IN') : '0'}</span>
                        {order.pendingAmount > 0 && (
                          <span className="pending-badge">₹{parseFloat(order.pendingAmount).toLocaleString('en-IN')} pending</span>
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
                          className="btn-view"
                          onClick={() => openOrderDetails(order)}
                          title="View Details"
                        >
                          👁️
                        </button>
                        <button 
                          className="btn-edit"
                          onClick={() => onEditOrder(order.id)}
                          title="Edit Order"
                        >
                          ✏️
                        </button>
                        <button 
                          className="btn-delete"
                          onClick={() => handleDeleteOrder(order)}
                          title="Delete Order"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination-container">
                <div className="pagination-info">
                  Page {currentPage} of {totalPages} • {filteredOrders.length} total orders
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
                    {totalPages > 5 && currentPage < totalPages - 2 && (
                      <>
                        <span className="page-ellipsis">...</span>
                        <button
                          className={`page-number ${currentPage === totalPages ? 'active' : ''}`}
                          onClick={() => paginate(totalPages)}
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
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
                    onChange={handlePageSizeChange}
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
            <p>{searchTerm || statusFilter !== 'all' || showOverdue || showPendingAmount || dateRange.from || dateRange.to ? 'Try adjusting your search or filter criteria' : 'Get started by creating your first order'}</p>
            <button 
              className="btn-primary"
              onClick={() => onNavigate('addOrder')}
            >
              <span className="btn-icon">➕</span> Create Your First Order
            </button>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {showModal && selectedOrder && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📋 Order Details - Bill #{selectedOrder.billNumber}</h2>
              <button className="close-btn" onClick={closeModal}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="detail-section">
                <h3>👤 Customer Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Customer Name:</span>
                    <span className="detail-value">{selectedOrder.customerName || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Phone Number:</span>
                    <span className="detail-value">{selectedOrder.phoneNumber || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Bill Number:</span>
                    <span className="detail-value">{selectedOrder.billNumber || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>💰 Payment Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Total Amount:</span>
                    <span className="detail-value amount-total">₹{selectedOrder.totalAmount ? parseFloat(selectedOrder.totalAmount).toLocaleString('en-IN') : '0'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Paid Amount:</span>
                    <span className="detail-value amount-paid">₹{selectedOrder.paidAmount ? parseFloat(selectedOrder.paidAmount).toLocaleString('en-IN') : '0'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Pending Amount:</span>
                    <span className={`detail-value ${selectedOrder.pendingAmount > 0 ? 'amount-pending' : 'amount-paid'}`}>
                      ₹{selectedOrder.pendingAmount ? parseFloat(selectedOrder.pendingAmount).toLocaleString('en-IN') : '0'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Payment Type:</span>
                    <span className="detail-value payment-type">{selectedOrder.paymentType || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>📊 Order Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Status:</span>
                    <span 
                      className="detail-value status-badge"
                      style={{ backgroundColor: statusColors[selectedOrder.status] || statusColors.Pending }}
                    >
                      {selectedOrder.status || 'Pending'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Order Date:</span>
                    <span className="detail-value">{formatDate(selectedOrder.createdAt)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Delivery Date:</span>
                    <span className="detail-value">
                      {formatDate(selectedOrder.deliveryDate)}
                      {isDeliveryDateOverdue(selectedOrder.deliveryDate) && selectedOrder.status !== 'Delivered' && (
                        <span className="overdue-indicator" title="Overdue">⚠️ Overdue</span>
                      )}
                    </span>
                  </div>
                  <div className="detail-item full-width">
                    <span className="detail-label">Notes:</span>
                    <div className="notes-content">{selectedOrder.notes || 'No notes available'}</div>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>⏰ Timestamps</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Created At:</span>
                    <span className="detail-value">{formatDateTime(selectedOrder.createdAt)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Created By:</span>
                    <span className="detail-value">{selectedOrder.createdBy || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Last Updated:</span>
                    <span className="detail-value">{formatDateTime(selectedOrder.updatedAt)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Updated By:</span>
                    <span className="detail-value">{selectedOrder.updatedBy || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {selectedOrder.lehengaDetails && selectedOrder.lehengaDetails.length > 0 && (
                <div className="detail-section">
                  <h3>👗 Lehenga Details ({selectedOrder.lehengaDetails.length})</h3>
                  {selectedOrder.lehengaDetails.map((lehenga, index) => (
                    <div key={index} className="lehenga-detail-card">
                      <div className="lehenga-card-header">
                        <h4>Lehenga #{index + 1}</h4>
                        <span className="lehenga-amount">₹{lehenga.amount ? parseFloat(lehenga.amount).toLocaleString('en-IN') : '0'}</span>
                      </div>
                      <div className="detail-grid">
                        <div className="detail-item">
                          <span className="detail-label">Design:</span>
                          <span className="detail-value">{lehenga.design || 'N/A'}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Color:</span>
                          <span className="detail-value">{lehenga.color || 'N/A'}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Stitching:</span>
                          <span className="detail-value">{lehenga.stitchingOption || 'N/A'}</span>
                        </div>
                        <div className="detail-item full-width">
                          <span className="detail-label">Salesmen:</span>
                          <span className="detail-value">{getSalesmenNames(lehenga.salesmen)}</span>
                        </div>
                        {lehenga.stitchingOption === 'Stitched' && (
                          <>
                            <div className="detail-item">
                              <span className="detail-label">Length:</span>
                              <span className="detail-value">{lehenga.length || 'N/A'}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Waist:</span>
                              <span className="detail-value">{lehenga.waist || 'N/A'}</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-label">Hip:</span>
                              <span className="detail-value">{lehenga.hip || 'N/A'}</span>
                            </div>
                          </>
                        )}
                        {lehenga.blouseOption && (
                          <div className="detail-item">
                            <span className="detail-label">Blouse:</span>
                            <span className="detail-value">{lehenga.blouseOption}</span>
                          </div>
                        )}
                        {lehenga.mainDupatta && (
                          <div className="detail-item">
                            <span className="detail-label">Main Dupatta:</span>
                            <span className="detail-value">{lehenga.mainDupatta}</span>
                          </div>
                        )}
                        {lehenga.extraDupatta === 'Yes' && (
                          <div className="detail-item">
                            <span className="detail-label">Extra Dupatta:</span>
                            <span className="detail-value">{lehenga.extraDupattaType || 'Yes'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="btn-edit" onClick={() => { onEditOrder(selectedOrder.id); closeModal(); }}>
                <span className="btn-icon">✏️</span> Edit Order
              </button>
              <button className="btn-print" onClick={() => setPrintOrderId(selectedOrder.id)}>
                <span className="btn-icon">🖨️</span> Print with TSC
              </button>
              <button className="btn-secondary" onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}

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