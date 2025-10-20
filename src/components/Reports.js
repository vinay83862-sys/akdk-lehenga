import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import './Reports.css';

function Reports() {
  const [orders, setOrders] = useState([]);
  const [stockItems, setStockItems] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [reportType, setReportType] = useState('sales');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [salesmanFilter, setSalesmanFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    
    // Load orders
    const ordersRef = ref(db, 'Orders');
    onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const ordersArray = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value
        }));
        setOrders(ordersArray);
      }
      setLoading(false);
    });

    // Load stock items
    const stockRef = ref(db, 'Stock');
    onValue(stockRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const stockArray = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value
        }));
        setStockItems(stockArray);
      }
    });

    // Load salesmen
    const salesmenRef = ref(db, 'salesmen');
    onValue(salesmenRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const salesmenArray = Object.entries(data).map(([key, value]) => ({
          id: key,
          ...value
        }));
        setSalesmen(salesmenArray);
      }
    });
  }, []);

  const generateReport = () => {
    setLoading(true);
    
    let data = [];

    switch (reportType) {
      case 'sales':
        data = generateSalesReport();
        break;
      case 'stock':
        data = generateStockReport();
        break;
      case 'customer':
        data = generateCustomerReport();
        break;
      case 'salesman':
        data = generateSalesmanReport();
        break;
      default:
        data = [];
    }

    setFilteredData(data);
    setLoading(false);
  };

  const generateSalesReport = () => {
    let filteredOrders = [...orders];

    // Date filter
    if (dateFrom && dateTo) {
      filteredOrders = filteredOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        const fromDate = new Date(dateFrom);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        return orderDate >= fromDate && orderDate <= toDate;
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filteredOrders = filteredOrders.filter(order => order.status === statusFilter);
    }

    // Salesman filter
    if (salesmanFilter !== 'all') {
      filteredOrders = filteredOrders.filter(order => 
        order.lehengaDetails?.some(lehenga => 
          lehenga.salesmen?.includes(salesmanFilter)
        )
      );
    }

    return filteredOrders;
  };

  const generateStockReport = () => {
    return stockItems.map(item => ({
      design: item.design,
      amount: item.amount,
      status: item.amount > 5000 ? 'In Stock' : 'Low Stock'
    }));
  };

  const generateCustomerReport = () => {
    const customerMap = new Map();

    orders.forEach(order => {
      if (!customerMap.has(order.customerName)) {
        customerMap.set(order.customerName, {
          customerName: order.customerName,
          phoneNumber: order.phoneNumber,
          totalOrders: 0,
          totalAmount: 0,
          pendingAmount: 0
        });
      }

      const customer = customerMap.get(order.customerName);
      customer.totalOrders += 1;
      customer.totalAmount += (order.totalAmount || 0);
      customer.pendingAmount += (order.pendingAmount || 0);
    });

    return Array.from(customerMap.values());
  };

  const generateSalesmanReport = () => {
    const salesmanMap = new Map();

    orders.forEach(order => {
      order.lehengaDetails?.forEach(lehenga => {
        lehenga.salesmen?.forEach(salesmanName => {
          if (!salesmanMap.has(salesmanName)) {
            salesmanMap.set(salesmanName, {
              salesmanName: salesmanName,
              totalOrders: 0,
              totalAmount: 0,
              totalLehengas: 0
            });
          }

          const salesman = salesmanMap.get(salesmanName);
          salesman.totalOrders += 1;
          salesman.totalAmount += (lehenga.amount || 0);
          salesman.totalLehengas += 1;
        });
      });
    });

    return Array.from(salesmanMap.values());
  };

  const exportToPDF = () => {
    // Simple PDF export using browser print
    window.print();
  };

  const exportToExcel = () => {
    // Simple CSV export
    const headers = getTableHeaders().join(',');
    const csvData = filteredData.map(item => {
      switch (reportType) {
        case 'sales':
          return [
            item.billNumber,
            new Date(item.createdAt).toLocaleDateString(),
            `"${item.customerName}"`,
            `"${item.lehengaDetails?.[0]?.design || 'N/A'}"`,
            item.totalAmount || '0',
            `"${item.lehengaDetails?.[0]?.salesmen?.join(', ') || 'N/A'}"`,
            item.status
          ].join(',');
        case 'stock':
          return [
            `"${item.design}"`,
            item.amount || '0',
            item.status
          ].join(',');
        case 'customer':
          return [
            `"${item.customerName}"`,
            `"${item.phoneNumber}"`,
            item.totalOrders,
            item.totalAmount || '0',
            item.pendingAmount || '0'
          ].join(',');
        case 'salesman':
          return [
            `"${item.salesmanName}"`,
            item.totalOrders,
            item.totalLehengas,
            item.totalAmount || '0'
          ].join(',');
        default:
          return '';
      }
    }).join('\n');

    const csv = `${headers}\n${csvData}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getReportTitle()}_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getReportTitle = () => {
    const titles = {
      sales: 'Sales',
      stock: 'Stock',
      customer: 'Customer',
      salesman: 'Salesman Performance'
    };
    return titles[reportType] || 'Report';
  };

  const getTableHeaders = () => {
    switch (reportType) {
      case 'sales':
        return ['Bill No.', 'Date', 'Customer', 'Design', 'Amount', 'Salesman', 'Status'];
      case 'stock':
        return ['Design No.', 'Amount', 'Status'];
      case 'customer':
        return ['Customer Name', 'Phone', 'Total Orders', 'Total Amount', 'Pending Amount'];
      case 'salesman':
        return ['Salesman Name', 'Total Orders', 'Total Lehengas', 'Total Amount'];
      default:
        return [];
    }
  };

  const renderTable = () => {
    switch (reportType) {
      case 'sales':
        return (
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Bill No.</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Design</th>
                <th>Amount</th>
                <th>Salesman</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map(order => (
                <tr key={order.id}>
                  <td>{order.billNumber}</td>
                  <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td>{order.customerName}</td>
                  <td>
                    {order.lehengaDetails?.[0]?.design || 'N/A'}
                    {order.lehengaDetails?.length > 1 && ` +${order.lehengaDetails.length - 1} more`}
                  </td>
                  <td>₹{order.totalAmount ? order.totalAmount.toLocaleString('en-IN') : '0'}</td>
                  <td>
                    {order.lehengaDetails?.[0]?.salesmen ? order.lehengaDetails[0].salesmen.join(', ') : 'N/A'}
                  </td>
                  <td>
                    <span className={`order-status status-${order.status?.toLowerCase()}`}>
                      {order.status || 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      
      case 'stock':
        return (
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Design No.</th>
                <th>Amount (₹)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item, index) => (
                <tr key={index}>
                  <td>{item.design}</td>
                  <td>₹{item.amount ? item.amount.toLocaleString('en-IN') : '0'}</td>
                  <td>
                    <span className={`badge ${item.amount > 5000 ? 'bg-success' : 'bg-warning'}`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      
      case 'customer':
        return (
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Phone Number</th>
                <th>Total Orders</th>
                <th>Total Amount</th>
                <th>Pending Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((customer, index) => (
                <tr key={index}>
                  <td>{customer.customerName}</td>
                  <td>{customer.phoneNumber}</td>
                  <td>{customer.totalOrders}</td>
                  <td>₹{customer.totalAmount ? customer.totalAmount.toLocaleString('en-IN') : '0'}</td>
                  <td className={customer.pendingAmount > 0 ? 'text-danger fw-bold' : 'text-success'}>
                    ₹{customer.pendingAmount ? customer.pendingAmount.toLocaleString('en-IN') : '0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      
      case 'salesman':
        return (
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Salesman Name</th>
                <th>Total Orders</th>
                <th>Total Lehengas</th>
                <th>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((salesman, index) => (
                <tr key={index}>
                  <td>{salesman.salesmanName}</td>
                  <td>{salesman.totalOrders}</td>
                  <td>{salesman.totalLehengas}</td>
                  <td className="fw-bold text-primary">
                    ₹{salesman.totalAmount ? salesman.totalAmount.toLocaleString('en-IN') : '0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h1>📊 Sales Reports & Analytics</h1>
        <p>Generate detailed reports and analytics for your business</p>
      </div>

      <div className="card">
        <div className="card-header bg-primary text-white">
          <i className="fas fa-filter me-2"></i>
          Report Filters
        </div>
        <div className="card-body">
          <div className="row mb-3">
            <div className="col-md-3">
              <label htmlFor="reportType" className="form-label">Report Type *</label>
              <select 
                className="form-select" 
                id="reportType"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
              >
                <option value="sales">📈 Sales Report</option>
                <option value="stock">📦 Stock Report</option>
                <option value="customer">👥 Customer Report</option>
                <option value="salesman">👨‍💼 Salesman Performance</option>
              </select>
            </div>
            
            <div className="col-md-2">
              <label htmlFor="dateFrom" className="form-label">From Date</label>
              <input 
                type="date" 
                className="form-control" 
                id="dateFrom"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            
            <div className="col-md-2">
              <label htmlFor="dateTo" className="form-label">To Date</label>
              <input 
                type="date" 
                className="form-control" 
                id="dateTo"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            {(reportType === 'sales') && (
              <>
                <div className="col-md-2">
                  <label htmlFor="statusFilter" className="form-label">Status</label>
                  <select 
                    className="form-select" 
                    id="statusFilter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Status</option>
                    <option value="Pending">Pending</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Stitched">Stitched</option>
                    <option value="Ready">Ready</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="col-md-3">
                  <label htmlFor="salesmanFilter" className="form-label">Salesman</label>
                  <select 
                    className="form-select" 
                    id="salesmanFilter"
                    value={salesmanFilter}
                    onChange={(e) => setSalesmanFilter(e.target.value)}
                  >
                    <option value="all">All Salesmen</option>
                    {salesmen.map(salesman => (
                      <option key={salesman.id} value={salesman.name}>
                        {salesman.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="row">
            <div className="col-12">
              <button 
                className="btn btn-primary me-2" 
                onClick={generateReport}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Generating...
                  </>
                ) : (
                  <>
                    <i className="fas fa-chart-bar me-2"></i>
                    Generate Report
                  </>
                )}
              </button>
              
              {filteredData.length > 0 && (
                <>
                  <button className="btn btn-outline-danger me-2" onClick={exportToPDF}>
                    <i className="fas fa-file-pdf me-2"></i>
                    Export PDF
                  </button>
                  <button className="btn btn-outline-success" onClick={exportToExcel}>
                    <i className="fas fa-file-excel me-2"></i>
                    Export Excel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {filteredData.length > 0 && (
        <div className="row mt-4">
          <div className="col-md-12">
            <div className="card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <span>
                  <i className="fas fa-table me-2"></i>
                  {getReportTitle()} Report 
                  <span className="badge bg-secondary ms-2">{filteredData.length} records</span>
                </span>
                <div className="text-muted small">
                  Generated on {new Date().toLocaleString()}
                </div>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  {renderTable()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && filteredData.length === 0 && (
        <div className="text-center mt-5">
          <i className="fas fa-chart-bar fa-4x text-muted mb-3"></i>
          <h4 className="text-muted">No Report Data</h4>
          <p className="text-muted">Select filters and generate a report to see data here.</p>
        </div>
      )}
    </div>
  );
}

export default Reports;