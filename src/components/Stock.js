// components/Stock.js
import React, { useState, useEffect } from 'react';
import { ref, onValue, remove, update, push, query, orderByChild, equalTo } from 'firebase/database';
import { db } from '../firebase';
import './Stock.css';

function Stock({ onNavigate }) {
  const [stockItems, setStockItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingItem, setEditingItem] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editDesign, setEditDesign] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [newDesign, setNewDesign] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newBarcode, setNewBarcode] = useState('');

  useEffect(() => {
    const stockRef = ref(db, 'Stock');
    onValue(stockRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const stockList = Object.entries(data).map(([id, item]) => ({
          id,
          ...item
        }));
        setStockItems(stockList);
      }
    });
  }, []);

  // Filter items based on search term
  const filteredItems = stockItems.filter(item => 
    item.design?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.amount?.toString().includes(searchTerm) ||
    item.barcode?.includes(searchTerm)
  );

  const handleAddStock = () => {
    setShowAddModal(true);
  };

  const checkBarcodeExists = (barcode, onSuccess) => {
    if (!barcode) {
      onSuccess();
      return;
    }

    const barcodeQuery = query(ref(db, 'Stock'), orderByChild('barcode'), equalTo(barcode));
    onValue(barcodeQuery, (snapshot) => {
      if (snapshot.exists()) {
        alert("Barcode already exists!");
      } else {
        onSuccess();
      }
    }, { onlyOnce: true });
  };

  const handleSaveNewStock = () => {
    if (newDesign && newAmount) {
      checkBarcodeExists(newBarcode, () => {
        const stockRef = ref(db, 'Stock');
        push(stockRef, {
          design: newDesign,
          amount: parseFloat(newAmount) || 0,
          barcode: newBarcode || ''
        })
        .then(() => {
          alert("Stock item added successfully!");
          setShowAddModal(false);
          setNewDesign('');
          setNewAmount('');
          setNewBarcode('');
        })
        .catch((error) => {
          alert("Error adding stock: " + error.message);
        });
      });
    } else {
      alert("Please fill design and amount fields");
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setEditDesign(item.design || '');
    setEditAmount(item.amount || '');
    setEditBarcode(item.barcode || '');
    setShowEditModal(true);
  };

  const checkBarcodeExistsForUpdate = (barcode, onSuccess) => {
    if (!barcode || barcode === editingItem.barcode) {
      onSuccess();
      return;
    }

    const barcodeQuery = query(ref(db, 'Stock'), orderByChild('barcode'), equalTo(barcode));
    onValue(barcodeQuery, (snapshot) => {
      if (snapshot.exists()) {
        alert("Barcode already exists!");
      } else {
        onSuccess();
      }
    }, { onlyOnce: true });
  };

  const handleUpdate = () => {
    if (editingItem && editDesign && editAmount) {
      checkBarcodeExistsForUpdate(editBarcode, () => {
        const stockRef = ref(db, `Stock/${editingItem.id}`);
        update(stockRef, {
          design: editDesign,
          amount: parseFloat(editAmount) || 0,
          barcode: editBarcode || ''
        })
        .then(() => {
          alert("Stock item updated successfully!");
          setShowEditModal(false);
          setEditingItem(null);
        })
        .catch((error) => {
          alert("Error updating stock: " + error.message);
        });
      });
    } else {
      alert("Please fill design and amount fields");
    }
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this stock item?")) {
      const stockRef = ref(db, `Stock/${id}`);
      remove(stockRef)
        .then(() => {
          alert("Stock item deleted successfully!");
        })
        .catch((error) => {
          alert("Error deleting stock: " + error.message);
        });
    }
  };

  const handleCloseModal = () => {
    setShowEditModal(false);
    setShowAddModal(false);
    setEditingItem(null);
    setEditBarcode('');
    setNewBarcode('');
  };

  const handleScanBarcode = () => {
    // Simulate barcode scanning - in real app, integrate with a barcode scanner
    const simulatedBarcode = Math.random().toString(36).substring(2, 10).toUpperCase();
    if (showAddModal) {
      setNewBarcode(simulatedBarcode);
    } else if (showEditModal) {
      setEditBarcode(simulatedBarcode);
    }
  };

  return (
    <div className="stock-container">
      <div className="stock-header">
        <h1>Stock Management</h1>
        <p className="stock-subtitle">Manage your inventory with premium control</p>
      </div>
      
      <div className="card">
        <div className="card-header">
          <div className="card-title-section">
            <span className="card-title">Current Stock</span>
            <span className="card-subtitle">{filteredItems.length} items found</span>
          </div>
          <div className="search-section">
            <div className="search-input-wrapper">
              <i className="fas fa-search search-icon"></i>
              <input 
                type="text" 
                className="search-input" 
                placeholder="Search by design, amount, or barcode..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button 
                  className="clear-search"
                  onClick={() => setSearchTerm('')}
                >
                  <i className="fas fa-times"></i>
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="table-container">
            <table className="stock-table">
              <thead>
                <tr>
                  <th>Design No.</th>
                  <th>Amount (₹)</th>
                  <th>Barcode</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length > 0 ? (
                  filteredItems.map(item => (
                    <tr key={item.id} className="table-row">
                      <td className="design-cell">
                        <div className="design-info">
                          <span className="design-text">{item.design || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="amount-cell">
                        <span className="amount-text">₹{item.amount ? item.amount.toLocaleString('en-IN') : '0'}</span>
                      </td>
                      <td className="barcode-cell">
                        {item.barcode ? (
                          <span className="barcode-text">{item.barcode}</span>
                        ) : (
                          <span className="no-barcode">No barcode</span>
                        )}
                      </td>
                      <td className="status-cell">
                        <span className={`status-badge ${item.amount > 5000 ? 'status-instock' : 'status-lowstock'}`}>
                          {item.amount > 5000 ? (
                            <>
                              <i className="fas fa-check-circle"></i>
                              In Stock
                            </>
                          ) : (
                            <>
                              <i className="fas fa-exclamation-triangle"></i>
                              Low Stock
                            </>
                          )}
                        </span>
                      </td>
                      <td className="actions-cell">
                        <div className="action-buttons">
                          <button 
                            className="btn-action btn-edit"
                            onClick={() => handleEdit(item)}
                            title="Edit item"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button 
                            className="btn-action btn-delete"
                            onClick={() => handleDelete(item.id)}
                            title="Delete item"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="no-data-row">
                    <td colSpan="5" className="no-data-cell">
                      <div className="no-data-content">
                        <i className="fas fa-box-open no-data-icon"></i>
                        <p>No stock items found</p>
                        <button 
                          className="btn-primary no-data-btn"
                          onClick={handleAddStock}
                        >
                          <i className="fas fa-plus"></i>
                          Add Your First Item
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Floating Add Button */}
      <button className="fab-button" onClick={handleAddStock} title="Add new stock item">
        <i className="fas fa-plus"></i>
      </button>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-backdrop show">
          <div className="modal d-block">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="fas fa-edit modal-icon"></i>
                    Edit Stock Item
                  </h5>
                  <button type="button" className="btn-close" onClick={handleCloseModal}></button>
                </div>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Design Number *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editDesign}
                      onChange={(e) => setEditDesign(e.target.value)}
                      placeholder="Enter design number"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount (₹) *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      placeholder="Enter amount"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Barcode</label>
                    <div className="barcode-input-group">
                      <input
                        type="text"
                        className="form-control"
                        value={editBarcode}
                        onChange={(e) => setEditBarcode(e.target.value)}
                        placeholder="Enter barcode"
                      />
                      <button 
                        className="barcode-scan-btn"
                        onClick={handleScanBarcode}
                        type="button"
                        title="Scan barcode"
                      >
                        <i className="fas fa-barcode"></i>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleUpdate}>
                    <i className="fas fa-save"></i>
                    Update Stock
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="modal-backdrop show">
          <div className="modal d-block">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    <i className="fas fa-plus-circle modal-icon"></i>
                    Add New Stock Item
                  </h5>
                  <button type="button" className="btn-close" onClick={handleCloseModal}></button>
                </div>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Design Number *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={newDesign}
                      onChange={(e) => setNewDesign(e.target.value)}
                      placeholder="Enter design number"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount (₹) *</label>
                    <input
                      type="number"
                      className="form-control"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      placeholder="Enter amount"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Barcode</label>
                    <div className="barcode-input-group">
                      <input
                        type="text"
                        className="form-control"
                        value={newBarcode}
                        onChange={(e) => setNewBarcode(e.target.value)}
                        placeholder="Enter barcode"
                      />
                      <button 
                        className="barcode-scan-btn"
                        onClick={handleScanBarcode}
                        type="button"
                        title="Scan barcode"
                      >
                        <i className="fas fa-barcode"></i>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                    Cancel
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleSaveNewStock}>
                    <i className="fas fa-plus"></i>
                    Add Stock Item
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Stock;