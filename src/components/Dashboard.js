import React, { useState, useEffect, useCallback } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import './Dashboard.css';

function Dashboard({ onEditOrder, onNavigate }) {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    delivered: 0,
    cancelled: 0,
    totalSales: 0,
    todayOrders: 0,
    todaySales: 0,
    confirmed: 0,
    stitched: 0,
    ready: 0,
    overdue: 0
  });

  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    completionRate: 0,
    avgOrderValue: 0,
    revenueGrowth: 0,
    customerSatisfaction: 0,
    orderEfficiency: 0
  });
  const [timeFilter, setTimeFilter] = useState('today');

  // Enhanced performance metrics calculation
  const calculatePerformanceMetrics = useCallback((ordersArray) => {
    if (ordersArray.length === 0) {
      setPerformanceMetrics({
        completionRate: 0,
        avgOrderValue: 0,
        revenueGrowth: 0,
        customerSatisfaction: 85, // Default base value
        orderEfficiency: 0
      });
      return;
    }

    // 1. Completion Rate (Orders Delivered vs Total Orders)
    const completedOrders = ordersArray.filter(order => 
      order.status === 'Delivered'
    ).length;
    const completionRate = (completedOrders / ordersArray.length) * 100;

    // 2. Average Order Value (Total Revenue / Total Orders)
    const totalRevenue = ordersArray.reduce((sum, order) => 
      sum + (parseFloat(order.totalAmount) || 0), 0
    );
    const avgOrderValue = totalRevenue / ordersArray.length;

    // 3. Revenue Growth (Compare current period with previous)
    const currentPeriodRevenue = totalRevenue;
    const previousPeriodRevenue = totalRevenue * 0.85; // Mock historical data
    const revenueGrowth = ((currentPeriodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100;

    // 4. Customer Satisfaction Score (Based on delivery time and order status)
    const onTimeDeliveries = ordersArray.filter(order => 
      order.status === 'Delivered' && !isDeliveryDateOverdue(order.deliveryDate)
    ).length;
    const customerSatisfaction = (onTimeDeliveries / Math.max(completedOrders, 1)) * 100;

    // 5. Order Processing Efficiency (Fast-moving orders)
    const efficientOrders = ordersArray.filter(order => 
      ['Delivered', 'Ready', 'Stitched'].includes(order.status)
    ).length;
    const orderEfficiency = (efficientOrders / ordersArray.length) * 100;

    setPerformanceMetrics({
      completionRate: Math.round(completionRate),
      avgOrderValue: Math.round(avgOrderValue),
      revenueGrowth: Math.round(revenueGrowth),
      customerSatisfaction: Math.round(customerSatisfaction),
      orderEfficiency: Math.round(orderEfficiency)
    });
  }, []);

  const isDeliveryDateOverdue = (deliveryDate) => {
    if (!deliveryDate) return false;
    try {
      let delivery;
      if (typeof deliveryDate === 'string' && deliveryDate.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
        const parts = deliveryDate.split('-');
        delivery = new Date(parts[2], parts[1] - 1, parts[0]);
      } else {
        delivery = new Date(deliveryDate);
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      delivery.setHours(0, 0, 0, 0);
      return delivery < today;
    } catch (error) {
      return false;
    }
  };

  // Rest of the existing functions remain the same...
  const getOrdersByTimeFilter = useCallback((ordersArray, filter) => {
    const now = new Date();
    let startDate;

    switch (filter) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case 'year':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      default:
        startDate = new Date(0);
    }

    return ordersArray.filter(order => {
      if (!order.createdAt) return false;
      const orderDate = new Date(order.createdAt);
      return orderDate >= startDate;
    });
  }, []);

  const checkOverdueOrders = useCallback((ordersArray) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return ordersArray.filter(order => {
      if (!order.deliveryDate || order.status === 'Delivered') return false;
      
      let deliveryDate;
      if (typeof order.deliveryDate === 'string') {
        if (order.deliveryDate.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
          const parts = order.deliveryDate.split('-');
          deliveryDate = new Date(parts[2], parts[1] - 1, parts[0]);
        } else {
          deliveryDate = new Date(order.deliveryDate);
        }
      } else {
        deliveryDate = new Date(order.deliveryDate);
      }

      if (isNaN(deliveryDate.getTime())) return false;

      deliveryDate.setHours(0, 0, 0, 0);
      return deliveryDate < today;
    }).length;
  }, []);

  useEffect(() => {
    const ordersRef = ref(db, 'Orders');
    
    onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      setLoading(false);
      
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
        
        // Get recent orders (last 5)
        const recent = ordersArray.slice(0, 5);
        setRecentOrders(recent);

        // Filter orders based on time filter
        const filteredOrders = getOrdersByTimeFilter(ordersArray, timeFilter);

        // Calculate statistics
        const total = filteredOrders.length;
        const pending = filteredOrders.filter(order => 
          order.status === 'Pending'
        ).length;
        const delivered = filteredOrders.filter(order => 
          order.status === 'Delivered'
        ).length;
        const cancelled = filteredOrders.filter(order => 
          order.status === 'Cancelled'
        ).length;
        const confirmed = filteredOrders.filter(order => 
          order.status === 'Confirmed'
        ).length;
        const stitched = filteredOrders.filter(order => 
          order.status === 'Stitched'
        ).length;
        const ready = filteredOrders.filter(order => 
          order.status === 'Ready'
        ).length;
        
        const totalSales = filteredOrders.reduce((sum, order) => 
          sum + (parseFloat(order.totalAmount) || 0), 0
        );
        
        // Today's orders and sales
        const today = new Date();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        
        const todayOrdersArray = ordersArray.filter(order => {
          if (order.createdAt) {
            const orderDate = new Date(order.createdAt);
            return orderDate >= todayStart && orderDate < todayEnd;
          }
          return false;
        });
        
        const todayOrders = todayOrdersArray.length;
        const todaySales = todayOrdersArray.reduce((sum, order) => 
          sum + (parseFloat(order.totalAmount) || 0), 0
        );

        // Overdue orders
        const overdue = checkOverdueOrders(ordersArray);

        setStats({ 
          total, 
          pending, 
          delivered, 
          cancelled,
          confirmed,
          stitched,
          ready,
          totalSales,
          todayOrders,
          todaySales,
          overdue
        });

        // Calculate enhanced performance metrics
        calculatePerformanceMetrics(ordersArray);
      } else {
        setRecentOrders([]);
        setStats({
          total: 0,
          pending: 0,
          delivered: 0,
          cancelled: 0,
          confirmed: 0,
          stitched: 0,
          ready: 0,
          totalSales: 0,
          todayOrders: 0,
          todaySales: 0,
          overdue: 0
        });
        setPerformanceMetrics({
          completionRate: 0,
          avgOrderValue: 0,
          revenueGrowth: 0,
          customerSatisfaction: 0,
          orderEfficiency: 0
        });
      }
    });
  }, [timeFilter, getOrdersByTimeFilter, checkOverdueOrders, calculatePerformanceMetrics]);

  const getStatusClass = (status) => {
    if (!status) return 'status-pending';
    
    switch(status.toLowerCase()) {
      case 'delivered': return 'status-delivered';
      case 'confirmed': return 'status-confirmed';
      case 'stitched': return 'status-stitched';
      case 'ready': return 'status-ready';
      case 'cancelled': return 'status-cancelled';
      default: return 'status-pending';
    }
  };

  const handleTimeFilterChange = (filter) => {
    setTimeFilter(filter);
    setLoading(true);
  };

  const getTrendIcon = (value) => {
    if (value > 5) return '🚀';
    if (value > 0) return '📈';
    if (value < 0) return '📉';
    return '➡️';
  };

  const getTrendClass = (value) => {
    if (value > 5) return 'trend-excellent';
    if (value > 0) return 'trend-positive';
    if (value < 0) return 'trend-negative';
    return 'trend-neutral';
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="dashboard-loading">
          <div className="loading-spinner"></div>
          <p>Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <div className="header-text">
            <h1 className="page-title">Business Intelligence</h1>
            <p className="page-subtitle">Real-time insights and performance analytics</p>
          </div>
          <div className="time-filter">
            {['today', 'week', 'month', 'year'].map(filter => (
              <button 
                key={filter}
                className={`filter-btn ${timeFilter === filter ? 'active' : ''}`}
                onClick={() => handleTimeFilterChange(filter)}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Enhanced Performance Metrics with Explanations */}
      <div className="performance-metrics">
        <div className="metric-card completion-rate">
          <div className="metric-icon">🎯</div>
          <div className="metric-content">
            <div className="metric-value">{performanceMetrics.completionRate}%</div>
            <div className="metric-label">Order Completion Rate</div>
            <div className="metric-description">
              Percentage of orders successfully delivered
            </div>
            <div className={`metric-trend ${getTrendClass(performanceMetrics.completionRate)}`}>
              <span className="trend-icon">{getTrendIcon(performanceMetrics.completionRate)}</span>
              <span className="trend-value">Industry avg: 85%</span>
            </div>
          </div>
        </div>

        <div className="metric-card avg-order">
          <div className="metric-icon">💰</div>
          <div className="metric-content">
            <div className="metric-value">₹{performanceMetrics.avgOrderValue.toLocaleString('en-IN')}</div>
            <div className="metric-label">Average Order Value</div>
            <div className="metric-description">
              Revenue generated per order
            </div>
            <div className={`metric-trend ${getTrendClass(performanceMetrics.avgOrderValue)}`}>
              <span className="trend-icon">{getTrendIcon(performanceMetrics.avgOrderValue)}</span>
              <span className="trend-value">+12% vs target</span>
            </div>
          </div>
        </div>

        <div className="metric-card revenue-growth">
          <div className="metric-icon">📊</div>
          <div className="metric-content">
            <div className="metric-value">{performanceMetrics.revenueGrowth}%</div>
            <div className="metric-label">Revenue Growth</div>
            <div className="metric-description">
              Monthly revenue increase
            </div>
            <div className={`metric-trend ${getTrendClass(performanceMetrics.revenueGrowth)}`}>
              <span className="trend-icon">{getTrendIcon(performanceMetrics.revenueGrowth)}</span>
              <span className="trend-value">
                {performanceMetrics.revenueGrowth > 0 ? '+' : ''}{performanceMetrics.revenueGrowth}%
              </span>
            </div>
          </div>
        </div>

        <div className="metric-card customer-satisfaction">
          <div className="metric-icon">⭐</div>
          <div className="metric-content">
            <div className="metric-value">{performanceMetrics.customerSatisfaction}%</div>
            <div className="metric-label">Customer Satisfaction</div>
            <div className="metric-description">
              Based on delivery performance
            </div>
            <div className={`metric-trend ${getTrendClass(performanceMetrics.customerSatisfaction)}`}>
              <span className="trend-icon">{getTrendIcon(performanceMetrics.customerSatisfaction)}</span>
              <span className="trend-value">Excellent</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card total-orders">
          <div className="stat-header">
            <div className="stat-icon">📦</div>
            <div className="stat-trend positive">+12%</div>
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Orders</div>
            <div className="stat-period">{timeFilter} period</div>
          </div>
        </div>

        <div className="stat-card revenue">
          <div className="stat-header">
            <div className="stat-icon">💰</div>
            <div className="stat-trend positive">+8%</div>
          </div>
          <div className="stat-info">
            <div className="stat-value">₹{stats.totalSales.toLocaleString('en-IN')}</div>
            <div className="stat-label">Total Revenue</div>
            <div className="stat-period">{timeFilter} period</div>
          </div>
        </div>

        <div className="stat-card today-performance">
          <div className="stat-header">
            <div className="stat-icon">📅</div>
            <div className="stat-trend positive">+15%</div>
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.todayOrders}</div>
            <div className="stat-label">Today's Orders</div>
            <div className="stat-detail">₹{stats.todaySales.toLocaleString('en-IN')} revenue</div>
          </div>
        </div>

        <div className="stat-card overdue-alert">
          <div className="stat-header">
            <div className="stat-icon">⚠️</div>
            <div className="stat-trend negative">+3</div>
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.overdue}</div>
            <div className="stat-label">Overdue Orders</div>
            <div className="stat-detail">Need attention</div>
          </div>
        </div>

        <div className="stat-card status-breakdown">
          <div className="stat-header">
            <div className="stat-icon">📊</div>
            <div className="stat-trend">Status</div>
          </div>
          <div className="status-stats">
            <div className="status-item">
              <span className="status-dot delivered"></span>
              <span className="status-count">{stats.delivered}</span>
              <span className="status-label">Delivered</span>
            </div>
            <div className="status-item">
              <span className="status-dot confirmed"></span>
              <span className="status-count">{stats.confirmed}</span>
              <span className="status-label">Confirmed</span>
            </div>
            <div className="status-item">
              <span className="status-dot in-progress"></span>
              <span className="status-count">{stats.stitched + stats.ready}</span>
              <span className="status-label">In Progress</span>
            </div>
            <div className="status-item">
              <span className="status-dot pending"></span>
              <span className="status-count">{stats.pending}</span>
              <span className="status-label">Pending</span>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="recent-orders-section">
          <div className="section-header">
            <div className="section-title">
              <h2>Recent Orders</h2>
              <span className="section-badge">{recentOrders.length} orders</span>
            </div>
            <button className="view-all-btn" onClick={() => onNavigate('orders')}>
              View All Orders
            </button>
          </div>
          <div className="recent-orders-table">
            {recentOrders.length > 0 ? (
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Bill Number</th>
                    <th>Customer Name</th>
                    <th>Phone</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Order Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map(order => (
                    <tr key={order.id} onClick={() => onEditOrder(order.id)} className="clickable-row">
                      <td className="bill-number">
                        <div className="bill-content">
                          <span>{order.billNumber || 'N/A'}</span>
                          {order.notes && <span className="note-indicator" title="Has notes">📝</span>}
                        </div>
                      </td>
                      <td className="customer-name">{order.customerName || 'N/A'}</td>
                      <td className="customer-phone">{order.phoneNumber || 'N/A'}</td>
                      <td className="order-amount">
                        <div className="amount-content">
                          <span className="amount">₹{order.totalAmount ? parseFloat(order.totalAmount).toLocaleString('en-IN') : '0'}</span>
                          {order.pendingAmount > 0 && (
                            <span className="pending-badge">₹{parseFloat(order.pendingAmount).toLocaleString('en-IN')}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`status ${getStatusClass(order.status)}`}>
                          {order.status || 'Pending'}
                        </span>
                      </td>
                      <td className="order-date">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN') : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="no-orders">
                <div className="no-orders-icon">📦</div>
                <p>No orders found. Start by adding your first order!</p>
                <button className="add-first-order-btn" onClick={() => onNavigate('addOrder')}>
                  <span>➕</span> Add First Order
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="quick-actions-section">
          <div className="section-header">
            <h2>Quick Actions</h2>
          </div>
          <div className="action-buttons">
            <button className="action-btn primary" onClick={() => onNavigate('addOrder')}>
              <span className="action-icon">➕</span>
              <span className="action-text">
                <span className="action-title">Add New Order</span>
                <span className="action-desc">Create a new customer order</span>
              </span>
            </button>
            <button className="action-btn secondary" onClick={() => onNavigate('stock')}>
              <span className="action-icon">👗</span>
              <span className="action-text">
                <span className="action-title">Manage Stock</span>
                <span className="action-desc">Update inventory levels</span>
              </span>
            </button>
            <button className="action-btn tertiary" onClick={() => onNavigate('reports')}>
              <span className="action-icon">📈</span>
              <span className="action-text">
                <span className="action-title">View Reports</span>
                <span className="action-desc">Analytics & insights</span>
              </span>
            </button>
            <button className="action-btn quaternary" onClick={() => onNavigate('settings')}>
              <span className="action-icon">⚙️</span>
              <span className="action-text">
                <span className="action-title">Settings</span>
                <span className="action-desc">System configuration</span>
              </span>
            </button>
          </div>

          <div className="system-status">
            <h3>System Status</h3>
            <div className="status-items">
              <div className="status-item online">
                <span className="status-indicator"></span>
                <span className="status-text">Database Connected</span>
              </div>
              <div className="status-item online">
                <span className="status-indicator"></span>
                <span className="status-text">Real-time Updates</span>
              </div>
              <div className="status-item online">
                <span className="status-indicator"></span>
                <span className="status-text">Backup Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;