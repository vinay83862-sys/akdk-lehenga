// Header.js (COMPLETELY FIXED with useCallback and Enhanced Features)
import React, { useState, useEffect, useCallback } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import './Header.css';

function Header({ user, currentView, onToggleSidebar, todayOrdersCount, todayRevenue, onNavigate }) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeOrders, setActiveOrders] = useState(0);

  const userName = user?.displayName || user?.email || 'Admin User';
  const userRole = user?.role || 'Administrator';

  const viewNames = {
    'dashboard': 'Dashboard',
    'orders': 'Orders Management',
    'addOrder': 'Add New Order',
    'editOrder': 'Edit Order',
    'stock': 'Stock Management',
    'reports': 'Reports & Analytics',
    'settings': 'Settings & Configuration'
  };

  const notificationCategories = {
    overdue: { icon: '⚠️', color: '#f56565', priority: 1 },
    new: { icon: '🛍️', color: '#48bb78', priority: 2 },
    payment: { icon: '💰', color: '#ed8936', priority: 3 },
    status: { icon: '📦', color: '#4299e1', priority: 4 }
  };

  // Move functions outside useEffect with useCallback
  const parseDeliveryDate = useCallback((dateValue) => {
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
  }, []);

  const getRelativeTime = useCallback((date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  }, []);

  const generateNotifications = useCallback((ordersArray) => {
    const now = new Date();
    const newNotifications = [];
    const storedNotifications = JSON.parse(localStorage.getItem('readNotifications') || '[]');
    
    // Check for overdue orders
    ordersArray.forEach(order => {
      if (order.deliveryDate && order.status !== 'Delivered' && order.status !== 'Cancelled') {
        const deliveryDate = parseDeliveryDate(order.deliveryDate);
        if (deliveryDate && deliveryDate < now) {
          const notificationId = `overdue-${order.id}`;
          if (!storedNotifications.includes(notificationId)) {
            newNotifications.push({
              id: notificationId,
              type: 'alert',
              title: '🚨 Overdue Order',
              message: `Order #${order.billNumber} for ${order.customerName} is overdue`,
              time: getRelativeTime(new Date()),
              read: false,
              icon: '⚠️',
              orderId: order.id,
              timestamp: Date.now(),
              category: 'overdue'
            });
          }
        }
      }

      // New orders (created in last 24 hours)
      if (order.createdAt) {
        const orderDate = new Date(order.createdAt);
        const hoursDiff = (now - orderDate) / (1000 * 60 * 60);
        if (hoursDiff < 24) {
          const notificationId = `new-${order.id}`;
          if (!storedNotifications.includes(notificationId)) {
            newNotifications.push({
              id: notificationId,
              type: 'order',
              title: '🛍️ New Order Received',
              message: `New order #${order.billNumber} from ${order.customerName}`,
              time: `${Math.floor(hoursDiff)} hours ago`,
              read: false,
              icon: '🛍️',
              orderId: order.id,
              timestamp: order.createdAt,
              category: 'new'
            });
          }
        }
      }

      // High pending amount alerts
      if (order.pendingAmount && parseFloat(order.pendingAmount) > 5000) {
        const notificationId = `payment-${order.id}`;
        if (!storedNotifications.includes(notificationId)) {
          newNotifications.push({
            id: notificationId,
            type: 'payment',
            title: '💰 High Pending Amount',
            message: `Order #${order.billNumber} has ₹${parseFloat(order.pendingAmount).toLocaleString('en-IN')} pending`,
            time: getRelativeTime(new Date()),
            read: false,
            icon: '💰',
            orderId: order.id,
            timestamp: Date.now(),
            category: 'payment'
          });
        }
      }
    });

    // Sort notifications by priority and timestamp
    newNotifications.sort((a, b) => {
      const priorityA = notificationCategories[a.category]?.priority || 5;
      const priorityB = notificationCategories[b.category]?.priority || 5;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return b.timestamp - a.timestamp;
    });
    
    setNotifications(newNotifications);
    setUnreadCount(newNotifications.length);

    // Play sound for new notifications
    if (newNotifications.length > 0) {
      playNotificationSound();
    }
  }, [parseDeliveryDate, getRelativeTime]);

  const playNotificationSound = () => {
    try {
      // Create a simple notification sound using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.log('Audio context not supported');
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  const showBrowserNotification = (title, body) => {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/logo192.png',
        tag: 'order-notification'
      });
    }
  };

  // Load orders and generate notifications
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    const ordersRef = ref(db, 'Orders');
    
    onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const ordersArray = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value
        }));
        
        // Calculate active orders (not delivered or cancelled)
        const active = ordersArray.filter(order => 
          !['Delivered', 'Cancelled'].includes(order.status)
        ).length;
        setActiveOrders(active);

        // Generate notifications
        generateNotifications(ordersArray);
      }
    });

    // Request notification permission on component mount
    requestNotificationPermission();

    return () => clearInterval(timer);
  }, [generateNotifications]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Ctrl/Cmd + K for search focus
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.querySelector('.search-bar input')?.focus();
      }
      
      // Ctrl/Cmd + N for notifications
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setShowNotifications(prev => !prev);
      }
      
      // ESC to close modals
      if (e.key === 'Escape') {
        setShowNotifications(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
  };

  const markAsRead = (id) => {
    const stored = JSON.parse(localStorage.getItem('readNotifications') || '[]');
    if (!stored.includes(id)) {
      stored.push(id);
      localStorage.setItem('readNotifications', JSON.stringify(stored));
    }
    
    setNotifications(prev => 
      prev.filter(notif => notif.id !== id)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    const stored = JSON.parse(localStorage.getItem('readNotifications') || '[]');
    const allIds = notifications.map(n => n.id);
    const newStored = [...new Set([...stored, ...allIds])];
    localStorage.setItem('readNotifications', JSON.stringify(newStored));
    
    setNotifications([]);
    setUnreadCount(0);
  };

  const handleNotificationAction = (notification) => {
    markAsRead(notification.id);
    setShowNotifications(false);
    
    if (notification.orderId && onNavigate) {
      onNavigate('orders', { highlightOrder: notification.orderId });
    }
  };

  return (
    <div className="header">
      <div className="header-left">
        <button className="menu-toggle" onClick={onToggleSidebar}>
          <span></span>
          <span></span>
          <span></span>
        </button>
        <div className="page-title-container">
          <div className="page-title">{viewNames[currentView] || 'Dashboard'}</div>
          <div className="page-subtitle">
            {formatDate(currentTime)} • {formatTime(currentTime)}
          </div>
        </div>
      </div>

      <div className="header-center">
        <div className="quick-stats">
          <div className="stat-item">
            <span className="stat-label">Today's Orders</span>
            <span className="stat-value">{todayOrdersCount || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Today's Revenue</span>
            <span className="stat-value">₹{(todayRevenue || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Active Orders</span>
            <span className="stat-value">{activeOrders}</span>
          </div>
        </div>
      </div>

      <div className="header-right">
        <div className="notification-container">
          <button 
            className="notification-btn"
            onClick={handleNotificationClick}
            title="Notifications (Ctrl+N)"
          >
            <span className="notification-icon">🔔</span>
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount}</span>
            )}
          </button>
          
          {showNotifications && (
            <div className="notification-dropdown">
              <div className="notification-header">
                <div className="notification-title-section">
                  <h3>Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="notification-count">{unreadCount} unread</span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button className="mark-all-read" onClick={markAllAsRead}>
                    Mark all as read
                  </button>
                )}
              </div>
              <div className="notification-list">
                {notifications.length > 0 ? (
                  notifications.slice(0, 8).map(notification => (
                    <div 
                      key={notification.id}
                      className={`notification-item unread notification-${notification.category}`}
                      onClick={() => handleNotificationAction(notification)}
                      style={{ borderLeftColor: notificationCategories[notification.category]?.color }}
                    >
                      <div className="notification-icon">
                        {notification.icon}
                      </div>
                      <div className="notification-content">
                        <div className="notification-title">{notification.title}</div>
                        <div className="notification-message">{notification.message}</div>
                        <div className="notification-time">{notification.time}</div>
                      </div>
                      <div 
                        className="unread-dot" 
                        style={{ background: notificationCategories[notification.category]?.color }}
                      ></div>
                    </div>
                  ))
                ) : (
                  <div className="no-notifications">
                    <div className="no-notifications-icon">🎉</div>
                    <p>No new notifications</p>
                    <span>You're all caught up!</span>
                  </div>
                )}
              </div>
              <div className="notification-footer">
                <button className="view-all-btn">View All Notifications</button>
              </div>
            </div>
          )}
        </div>

        <div className="user-profile">
          <div className="user-avatar">
            {getInitials(userName)}
            <div className="online-status"></div>
          </div>
          <div className="user-details">
            <div className="user-name">{userName}</div>
            <div className="user-role">{userRole}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Header;