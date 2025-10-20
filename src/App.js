// App.js (Updated)
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import AddOrder from './components/AddOrder';
import EditOrder from './components/EditOrder';
import Stock from './components/Stock';
import Reports from './components/Reports';
import Settings from './components/Settings';
import Orders from './components/Orders';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard');
  const [editOrderId, setEditOrderId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleEditOrder = (orderId) => {
    setEditOrderId(orderId);
    setCurrentView('editOrder');
  };

  const handleNavigate = (view) => {
    setCurrentView(view);
    setSidebarOpen(false);
    if (view !== 'editOrder') {
      setEditOrderId(null);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="App">
      {user ? (
        <div className="app-container">
          <Sidebar 
            currentView={currentView} 
            onNavigate={handleNavigate}
            isOpen={sidebarOpen}
            onToggle={toggleSidebar}
          />
          <div className={`main-content ${sidebarOpen ? 'sidebar-open' : ''}`}>
            <Header 
              user={user} 
              currentView={currentView} 
              onToggleSidebar={toggleSidebar}
              onNavigate={handleNavigate}
            />
            {currentView === 'dashboard' && <Dashboard onEditOrder={handleEditOrder} onNavigate={handleNavigate} />}
            {currentView === 'orders' && <Orders onEditOrder={handleEditOrder} onNavigate={handleNavigate} />}
            {currentView === 'addOrder' && <AddOrder onNavigate={handleNavigate} />}
            {currentView === 'editOrder' && <EditOrder orderId={editOrderId} onNavigate={handleNavigate} />}
            {currentView === 'stock' && <Stock onNavigate={handleNavigate} />}
            {currentView === 'reports' && <Reports onNavigate={handleNavigate} />}
            {currentView === 'settings' && <Settings onNavigate={handleNavigate} />}
          </div>
        </div>
      ) : (
        <Login />
      )}
    </div>
  );
}

export default App;