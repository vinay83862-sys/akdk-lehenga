// AnalyticsDashboard.js (Updated)
import React from 'react';
import './AnalyticsDashboard.css';

const AnalyticsDashboard = ({ orders, onClose }) => {
  // Calculate analytics data
  const calculateAnalytics = () => {
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + (parseFloat(order.totalAmount) || 0), 0);
    const pendingAmount = orders.reduce((sum, order) => sum + (parseFloat(order.pendingAmount) || 0), 0);
    
    const overdueOrders = orders.filter(order => {
      const deliveryDate = parseDeliveryDate(order.deliveryDate);
      return deliveryDate && deliveryDate < today && order.status !== 'Delivered' && order.status !== 'Cancelled';
    });

    const statusCount = orders.reduce((acc, order) => {
      const status = order.status?.toLowerCase() || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    // Top customers by total spending
    const customerMap = new Map();
    orders.forEach(order => {
      if (order.customerName) {
        const current = customerMap.get(order.customerName) || { total: 0, orders: 0 };
        customerMap.set(order.customerName, {
          total: current.total + (parseFloat(order.totalAmount) || 0),
          orders: current.orders + 1
        });
      }
    });

    const topCustomers = Array.from(customerMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Monthly revenue (last 6 months)
    const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleString('default', { month: 'short' });
      
      const revenue = orders
        .filter(order => {
          const orderDate = parseOrderDate(order.createdAt);
          return orderDate && 
                 orderDate.getFullYear() === date.getFullYear() && 
                 orderDate.getMonth() === date.getMonth();
        })
        .reduce((sum, order) => sum + (parseFloat(order.totalAmount) || 0), 0);
      
      return { month: monthName, revenue };
    }).reverse();

    return {
      totalOrders,
      totalRevenue,
      pendingAmount,
      overdueOrders: overdueOrders.length,
      statusCount,
      topCustomers,
      monthlyRevenue
    };
  };

  const analytics = calculateAnalytics();

  // Helper functions for date parsing
  const parseDeliveryDate = (dateValue) => {
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
      return null;
    }
  };

  const parseOrderDate = (timestamp) => {
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
      return null;
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': '#ffc107',
      'confirmed': '#17a2b8',
      'on stitching': '#f59e0b',
      'stitched': '#6f42c1',
      'ready': '#20c997',
      'delivered': '#28a745',
      'cancelled': '#dc3545'
    };
    return colors[status] || '#6c757d';
  };

  const getStatusIcon = (status) => {
    const icons = {
      'pending': '⏳',
      'confirmed': '✅',
      'on stitching': '✂️',
      'stitched': '👗',
      'ready': '📦',
      'delivered': '🎉',
      'cancelled': '❌'
    };
    return icons[status] || '📋';
  };

  // Find max revenue for chart scaling
  const maxRevenue = Math.max(...analytics.monthlyRevenue.map(m => m.revenue), 1);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content analytics-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📊 Analytics Dashboard</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="analytics-body">
          {/* Key Metrics */}
          <div className="analytics-grid">
            <div className="analytics-card">
              <div className="analytics-value">{analytics.totalOrders}</div>
              <div className="analytics-label">Total Orders</div>
            </div>
            
            <div className="analytics-card">
              <div className="analytics-value">₹{analytics.totalRevenue.toLocaleString('en-IN')}</div>
              <div className="analytics-label">Total Revenue</div>
            </div>
            
            <div className="analytics-card">
              <div className="analytics-value">₹{analytics.pendingAmount.toLocaleString('en-IN')}</div>
              <div className="analytics-label">Pending Amount</div>
            </div>
            
            <div className="analytics-card">
              <div className="analytics-value">{analytics.overdueOrders}</div>
              <div className="analytics-label">Overdue Orders</div>
            </div>
          </div>
          
          {/* Revenue Chart */}
          <div className="revenue-chart">
            <h3>📈 Monthly Revenue (Last 6 Months)</h3>
            <div className="chart-container">
              {analytics.monthlyRevenue.map((month, index) => (
                <div key={index} className="chart-bar-container" style={{ flex: 1 }}>
                  <div 
                    className="chart-bar"
                    style={{ 
                      height: `${(month.revenue / maxRevenue) * 100}%`,
                      background: month.revenue > 0 ? 
                        `linear-gradient(to top, var(--primary), var(--primary-light))` : 
                        'var(--border)'
                    }}
                  >
                    {month.revenue > 0 && (
                      <div className="chart-value">
                        ₹{(month.revenue / 1000).toFixed(0)}K
                      </div>
                    )}
                  </div>
                  <div className="chart-label">{month.month}</div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Status Breakdown */}
          <div className="status-breakdown">
            <h3>📊 Orders by Status</h3>
            <div className="status-bars">
              {Object.entries(analytics.statusCount).map(([status, count]) => (
                <div key={status} className="status-bar">
                  <div className="status-info">
                    <span className="status-name">
                      {getStatusIcon(status)} {status}
                    </span>
                    <span className="status-count">{count}</span>
                  </div>
                  <div 
                    className="status-progress"
                    style={{ 
                      width: `${(count / analytics.totalOrders) * 100}%`,
                      backgroundColor: getStatusColor(status)
                    }}
                  ></div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Top Customers */}
          <div className="top-customers">
            <h3>👥 Top Customers</h3>
            <div className="customer-list">
              {analytics.topCustomers.map((customer, index) => (
                <div key={index} className="customer-item">
                  <div className="customer-info">
                    <div className="customer-name">{customer.name}</div>
                    <div className="customer-orders">{customer.orders} orders</div>
                  </div>
                  <div className="customer-amount">
                    ₹{customer.total.toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
              {analytics.topCustomers.length === 0 && (
                <div className="no-data">No customer data available</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;