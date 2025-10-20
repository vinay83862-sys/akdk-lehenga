// EditOrder.js - Next Level UI with Enhanced Sidebar
import React, { useState, useEffect } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../firebase';
import './AddOrder.css';

function EditOrder({ orderId, onNavigate, currentUser }) {
  const [formData, setFormData] = useState({
    customerName: '',
    phoneNumber: '',
    billNumber: '',
    paidAmount: '',
    deliveryDate: '',
    notes: '',
    paymentType: 'Cash',
    status: 'Pending'
  });

  const [lehengas, setLehengas] = useState([{
    design: '',
    color: '',
    amount: '',
    stitchingOption: 'Unstitched',
    length: '',
    waist: '',
    hip: '',
    blouseOption: '',
    blouseDate: '',
    mainDupatta: '',
    extraDupatta: 'No',
    extraDupattaType: '',
    netDupattaColor: '',
    otherDupattaType: '',
    salesmen: []
  }]);

  const [customers, setCustomers] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [salesmenSearchTerms, setSalesmenSearchTerms] = useState(['']);
  const [totalAmount, setTotalAmount] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [activeSection, setActiveSection] = useState('customer');
  const [activeLehenga, setActiveLehenga] = useState(null);
  const [orderMetadata, setOrderMetadata] = useState({
    createdAt: '',
    createdBy: '',
    updatedAt: '',
    updatedBy: ''
  });

  const paymentOptions = [
    'Cash', 'Online', 'UPI-3877', 'Card-3877', 
    'Cash-3F', 'UPI-19120', 'Card-19120'
  ];

  // Updated Status Colors with On Stitching
  const statusColors = {
    'Pending': '#ffc107',
    'Confirmed': '#17a2b8',
    'On Stitching': '#2196F3',
    'Stitched': '#6f42c1',
    'Ready': '#20c997',
    'Delivered': '#28a745',
    'Cancelled': '#dc3545'
  };

  // Updated Blouse Options
  const blouseOptions = [
    'By Hand',
    'With LC',
    'Specific Date'
  ];

  // Updated Main Dupatta Options
  const mainDupattaOptions = [
    'By Hand',
    'With LC - Normal Lace',
    'With LC - Fancy Lace',
    'With LC - Without Lace',
    'With LC - Cutwork'
  ];

  // Extra Dupatta Type Options
  const extraDupattaTypeOptions = [
    'Net',
    'Velvet Stole',
    'Other'
  ];

  // Comprehensive Color Options with Suggestions
  const colorOptions = [
    'Red', 'Blood-Red', 'Red-Silk', 'Red-Wine', 'Cherry', 'Wine', 'Maroon', 'D.Maroon',
    'Rani', 'Rani-Silk', 'Pink', 'Onion', 'Onion-Pink', 'Baby-Pink', 'Peach', 'Pastel-Pink',
    'Magenta', 'Yellow', 'Mustard', 'Gold', 'Golden', 'CP-Gold', 'Pastel-Yellow', 'Blue',
    'Navy-Blue', 'T-Blue', 'Sky-Blue', 'Peacock-Blue', 'Firozi', 'Turquoise', 'Pastel-Blue',
    'Green', 'Bottle-Green', 'Peacock-Green', 'Olive-Green', 'Sea-Green', 'Mint-Green',
    'Lime-Green', 'Pastel-Green', 'Teal', 'Purple', 'Lavender', 'Lavender-Shaded',
    'Purple-Shaded', 'Pastel-Lavender', 'Black', 'White', 'Cream', 'Off-White', 'Silver',
    'Beige', 'Brown', 'Coffee', 'Khaki', 'Grey', 'Dark-Grey', 'Charcoal', 'Rust', 'Gajari',
    'Orange', 'Peacock', 'Pastel', 'Multicolor',
    // Additional colors from original list
    'Crimson', 'Scarlet', 'Vermilion', 'Ruby', 'Carmine', 'Burgundy', 'Dark Red',
    'Hot Pink', 'Deep Pink', 'Light Pink', 'Rose', 'Fuchsia', 'Raspberry',
    'Dark Orange', 'Light Orange', 'Coral', 'Salmon', 'Tangerine', 'Amber', 'Bronze',
    'Lemon Yellow', 'Light Yellow', 'Canary Yellow', 'Amber Yellow', 'Saffron',
    'Lime Green', 'Forest Green', 'Emerald Green', 'Mint Green', 'Sea Green',
    'Royal Blue', 'Baby Blue', 'Aqua', 'Sapphire', 'Cobalt Blue',
    'Violet', 'Lilac', 'Mauve', 'Plum', 'Orchid', 'Indigo', 'Amethyst',
    'Light Brown', 'Dark Brown', 'Tan', 'Coffee', 'Chocolate', 'Cinnamon', 'Caramel',
    'Charcoal', 'Jet Black', 'Ebony', 'Onyx',
    'Ivory', 'Eggshell', 'Pearl White', 'Snow White',
    'Silver', 'Light Gray', 'Dark Gray', 'Slate Gray', 'Ash Gray',
    'Multi-color', 'Ombre', 'Gradient', 'Printed', 'Floral', 'Geometric', 'Abstract',
    'Metallic Gold', 'Metallic Silver', 'Metallic Bronze', 'Metallic Copper',
    'Pastel Blue', 'Pastel Pink', 'Pastel Green', 'Pastel Yellow', 'Pastel Purple',
    'Neon Pink', 'Neon Green', 'Neon Yellow', 'Neon Orange', 'Neon Blue',
    'Nude', 'Skin Tone', 'Blush', 'Dusty Pink', 'Dusty Blue', 'Dusty Rose',
    'Bordeaux', 'Merlot', 'Burgundy Wine', 'Dark Maroon',
    'Peach Pink', 'Coral Pink', 'Rose Gold', 'Dusty Orange', 'Terracotta',
    'Olive', 'Army Green', 'Khaki', 'Camouflage', 'Moss Green',
    'Turquoise Blue', 'Aqua Blue', 'Seafoam Green', 'Ocean Blue', 'Marine Blue',
    'Lavender Purple', 'Orchid Purple', 'Violet Purple', 'Grape', 'Deep Purple',
    'Champagne', 'Vanilla', 'Buttercream'
  ];

  // Date formatting functions
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    
    try {
      if (dateString.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
        const parts = dateString.split('-');
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
      else if (dateString.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        const parts = dateString.split('/');
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
      else if (dateString.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
        return dateString;
      }
    } catch (error) {
      console.error('Date conversion error:', error);
    }
    
    return '';
  };

  const formatDateForStorage = (dateString) => {
    if (!dateString) return '';
    
    try {
      if (dateString.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
        const parts = dateString.split('-');
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return dateString;
    } catch (error) {
      return dateString;
    }
  };

  // Format timestamp to readable date
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Load order data and other data from Firebase
  useEffect(() => {
    if (!orderId) return;

    setLoading(true);

    const orderRef = ref(db, `Orders/${orderId}`);
    onValue(orderRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setFormData({
          customerName: data.customerName || '',
          phoneNumber: data.phoneNumber || '',
          billNumber: data.billNumber || '',
          paidAmount: data.paidAmount || '',
          deliveryDate: formatDateForInput(data.deliveryDate) || '',
          notes: data.notes || '',
          paymentType: data.paymentType || 'Cash',
          status: data.status || 'Pending'
        });

        // Set metadata
        setOrderMetadata({
          createdAt: data.createdAt || '',
          createdBy: data.createdBy || 'Unknown',
          updatedAt: data.updatedAt || '',
          updatedBy: data.updatedBy || 'Unknown'
        });

        if (data.lehengaDetails && Array.isArray(data.lehengaDetails)) {
          const updatedLehengas = data.lehengaDetails.map(lehenga => ({
            design: lehenga.design || '',
            color: lehenga.color || '',
            amount: lehenga.amount || '',
            stitchingOption: lehenga.stitchingOption || 'Unstitched',
            length: lehenga.length || '',
            waist: lehenga.waist || '',
            hip: lehenga.hip || '',
            blouseOption: lehenga.blouseOption || '',
            blouseDate: formatDateForInput(lehenga.blouseDate) || '',
            mainDupatta: lehenga.mainDupatta || '',
            extraDupatta: lehenga.extraDupatta || 'No',
            extraDupattaType: lehenga.extraDupattaType || '',
            netDupattaColor: lehenga.netDupattaColor || '',
            otherDupattaType: lehenga.otherDupattaType || '',
            salesmen: Array.isArray(lehenga.salesmen) ? lehenga.salesmen : []
          }));
          setLehengas(updatedLehengas);
          setSalesmenSearchTerms(updatedLehengas.map(() => ''));
        }
      }
    });

    // Load other data
    const customersRef = ref(db, 'Orders');
    onValue(customersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const customersList = Object.values(data)
          .filter(order => order.customerName)
          .map(order => ({
            name: order.customerName,
            phone: order.phoneNumber
          }));
        setCustomers(customersList);
      }
    });

    const stockRef = ref(db, 'Stock');
    onValue(stockRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const stockList = Object.values(data);
        setStockItems(stockList);
      }
    });

    // Load salesmen
    const salesmenRef = ref(db, 'salesmen');
    onValue(salesmenRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        let salesmenList = Object.entries(data)
          .map(([id, salesman]) => ({
            id,
            ...salesman
          }))
          .filter(salesman => salesman.active === true || salesman.active === undefined);
          
        salesmenList = salesmenList.sort((a, b) => a.name.localeCompare(b.name));
        setSalesmen(salesmenList);
        setLoading(false);
      }
    });
  }, [orderId]);

  // Calculate amounts
  useEffect(() => {
    const total = lehengas.reduce((sum, lehenga) => {
      return sum + (parseFloat(lehenga.amount) || 0);
    }, 0);
    setTotalAmount(total);

    const paid = parseFloat(formData.paidAmount) || 0;
    setPendingAmount(total - paid);
  }, [lehengas, formData.paidAmount]);

  // Auto-fill amount when design is selected
  const handleDesignChange = (index, designName) => {
    // Find the stock item with matching design
    const stockItem = stockItems.find(item => 
      item.design && item.design.toLowerCase() === designName.toLowerCase()
    );
    
    if (stockItem && stockItem.amount) {
      handleLehengaChange(index, 'amount', stockItem.amount);
    }
    
    handleLehengaChange(index, 'design', designName);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.customerName.trim()) newErrors.customerName = 'Customer name is required';
    if (!formData.phoneNumber.trim()) newErrors.phoneNumber = 'Phone number is required';
    if (!formData.billNumber.trim()) newErrors.billNumber = 'Bill number is required';

    lehengas.forEach((lehenga, index) => {
      if (!lehenga.design.trim()) newErrors[`lehenga${index}Design`] = `Design is required for Lehenga ${index + 1}`;
      if (!lehenga.color.trim()) newErrors[`lehenga${index}Color`] = `Color is required for Lehenga ${index + 1}`;
      if (!lehenga.amount || parseFloat(lehenga.amount) <= 0) newErrors[`lehenga${index}Amount`] = `Valid amount is required for Lehenga ${index + 1}`;
      
      if (!lehenga.salesmen || lehenga.salesmen.length === 0) {
        newErrors[`lehenga${index}Salesmen`] = `At least one salesman must be selected for Lehenga ${index + 1}`;
      }
    });

    if (parseFloat(formData.paidAmount) > totalAmount) {
      newErrors.paidAmount = 'Paid amount cannot be greater than total amount';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleLehengaChange = (index, field, value) => {
    setLehengas(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      
      if (field === 'blouseOption' && value !== 'Specific Date') {
        updated[index].blouseDate = '';
      }
      
      if (field === 'extraDupatta' && value === 'No') {
        updated[index].extraDupattaType = '';
        updated[index].netDupattaColor = '';
        updated[index].otherDupattaType = '';
      }
      if (field === 'extraDupattaType' && value !== 'Net' && value !== 'Velvet Stole') {
        updated[index].netDupattaColor = '';
      }
      
      return updated;
    });

    const errorKey = `lehenga${index}${field.charAt(0).toUpperCase() + field.slice(1)}`;
    if (errors[errorKey]) {
      setErrors(prev => ({
        ...prev,
        [errorKey]: ''
      }));
    }
  };

  const addLehenga = () => {
    setLehengas(prev => [...prev, {
      design: '',
      color: '',
      amount: '',
      stitchingOption: 'Unstitched',
      length: '',
      waist: '',
      hip: '',
      blouseOption: '',
      blouseDate: '',
      mainDupatta: '',
      extraDupatta: 'No',
      extraDupattaType: '',
      netDupattaColor: '',
      otherDupattaType: '',
      salesmen: []
    }]);
    setSalesmenSearchTerms(prev => [...prev, '']);
  };

  const removeLehenga = (index) => {
    if (lehengas.length > 1) {
      setLehengas(prev => prev.filter((_, i) => i !== index));
      setSalesmenSearchTerms(prev => prev.filter((_, i) => i !== index));
      
      const newErrors = { ...errors };
      Object.keys(newErrors).forEach(key => {
        if (key.startsWith(`lehenga${index}`)) {
          delete newErrors[key];
        }
      });
      setErrors(newErrors);
    }
  };

  const handleSalesmanToggle = (lehengaIndex, salesmanName) => {
    setLehengas(prev => {
      const updatedLehengas = prev.map((lehenga, index) => {
        if (index === lehengaIndex) {
          const currentSalesmen = lehenga.salesmen || [];
          const isSelected = currentSalesmen.includes(salesmanName);
          
          const newSalesmen = isSelected
            ? currentSalesmen.filter(name => name !== salesmanName)
            : [...currentSalesmen, salesmanName];
          
          return {
            ...lehenga,
            salesmen: newSalesmen
          };
        }
        return lehenga;
      });
      
      return updatedLehengas;
    });

    const errorKey = `lehenga${lehengaIndex}Salesmen`;
    if (errors[errorKey]) {
      setErrors(prev => ({
        ...prev,
        [errorKey]: ''
      }));
    }
  };

  const handleSalesmanSearchChange = (lehengaIndex, value) => {
    setSalesmenSearchTerms(prev => {
      const updated = [...prev];
      updated[lehengaIndex] = value;
      return updated;
    });
  };

  const getFilteredSalesmen = (lehengaIndex) => {
    const searchTerm = salesmenSearchTerms[lehengaIndex] || '';
    if (!searchTerm.trim()) {
      return salesmen;
    }
    return salesmen.filter(salesman => 
      salesman.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      alert('Please fix the errors in the form before submitting.');
      return;
    }

    setLoading(true);

    const orderRef = ref(db, `Orders/${orderId}`);
    
    const currentTimestamp = Date.now();
    const currentUser = 'Admin User'; // This should come from your auth system

    const orderData = {
      ...formData,
      deliveryDate: formatDateForStorage(formData.deliveryDate),
      lehengaDetails: lehengas.map(lehenga => ({
        ...lehenga,
        blouseDate: formatDateForStorage(lehenga.blouseDate),
        salesmen: lehenga.salesmen || [],
        amount: parseFloat(lehenga.amount) || 0
      })),
      totalAmount: totalAmount,
      pendingAmount: pendingAmount,
      updatedAt: currentTimestamp,
      updatedBy: currentUser,
      paidAmount: parseFloat(formData.paidAmount) || 0,
      // Keep original created data
      createdAt: orderMetadata.createdAt,
      createdBy: orderMetadata.createdBy
    };

    update(orderRef, orderData)
      .then(() => {
        alert('✅ Order updated successfully!');
        onNavigate('dashboard');
      })
      .catch(error => {
        console.error('Error updating order:', error);
        alert('❌ Error updating order. Please try again.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const scrollToSection = (sectionId) => {
    setActiveSection(sectionId);
    setActiveLehenga(null);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToLehenga = (index) => {
    setActiveSection('lehenga');
    setActiveLehenga(index);
    const element = document.getElementById(`lehenga-${index}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (loading) {
    return (
      <div className="add-order-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading order data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="add-order-container">
      {/* Enhanced Navigation Sidebar */}
      <div className="form-navigation">
        <div className="nav-header">
          <h3>Edit Order</h3>
          <div className="order-status-badge" style={{ backgroundColor: statusColors[formData.status] }}>
            {formData.status}
          </div>
        </div>
        <nav className="nav-links">
          <button 
            className={`nav-link ${activeSection === 'customer' ? 'active' : ''}`}
            onClick={() => scrollToSection('customer')}
          >
            <span className="nav-icon">👤</span>
            Customer Details
          </button>
          
          {/* Enhanced Lehenga Details Section */}
          <div className="nav-group">
            <button 
              className={`nav-link ${activeSection === 'lehenga' ? 'active' : ''}`}
              onClick={() => scrollToSection('lehenga')}
            >
              <span className="nav-icon">👗</span>
              Lehenga Details
              <span className="item-count">{lehengas.length}</span>
            </button>
            
            {/* Lehenga List in Sidebar */}
            <div className="lehenga-sidebar-list">
              {lehengas.map((lehenga, index) => (
                <button
                  key={index}
                  className={`lehenga-sidebar-item ${activeLehenga === index ? 'active' : ''}`}
                  onClick={() => scrollToLehenga(index)}
                >
                  <div className="lehenga-sidebar-info">
                    <span className="lehenga-number">Lehenga #{index + 1}</span>
                    {lehenga.design && (
                      <span className="lehenga-design">Design: {lehenga.design}</span>
                    )}
                    <span className="lehenga-amount">₹{lehenga.amount || '0'}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          <button 
            className={`nav-link ${activeSection === 'payment' ? 'active' : ''}`}
            onClick={() => scrollToSection('payment')}
          >
            <span className="nav-icon">💰</span>
            Payment Details
          </button>

          <button 
            className={`nav-link ${activeSection === 'metadata' ? 'active' : ''}`}
            onClick={() => scrollToSection('metadata')}
          >
            <span className="nav-icon">📊</span>
            Order Metadata
          </button>
        </nav>
        <div className="nav-summary">
          <div className="summary-item">
            <span>Total Amount</span>
            <strong>₹{totalAmount.toLocaleString('en-IN')}</strong>
          </div>
          <div className="summary-item">
            <span>Pending</span>
            <strong className={pendingAmount > 0 ? 'pending' : 'paid'}>
              ₹{pendingAmount.toLocaleString('en-IN')}
            </strong>
          </div>
        </div>
      </div>

      {/* Main Form Content */}
      <div className="form-content">
        <div className="content-header">
          <div className="header-main">
            <h1>Edit Order</h1>
            <p>Update order details and manage lehenga information</p>
          </div>
          <div className="header-actions">
            <button 
              className="btn-secondary"
              onClick={() => onNavigate('dashboard')}
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>

        <form className="order-form" onSubmit={handleSubmit}>
          {/* Customer Details Section */}
          <section id="customer" className="form-section">
            <div className="section-header">
              <div className="section-title">
                <div className="title-icon">👤</div>
                <h2>Customer Information</h2>
              </div>
              <div className="section-actions">
                <div className="quick-stats">
                  <div className="stat">
                    <span className="stat-label">Bill No:</span>
                    <span className="stat-value">{formData.billNumber}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group floating-label">
                <input
                  type="text"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleInputChange}
                  list="customerNames"
                  required
                  className={errors.customerName ? 'error' : ''}
                  placeholder=" "
                />
                <label>Customer Name *</label>
                <datalist id="customerNames">
                  {customers.map((customer, index) => (
                    <option key={index} value={customer.name} />
                  ))}
                </datalist>
                {errors.customerName && <div className="error-message">{errors.customerName}</div>}
              </div>

              <div className="form-group floating-label">
                <input
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  required
                  className={errors.phoneNumber ? 'error' : ''}
                  placeholder=" "
                />
                <label>Phone Number *</label>
                {errors.phoneNumber && <div className="error-message">{errors.phoneNumber}</div>}
              </div>

              <div className="form-group floating-label">
                <input
                  type="text"
                  name="billNumber"
                  value={formData.billNumber}
                  onChange={handleInputChange}
                  required
                  className={errors.billNumber ? 'error' : ''}
                  placeholder=" "
                />
                <label>Bill Number *</label>
                {errors.billNumber && <div className="error-message">{errors.billNumber}</div>}
              </div>

              <div className="form-group floating-label">
                <input
                  type="date"
                  name="deliveryDate"
                  value={formData.deliveryDate}
                  onChange={handleInputChange}
                  placeholder=" "
                />
                <label>Delivery Date</label>
              </div>

              <div className="form-group">
                <label>Payment Type *</label>
                <select
                  name="paymentType"
                  value={formData.paymentType}
                  onChange={handleInputChange}
                  required
                >
                  {paymentOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Status *</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  required
                  style={{ borderLeft: `4px solid ${statusColors[formData.status]}` }}
                >
                  <option value="Pending">Pending</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="On Stitching">On Stitching</option>
                  <option value="Stitched">Stitched</option>
                  <option value="Ready">Ready</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="form-group floating-label full-width">
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder=" "
                rows="3"
              />
              <label>Additional Notes</label>
            </div>
          </section>

          {/* Lehenga Details Section */}
          <section id="lehenga" className="form-section">
            <div className="section-header">
              <div className="section-title">
                <div className="title-icon">👗</div>
                <h2>Lehenga Details</h2>
                <span className="section-badge">{lehengas.length} lehengas</span>
              </div>
              <div className="section-actions">
                <button type="button" onClick={addLehenga} className="btn-primary">
                  <span className="btn-icon">+</span>
                  Add Lehenga
                </button>
              </div>
            </div>

            {lehengas.map((lehenga, index) => (
              <div key={index} id={`lehenga-${index}`} className="lehenga-card">
                <div className="lehenga-header">
                  <div className="lehenga-title">
                    <h3>Lehenga #{index + 1}</h3>
                    <div className="lehenga-amount">₹{lehenga.amount || '0'}</div>
                  </div>
                  {lehengas.length > 1 && (
                    <button 
                      type="button" 
                      className="btn-danger" 
                      onClick={() => removeLehenga(index)}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="form-grid">
                  <div className="form-group floating-label">
                    <input
                      type="text"
                      value={lehenga.design}
                      onChange={(e) => handleDesignChange(index, e.target.value)}
                      list="designOptions"
                      required
                      className={errors[`lehenga${index}Design`] ? 'error' : ''}
                      placeholder=" "
                    />
                    <label>Design *</label>
                    <datalist id="designOptions">
                      {stockItems.map((item, i) => (
                        <option key={i} value={item.design} />
                      ))}
                    </datalist>
                    {errors[`lehenga${index}Design`] && (
                      <div className="error-message">{errors[`lehenga${index}Design`]}</div>
                    )}
                  </div>

                  <div className="form-group floating-label">
                    <input
                      type="text"
                      value={lehenga.color}
                      onChange={(e) => handleLehengaChange(index, 'color', e.target.value)}
                      list="colorOptions"
                      required
                      className={errors[`lehenga${index}Color`] ? 'error' : ''}
                      placeholder=" "
                    />
                    <label>Color *</label>
                    <datalist id="colorOptions">
                      {colorOptions.map((color, i) => (
                        <option key={i} value={color} />
                      ))}
                    </datalist>
                    {errors[`lehenga${index}Color`] && (
                      <div className="error-message">{errors[`lehenga${index}Color`]}</div>
                    )}
                  </div>

                  <div className="form-group floating-label">
                    <input
                      type="number"
                      value={lehenga.amount}
                      onChange={(e) => handleLehengaChange(index, 'amount', e.target.value)}
                      required
                      min="0"
                      step="0.01"
                      className={errors[`lehenga${index}Amount`] ? 'error' : ''}
                      placeholder=" "
                    />
                    <label>Amount (₹) *</label>
                    {errors[`lehenga${index}Amount`] && (
                      <div className="error-message">{errors[`lehenga${index}Amount`]}</div>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Stitching Option *</label>
                    <select
                      value={lehenga.stitchingOption}
                      onChange={(e) => handleLehengaChange(index, 'stitchingOption', e.target.value)}
                      required
                    >
                      <option value="Unstitched">Unstitched</option>
                      <option value="Stitched">Stitched</option>
                    </select>
                  </div>

                  {lehenga.stitchingOption === 'Stitched' && (
                    <>
                      <div className="form-group floating-label">
                        <input
                          type="text"
                          value={lehenga.length}
                          onChange={(e) => handleLehengaChange(index, 'length', e.target.value)}
                          placeholder=" "
                        />
                        <label>Length (cm)</label>
                      </div>
                      <div className="form-group floating-label">
                        <input
                          type="text"
                          value={lehenga.waist}
                          onChange={(e) => handleLehengaChange(index, 'waist', e.target.value)}
                          placeholder=" "
                        />
                        <label>Waist (cm)</label>
                      </div>
                      <div className="form-group floating-label">
                        <input
                          type="text"
                          value={lehenga.hip}
                          onChange={(e) => handleLehengaChange(index, 'hip', e.target.value)}
                          placeholder=" "
                        />
                        <label>Hip (cm)</label>
                      </div>
                    </>
                  )}
                </div>

                <div className="form-grid">
                  {/* Updated Blouse Options */}
                  <div className="form-group">
                    <label>Blouse Option</label>
                    <select
                      value={lehenga.blouseOption}
                      onChange={(e) => handleLehengaChange(index, 'blouseOption', e.target.value)}
                    >
                      {blouseOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>

                  {lehenga.blouseOption === 'Specific Date' && (
                    <div className="form-group floating-label">
                      <input
                        type="date"
                        value={lehenga.blouseDate}
                        onChange={(e) => handleLehengaChange(index, 'blouseDate', e.target.value)}
                        placeholder=" "
                      />
                      <label>Blouse Date</label>
                    </div>
                  )}

                  {/* Updated Main Dupatta Options */}
                  <div className="form-group">
                    <label>Main Dupatta</label>
                    <select
                      value={lehenga.mainDupatta}
                      onChange={(e) => handleLehengaChange(index, 'mainDupatta', e.target.value)}
                    >
                      {mainDupattaOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Extra Dupatta</label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input
                        type="radio"
                        value="No"
                        checked={lehenga.extraDupatta === 'No'}
                        onChange={(e) => handleLehengaChange(index, 'extraDupatta', e.target.value)}
                      />
                      <span className="radio-checkmark"></span>
                      No
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        value="Yes"
                        checked={lehenga.extraDupatta === 'Yes'}
                        onChange={(e) => handleLehengaChange(index, 'extraDupatta', e.target.value)}
                      />
                      <span className="radio-checkmark"></span>
                      Yes
                    </label>
                  </div>
                </div>

                {lehenga.extraDupatta === 'Yes' && (
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Extra Dupatta Type</label>
                      <select
                        value={lehenga.extraDupattaType}
                        onChange={(e) => handleLehengaChange(index, 'extraDupattaType', e.target.value)}
                      >
                        <option value="">Select Type</option>
                        {extraDupattaTypeOptions.map(option => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>

                    {(lehenga.extraDupattaType === 'Net' || lehenga.extraDupattaType === 'Velvet Stole') && (
                      <div className="form-group floating-label">
                        <input
                          type="text"
                          value={lehenga.netDupattaColor}
                          onChange={(e) => handleLehengaChange(index, 'netDupattaColor', e.target.value)}
                          list="colorOptions"
                          placeholder=" "
                        />
                        <label>
                          {lehenga.extraDupattaType === 'Net' ? 'Net Dupatta Color' : 'Velvet Stole Color'}
                        </label>
                        <datalist id="colorOptions">
                          {colorOptions.map((color, i) => (
                            <option key={i} value={color} />
                          ))}
                        </datalist>
                      </div>
                    )}

                    {lehenga.extraDupattaType === 'Other' && (
                      <div className="form-group floating-label">
                        <input
                          type="text"
                          value={lehenga.otherDupattaType || ''}
                          onChange={(e) => handleLehengaChange(index, 'otherDupattaType', e.target.value)}
                          placeholder=" "
                        />
                        <label>Other Dupatta Type</label>
                      </div>
                    )}
                  </div>
                )}

                {/* Salesmen Selection */}
                <div className="salesmen-section">
                  <label className="section-label">Salesmen Assignment *</label>
                  <div className="salesmen-search-container">
                    <input
                      type="text"
                      placeholder="Search salesmen by name..."
                      value={salesmenSearchTerms[index] || ''}
                      onChange={(e) => handleSalesmanSearchChange(index, e.target.value)}
                      className="salesmen-search-input"
                    />
                  </div>
                  
                  {salesmen.length > 0 ? (
                    <div className="salesmen-grid">
                      <div className="selected-summary">
                        <span className="selected-count">
                          {lehenga.salesmen?.length || 0} salesmen selected
                        </span>
                        {lehenga.salesmen?.length > 0 && (
                          <span className="selected-names">{lehenga.salesmen.join(', ')}</span>
                        )}
                      </div>
                      <div className="salesmen-list">
                        {getFilteredSalesmen(index).map(salesman => (
                          <div key={salesman.id} className="salesman-card">
                            <input
                              type="checkbox"
                              id={`salesman-${index}-${salesman.id}`}
                              checked={lehenga.salesmen?.includes(salesman.name) || false}
                              onChange={() => handleSalesmanToggle(index, salesman.name)}
                              className="salesman-checkbox"
                            />
                            <label 
                              htmlFor={`salesman-${index}-${salesman.id}`}
                              className="salesman-info"
                            >
                              <div className="salesman-avatar">
                                {salesman.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="salesman-details">
                                <div className="salesman-name">{salesman.name}</div>
                                {salesman.phone && (
                                  <div className="salesman-phone">{salesman.phone}</div>
                                )}
                              </div>
                            </label>
                          </div>
                        ))}
                        {getFilteredSalesmen(index).length === 0 && (
                          <div className="no-results">No salesmen found matching your search</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="no-salesmen">
                      No salesmen available
                    </div>
                  )}
                  {errors[`lehenga${index}Salesmen`] && (
                    <div className="error-message">{errors[`lehenga${index}Salesmen`]}</div>
                  )}
                </div>
              </div>
            ))}
          </section>

          {/* Payment Section */}
          <section id="payment" className="form-section">
            <div className="section-header">
              <div className="section-title">
                <div className="title-icon">💰</div>
                <h2>Payment Details</h2>
              </div>
            </div>

            <div className="payment-cards">
              <div className="payment-card total">
                <div className="payment-icon">💰</div>
                <div className="payment-info">
                  <div className="payment-label">Total Amount</div>
                  <div className="payment-amount">₹{totalAmount.toLocaleString('en-IN')}</div>
                  <div className="payment-detail">{lehengas.length} lehengas</div>
                </div>
              </div>

              <div className="payment-card paid">
                <div className="payment-icon">💳</div>
                <div className="payment-info">
                  <div className="payment-label">Paid Amount</div>
                  <div className="form-group">
                    <input
                      type="number"
                      name="paidAmount"
                      value={formData.paidAmount}
                      onChange={handleInputChange}
                      min="0"
                      max={totalAmount}
                      step="0.01"
                      className={errors.paidAmount ? 'error' : ''}
                      placeholder="0"
                    />
                    {errors.paidAmount && <div className="error-message">{errors.paidAmount}</div>}
                  </div>
                </div>
              </div>

              <div className="payment-card pending">
                <div className="payment-icon">⏰</div>
                <div className="payment-info">
                  <div className="payment-label">Pending Amount</div>
                  <div className={`payment-amount ${pendingAmount > 0 ? 'due' : 'paid'}`}>
                    ₹{pendingAmount.toLocaleString('en-IN')}
                  </div>
                  <div className="payment-status">
                    {pendingAmount > 0 ? 'Payment Due' : 'Fully Paid'}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Order Metadata Section */}
          <section id="metadata" className="form-section">
            <div className="section-header">
              <div className="section-title">
                <div className="title-icon">📊</div>
                <h2>Order Metadata</h2>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Created At</label>
                <input
                  type="text"
                  value={formatTimestamp(orderMetadata.createdAt)}
                  readOnly
                  className="readonly-field"
                />
              </div>

              <div className="form-group">
                <label>Created By</label>
                <input
                  type="text"
                  value={orderMetadata.createdBy}
                  readOnly
                  className="readonly-field"
                />
              </div>

              <div className="form-group">
                <label>Last Updated At</label>
                <input
                  type="text"
                  value={formatTimestamp(orderMetadata.updatedAt)}
                  readOnly
                  className="readonly-field"
                />
              </div>

              <div className="form-group">
                <label>Last Updated By</label>
                <input
                  type="text"
                  value={orderMetadata.updatedBy}
                  readOnly
                  className="readonly-field"
                />
              </div>
            </div>
          </section>

          {/* Form Actions */}
          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={() => onNavigate('dashboard')}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? (
                <>
                  <div className="btn-spinner"></div>
                  Updating Order...
                </>
              ) : (
                <>
                  <span className="btn-icon">✓</span>
                  Update Order
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditOrder;