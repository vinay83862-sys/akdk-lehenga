// Sidebar.js (FIXED WITH PROPER THEME AND BADGES)
import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { auth, db } from '../firebase';
import './Sidebar.css';

function Sidebar({ currentView, onNavigate, isOpen, onToggle, user }) {
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [currentTime, setCurrentTime] = useState('');

  const userName = user?.displayName || user?.email || 'Admin User';
  const userRole = user?.role || 'Administrator';

  const menuItems = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard', badge: null },
    { id: 'orders', icon: '📦', label: 'Orders', badge: pendingOrdersCount },
    { id: 'addOrder', icon: '➕', label: 'Add Order', badge: null },
    { id: 'stock', icon: '👗', label: 'Stock Management', badge: lowStockCount },
    { id: 'reports', icon: '📈', label: 'Reports & Analytics', badge: null },
    { id: 'settings', icon: '⚙️', label: 'Settings', badge: null },
  ];

  // Update time every second
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load real counts for badges
  useEffect(() => {
    // Load orders for pending count
    const ordersRef = ref(db, 'Orders');
    const unsubscribeOrders = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const ordersArray = Object.values(data);
        const pendingOrders = ordersArray.filter(order => 
          order.status === 'Pending' || order.status === 'Confirmed'
        ).length;
        setPendingOrdersCount(pendingOrders);
      } else {
        setPendingOrdersCount(0);
      }
    });

    // Load stock for low stock count
    const stockRef = ref(db, 'Stock');
    const unsubscribeStock = onValue(stockRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const stockArray = Object.values(data);
        const lowStock = stockArray.filter(item => 
          (parseFloat(item.amount) || 0) < 5000
        ).length;
        setLowStockCount(lowStock);
      } else {
        setLowStockCount(0);
      }
    });

    return () => {
      unsubscribeOrders();
      unsubscribeStock();
    };
  }, []);

  const handleLogout = () => {
    if (window.confirm('Do you want to log out?')) {
      auth.signOut();
    }
  };

  return (
    <>
      <div className={`sidebar ${isOpen ? 'active' : ''}`}>
        <div className="sidebar-header">
          <div className="store-info">
            <div className="store-logo">
              👑
            </div>
            <div className="store-details">
              <h2>Lehenga Store</h2>
              <p>Premium Boutique</p>
            </div>
          </div>
          <div className="current-time">
            <span className="time-icon">🕒</span>
            <span className="time-text">{currentTime}</span>
          </div>
        </div>
        
        <div className="sidebar-menu">
          {menuItems.map(item => (
            <div 
              key={item.id}
              className={`menu-item ${currentView === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="menu-icon">{item.icon}</span>
              <span className="menu-label">{item.label}</span>
              {item.badge > 0 && (
                <span className="menu-badge">{item.badge}</span>
              )}
              {currentView === item.id && (
                <div className="active-indicator"></div>
              )}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              {userName.split(' ').map(n => n[0]).join('').toUpperCase()}
            </div>
            <div className="user-info">
              <div className="user-name">{userName}</div>
              <div className="user-role">{userRole}</div>
            </div>
          </div>
          
          <div className="menu-item logout-item" onClick={handleLogout}>
            <span className="menu-icon">🚪</span>
            <span className="menu-label">Logout</span>
          </div>
        </div>
      </div>
      
      {/* Overlay for mobile */}
      {isOpen && <div className="sidebar-overlay" onClick={onToggle}></div>}
    </>
  );
}

export default Sidebar;