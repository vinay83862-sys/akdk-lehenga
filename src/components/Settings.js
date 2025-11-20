import React, { useState, useEffect } from 'react';
import { ref, onValue, update, push, remove } from 'firebase/database';
import { db } from '../firebase';
import './Settings.css';

function Settings() {
  const [salesmen, setSalesmen] = useState([]);
  const [storeConfig, setStoreConfig] = useState({
    storeName: 'Lehenga Store',
    currency: 'Indian Rupee (₹)',
    dateFormat: 'DD/MM/YYYY',
    emailNotifications: true,
    lowStockThreshold: 5000,
    autoBackup: true,
    theme: 'dark',
    primaryColor: '#6366f1'
  });
  const [newSalesman, setNewSalesman] = useState({ name: '', phone: '' });
  const [activeTab, setActiveTab] = useState('general');

  // Apply theme settings
  const applyThemeSettings = (config) => {
    const root = document.documentElement;
    
    // Apply theme mode
    if (config.theme === 'light') {
      root.style.setProperty('--background', '#f8fafc');
      root.style.setProperty('--surface', '#ffffff');
      root.style.setProperty('--surface-light', '#f1f5f9');
      root.style.setProperty('--text-primary', '#1e293b');
      root.style.setProperty('--text-secondary', '#64748b');
      root.style.setProperty('--border', '#e2e8f0');
      root.style.setProperty('--shadow', 'rgba(0, 0, 0, 0.1)');
    } else {
      // Dark theme (default)
      root.style.setProperty('--background', '#0f172a');
      root.style.setProperty('--surface', '#1e293b');
      root.style.setProperty('--surface-light', '#334155');
      root.style.setProperty('--text-primary', '#f8fafc');
      root.style.setProperty('--text-secondary', '#cbd5e1');
      root.style.setProperty('--border', '#475569');
      root.style.setProperty('--shadow', 'rgba(0, 0, 0, 0.3)');
    }
    
    // Apply primary color
    if (config.primaryColor) {
      root.style.setProperty('--primary', config.primaryColor);
      root.style.setProperty('--gradient', `linear-gradient(135deg, ${config.primaryColor} 0%, #764ba2 100%)`);
    }
  };

  useEffect(() => {
    // Load salesmen
    const salesmenRef = ref(db, 'salesmen');
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

    // Load settings
    const settingsRef = ref(db, 'settings');
    onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const updatedConfig = { ...storeConfig, ...data };
        setStoreConfig(updatedConfig);
        applyThemeSettings(updatedConfig);
      }
    });
  }, []);

  const handleConfigChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    const updatedConfig = {
      ...storeConfig,
      [name]: newValue
    };
    
    setStoreConfig(updatedConfig);
    applyThemeSettings(updatedConfig);
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    try {
      await update(ref(db, 'settings'), storeConfig);
      alert('✅ Settings saved successfully!');
    } catch (error) {
      alert('❌ Error saving settings: ' + error.message);
    }
  };

  const addSalesman = async () => {
    if (!newSalesman.name.trim()) {
      alert('Please enter salesman name');
      return;
    }

    try {
      const salesmenRef = ref(db, 'salesmen');
      await push(salesmenRef, {
        name: newSalesman.name,
        phone: newSalesman.phone,
        active: true,
        createdAt: Date.now()
      });
      setNewSalesman({ name: '', phone: '' });
      alert('✅ Salesman added successfully!');
    } catch (error) {
      alert('❌ Error adding salesman: ' + error.message);
    }
  };

  const toggleSalesmanStatus = async (salesmanId, currentStatus) => {
    try {
      await update(ref(db, `salesmen/${salesmanId}`), {
        active: !currentStatus
      });
      alert('✅ Salesman status updated!');
    } catch (error) {
      alert('❌ Error updating salesman: ' + error.message);
    }
  };

  const deleteSalesman = async (salesmanId, salesmanName) => {
    if (window.confirm(`Are you sure you want to delete ${salesmanName}?`)) {
      try {
        await remove(ref(db, `salesmen/${salesmanId}`));
        alert('✅ Salesman deleted successfully!');
      } catch (error) {
        alert('❌ Error deleting salesman: ' + error.message);
      }
    }
  };

  const exportData = () => {
    alert('Data export functionality would be implemented here');
  };

  const importData = () => {
    alert('Data import functionality would be implemented here');
  };

  const resetTheme = () => {
    const defaultConfig = {
      ...storeConfig,
      theme: 'dark',
      primaryColor: '#6366f1'
    };
    setStoreConfig(defaultConfig);
    applyThemeSettings(defaultConfig);
    alert('✅ Theme reset to default!');
  };

  const colorPresets = [
    { name: 'Purple', value: '#6366f1' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#10b981' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Orange', value: '#f59e0b' },
    { name: 'Pink', value: '#ec4899' }
  ];

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>⚙️ System Settings</h1>
        <p>Manage your store configuration and user settings</p>
      </div>

      <div className="tabs" style={{ marginBottom: '2rem', display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)' }}>
        {['general', 'appearance', 'salesmen', 'backup'].map(tab => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'general' && (
        <div className="card">
          <div className="card-header">
            General Settings
          </div>
          <div className="card-body">
            <form onSubmit={saveSettings}>
              <div className="settings-grid">
                <div className="setting-item">
                  <label htmlFor="storeName">Store Name</label>
                  <input
                    type="text"
                    className="form-control"
                    id="storeName"
                    name="storeName"
                    value={storeConfig.storeName}
                    onChange={handleConfigChange}
                  />
                </div>

                <div className="setting-item">
                  <label htmlFor="currency">Currency</label>
                  <select
                    className="form-select"
                    id="currency"
                    name="currency"
                    value={storeConfig.currency}
                    onChange={handleConfigChange}
                  >
                    <option value="Indian Rupee (₹)">Indian Rupee (₹)</option>
                    <option value="US Dollar ($)">US Dollar ($)</option>
                    <option value="Euro (€)">Euro (€)</option>
                  </select>
                </div>

                <div className="setting-item">
                  <label htmlFor="dateFormat">Date Format</label>
                  <select
                    className="form-select"
                    id="dateFormat"
                    name="dateFormat"
                    value={storeConfig.dateFormat}
                    onChange={handleConfigChange}
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>

                <div className="setting-item">
                  <label htmlFor="lowStockThreshold">Low Stock Threshold (₹)</label>
                  <input
                    type="number"
                    className="form-control"
                    id="lowStockThreshold"
                    name="lowStockThreshold"
                    value={storeConfig.lowStockThreshold}
                    onChange={handleConfigChange}
                    min="0"
                  />
                </div>
              </div>

              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="emailNotifications"
                  name="emailNotifications"
                  checked={storeConfig.emailNotifications}
                  onChange={handleConfigChange}
                />
                <label className="form-check-label" htmlFor="emailNotifications">
                  Enable Email Notifications
                </label>
              </div>

              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="autoBackup"
                  name="autoBackup"
                  checked={storeConfig.autoBackup}
                  onChange={handleConfigChange}
                />
                <label className="form-check-label" htmlFor="autoBackup">
                  Enable Auto Backup
                </label>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '2rem' }}>
                💾 Save Settings
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'appearance' && (
        <div className="card">
          <div className="card-header">
            Appearance & Theme
          </div>
          <div className="card-body">
            <div className="settings-grid">
              <div className="setting-item">
                <label htmlFor="theme">Theme Mode</label>
                <select
                  className="form-select"
                  id="theme"
                  name="theme"
                  value={storeConfig.theme}
                  onChange={handleConfigChange}
                >
                  <option value="dark">Dark Theme</option>
                  <option value="light">Light Theme</option>
                </select>
                <small style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                  Change the visual appearance of the application
                </small>
              </div>

              <div className="setting-item">
                <label htmlFor="primaryColor">Primary Color</label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <input
                    type="color"
                    className="form-control"
                    id="primaryColor"
                    name="primaryColor"
                    value={storeConfig.primaryColor}
                    onChange={handleConfigChange}
                    style={{ width: '60px', height: '40px', padding: '0' }}
                  />
                  <span>{storeConfig.primaryColor}</span>
                </div>
              </div>

              <div className="setting-item">
                <label>Color Presets</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  {colorPresets.map(preset => (
                    <button
                      key={preset.value}
                      type="button"
                      className="btn btn-sm"
                      onClick={() => handleConfigChange({ target: { name: 'primaryColor', value: preset.value } })}
                      style={{
                        background: preset.value,
                        color: 'white',
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        border: storeConfig.primaryColor === preset.value ? '2px solid white' : 'none'
                      }}
                      title={preset.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'var(--surface-light)', borderRadius: '1rem' }}>
              <h4>Theme Preview</h4>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                  Card Preview
                </div>
                <button className="btn btn-primary">Primary Button</button>
                <button className="btn btn-outline-secondary">Secondary Button</button>
              </div>
            </div>

            <button 
              className="btn btn-outline-secondary" 
              onClick={resetTheme}
              style={{ marginTop: '2rem' }}
            >
              🔄 Reset to Default
            </button>
          </div>
        </div>
      )}

      {activeTab === 'salesmen' && (
        <>
          <div className="card">
            <div className="card-header">
              Sales Team Management
            </div>
            <div className="card-body">
              <div className="form-group">
                <label>Add New Salesman</label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'end' }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Salesman Name"
                      value={newSalesman.name}
                      onChange={(e) => setNewSalesman(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="tel"
                      className="form-control"
                      placeholder="Phone Number"
                      value={newSalesman.phone}
                      onChange={(e) => setNewSalesman(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <button className="btn btn-primary" onClick={addSalesman}>
                    ➕ Add Salesman
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              Current Sales Team
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesmen.map(salesman => (
                      <tr key={salesman.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div className="user-avatar">
                              {salesman.name.charAt(0).toUpperCase()}
                            </div>
                            {salesman.name}
                          </div>
                        </td>
                        <td>{salesman.phone || '-'}</td>
                        <td>
                          <span className={`badge ${salesman.active ? 'bg-success' : 'bg-secondary'}`}>
                            {salesman.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => toggleSalesmanStatus(salesman.id, salesman.active)}
                            >
                              {salesman.active ? '⏸️' : '▶️'}
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => deleteSalesman(salesman.id, salesman.name)}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {salesmen.length === 0 && (
                      <tr>
                        <td colSpan="4" className="text-center">
                          <div className="no-items">
                            <div className="no-items-icon">👨‍💼</div>
                            <p>No salesmen added yet</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'backup' && (
        <div className="card">
          <div className="card-header">
            Data Management
          </div>
          <div className="card-body">
            <div className="settings-grid">
              <div className="setting-item">
                <h4>Export Data</h4>
                <p>Download all your store data as a backup file</p>
                <button className="btn btn-primary" onClick={exportData}>
                  📥 Export Data
                </button>
              </div>

              <div className="setting-item">
                <h4>Import Data</h4>
                <p>Restore your store from a backup file</p>
                <button className="btn btn-outline-secondary" onClick={importData}>
                  📤 Import Data
                </button>
              </div>

              <div className="setting-item">
                <h4>Auto Backup</h4>
                <p>Last backup: {storeConfig.autoBackup ? 'Enabled' : 'Disabled'}</p>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="autoBackup"
                    name="autoBackup"
                    checked={storeConfig.autoBackup}
                    onChange={handleConfigChange}
                  />
                  <label className="form-check-label" htmlFor="autoBackup">
                    Enable automatic daily backups
                  </label>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'var(--surface-light)', borderRadius: '1rem' }}>
              <h4>Storage Information</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <span>Database Size: ~2.5 MB</span>
                <span>Last Backup: Today, 02:00 AM</span>
                <span>Backups: 7 days retention</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;