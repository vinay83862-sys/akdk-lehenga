import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../firebase';
import PropTypes from 'prop-types';
import './PrintOrder.css';

// Helper functions outside component for better performance
const generateAmountCode = (amount) => {
  const codeMapping = {'0':'S','1':'P','2':'I','3':'N','4':'K','5':'R','6':'E','7':'D','8':'J','9':'A'};
  const formattedAmount = String(Math.round(amount)).padStart(5, '0');
  let code = '';
  for (let digit of formattedAmount) code += codeMapping[digit] || 'S';
  const sCount = (code.match(/^S+/) || [''])[0].length;
  if (sCount >= 5) code = code.substring(5);
  return code || 'S';
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  if (typeof dateString === 'string' && dateString.includes('/')) return dateString;
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateString;
  }
};

const formatPhoneNumber = (phone) => {
  if (!phone) return 'N/A';
  let phoneStr = String(phone);
  if (phoneStr.includes('e+')) phoneStr = phone.toFixed(0);
  phoneStr = phoneStr.replace(/[^0-9+]/g, '');
  if (phoneStr.length === 10 && !phoneStr.startsWith('+')) phoneStr = '+91 ' + phoneStr;
  return phoneStr;
};

const amountInWords = (amount) => {
  if (!amount || amount === 0) return 'Zero Rupees Only';
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const teens = ['Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const conv = (n) => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) {
      const t = Math.floor(n / 10), o = n % 10;
      return tens[t] + (o > 0 ? ' ' + ones[o] : '');
    }
    const h = Math.floor(n / 100), r = n % 100;
    return ones[h] + ' Hundred' + (r > 0 ? ' ' + conv(r) : '');
  };
  const num = Math.floor(amount);
  if (num === 0) return 'Zero Rupees Only';
  let result = '';
  const cr = Math.floor(num / 10000000), la = Math.floor((num % 10000000) / 100000);
  const th = Math.floor((num % 100000) / 1000), rm = num % 1000;
  if (cr > 0) result += conv(cr) + ' Crore ';
  if (la > 0) result += conv(la) + ' Lakh ';
  if (th > 0) result += conv(th) + ' Thousand ';
  if (rm > 0) result += conv(rm);
  return result.trim() + ' Rupees Only';
};

const generateQRCode = (data) => {
  const qrData = encodeURIComponent(data);
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;
};

// Alternative backup with better error handling
const generateQRCodeWithFallback = (data, attempt = 0) => {
  const qrData = encodeURIComponent(data);
  const primaryUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`;
  const backupUrl = `https://quickchart.io/qr?text=${qrData}&size=150`;
  
  return attempt === 0 ? primaryUrl : backupUrl;
};

// Error Boundary Component
class PrintOrderErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('PrintOrder Error:', error, errorInfo);
    this.setState({ errorInfo });
    // You can add error reporting service here like:
    // logErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="print-order-modal">
          <div className="print-modal-content">
            <div className="print-modal-header">
              <h2>❌ Error</h2>
              <button className="close-btn" onClick={this.props.onClose}>×</button>
            </div>
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
              <h3 style={{ color: 'var(--color-error)', marginBottom: '16px' }}>
                Something went wrong
              </h3>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
                We couldn't load the print dialog. Please try again.
              </p>
              <details style={{ textAlign: 'left', marginBottom: '20px', color: 'var(--color-text-secondary)' }}>
                <summary>Error Details</summary>
                <pre style={{ fontSize: '10px', background: 'var(--color-surface)', padding: '10px', borderRadius: '5px', overflow: 'auto' }}>
                  {this.state.error && this.state.error.toString()}
                </pre>
              </details>
              <button 
                className="btn btn--primary"
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function PrintOrder({ orderId, onClose }) {
  const [order, setOrder] = useState(null);
  const [printType, setPrintType] = useState('customerReceipt');
  const [selectedLehengaIndex, setSelectedLehengaIndex] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [qrCodeAttempts, setQrCodeAttempts] = useState({});

  // Memoized formatted order data
  const formattedOrder = useMemo(() => {
    if (!order) return null;
    
    return {
      ...order,
      formattedTotal: order.totalAmount ? parseFloat(order.totalAmount).toLocaleString('en-IN') : '0',
      formattedPaid: order.paidAmount ? parseFloat(order.paidAmount).toLocaleString('en-IN') : '0',
      pendingAmount: order.pendingAmount ? parseFloat(order.pendingAmount) : 0,
      formattedPending: order.pendingAmount ? parseFloat(order.pendingAmount).toLocaleString('en-IN') : '0',
      lehengaCount: order.lehengaDetails?.length || 0
    };
  }, [order]);

  // Memoized salesmen names getter
  const getSalesmenNames = useCallback((lehenga) => {
    if (!lehenga || !lehenga.salesmen) return 'N/A';
    const salesmen = lehenga.salesmen;
    if (Array.isArray(salesmen)) return salesmen.filter(n => n).join(', ') || 'N/A';
    if (typeof salesmen === 'object') {
      const names = [];
      if (salesmen.e) names.push(salesmen.e);
      if (salesmen.i) names.push(salesmen.i);
      Object.keys(salesmen).forEach(key => {
        if (key !== 'e' && key !== 'i' && salesmen[key]) names.push(salesmen[key]);
      });
      return names.filter(n => n).join(', ') || 'N/A';
    }
    return 'N/A';
  }, []);

  // Improved Firebase data fetching with better error handling and cleanup
  useEffect(() => {
    if (!orderId) {
      setError('No order ID provided');
      return;
    }

    setLoading(true);
    setError(null);
    
    const orderRef = ref(db, `Orders/${orderId}`);
    
    const handleData = (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setOrder({ id: orderId, ...data });
        setError(null);
      } else {
        setError(`Order #${orderId} not found`);
      }
      setLoading(false);
    };

    const handleError = (error) => {
      console.error('Firebase error:', error);
      setError('Failed to load order data. Please check your connection.');
      setLoading(false);
    };

    try {
      onValue(orderRef, handleData, handleError);
    } catch (err) {
      handleError(err);
    }

    // Improved cleanup function
    return () => {
      try {
        off(orderRef, 'value', handleData);
      } catch (err) {
        console.log('Firebase listener cleanup completed');
      }
    };
  }, [orderId]);

  // QR Code error handler
  const handleQrCodeError = useCallback((url, type) => {
    const key = `${type}-${url}`;
    setQrCodeAttempts(prev => ({
      ...prev,
      [key]: (prev[key] || 0) + 1
    }));
  }, []);

  // Print content generators with improved error handling
  const generateSmallReceiptHTML = useCallback(() => {
    if (!formattedOrder) return '';
    
    const pendingAmount = formattedOrder.pendingAmount;
    const qrData = `https://manager-e49ba.web.app/track.html?order=${formattedOrder.billNumber}`;
    const qrAttemptKey = `small-${qrData}`;
    const qrCodeUrl = generateQRCodeWithFallback(qrData, qrCodeAttempts[qrAttemptKey] || 0);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt-${formattedOrder.billNumber}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;background:#fff;padding:0;margin:0}
    .small-receipt{width:10cm;height:15cm;padding:8px;font-size:12px;line-height:1.2;background:#fff;margin:0 auto;border:1px solid #000;overflow:hidden}
    .receipt-header{text-align:center;margin-bottom:8px;padding-bottom:4px;border-bottom:2px solid #4a154b}
    .shop-name{font-weight:700;font-size:16px;color:#4a154b;margin-bottom:2px}
    .receipt-title{font-weight:600;font-size:14px;margin-bottom:2px}
    .shop-contact{font-size:10px;font-weight:600;margin-bottom:2px}
    .customer-info{margin-bottom:8px;padding:6px;background:#f8f9fa;border-radius:4px;border-left:3px solid #4a154b}
    .info-row{display:flex;justify-content:space-between;margin-bottom:3px;font-size:11px}
    .label{font-weight:600;color:#495057}
    .value{font-weight:500;color:#000;text-align:right}
    .lehenga-details{margin-bottom:8px;max-height:7cm;overflow-y:auto}
    .lehenga-item{padding:4px;margin-bottom:4px;background:#fff;border:1px solid #ddd;border-radius:3px;font-size:10px;page-break-inside:avoid}
    .lehenga-header{font-weight:700;color:#4a154b;margin-bottom:2px;padding-bottom:2px;border-bottom:1px dashed #ccc;font-size:11px;display:flex;justify-content:space-between}
    .salesmen-badge{display:inline-block;background:#8b5cf6;color:#fff;padding:1px 4px;border-radius:3px;font-size:8px;font-weight:600}
    .lehenga-row{display:flex;justify-content:space-between;margin-bottom:2px}
    .lehenga-label{font-weight:600;color:#495057}
    .lehenga-value{font-weight:500;color:#000;text-align:right}
    .measurement-section{background:#e3f2fd;padding:3px;border-radius:2px;margin:2px 0;border-left:2px solid #2196f3}
    .payment-summary{margin-bottom:8px;padding:6px;background:#e8f5e8;border-radius:4px;border:1px solid #28a745}
    .payment-row{display:flex;justify-content:space-between;margin-bottom:3px;font-weight:600;font-size:11px}
    .total-row{border-top:1px solid #28a745;padding-top:2px;margin-top:2px;font-size:12px;color:#155724}
    .notes-section{margin-bottom:6px;padding:4px;background:#fff3cd;border-radius:3px;border:1px solid #ffc107;font-size:10px}
    .no-return{text-align:center;font-weight:700;font-size:11px;color:#dc3545;margin:4px 0;padding:3px;background:#f8d7da;border:1px solid #dc3545;border-radius:3px}
    .qr-section{text-align:center;margin:4px 0;padding:2px}
    .qr-section img{max-width:60px;height:60px}
    .tracking-info{text-align:center;font-size:8px;color:#666;margin-top:2px;background:#f8f9fa;padding:3px;border-radius:2px}
    .receipt-footer{text-align:center;padding-top:4px;border-top:1px solid #000;font-size:9px}
    .signature{margin-top:6px;display:flex;justify-content:space-between}
    .signature-box{width:45%;border-top:1px solid #000;padding-top:2px;text-align:center;font-size:8px}
    .terms-compact{margin-top:3px;font-size:7px;color:#666;text-align:center;border-top:1px dashed #ddd;padding-top:2px}
    @media print{body{margin:0;padding:0}.small-receipt{border:none;margin:0;height:15cm}@page{size:10cm 15cm;margin:0.2cm}}
  </style>
</head>
<body>
  <div class="small-receipt">
    <div class="receipt-header">
      <div class="shop-name">AKDK JAIN</div>
      <div class="receipt-title">CUSTOMER ESTIMATE</div>
      <div class="shop-contact">📱 8700208934, 9870589648</div>
    </div>
    <div class="customer-info">
      <div class="info-row"><span class="label">Bill No:</span><span class="value">${formattedOrder.billNumber}</span></div>
      <div class="info-row"><span class="label">Customer:</span><span class="value">${formattedOrder.customerName}</span></div>
      <div class="info-row"><span class="label">Phone:</span><span class="value">${formatPhoneNumber(formattedOrder.phoneNumber)}</span></div>
      <div class="info-row"><span class="label">Order Date:</span><span class="value">${formatDate(formattedOrder.createdAt)}</span></div>
      <div class="info-row"><span class="label">Delivery:</span><span class="value">${formatDate(formattedOrder.deliveryDate)}</span></div>
    </div>
    <div class="lehenga-details">
      ${formattedOrder.lehengaDetails && formattedOrder.lehengaDetails.length > 0 ? formattedOrder.lehengaDetails.slice(0, 3).map((lehenga, index) => {
        const isUnstitched = lehenga.stitchingOption === 'Unstitched' || (!lehenga.length && !lehenga.waist && !lehenga.hip);
        const mainDupatta = lehenga.mainDupatta || 'N/A';
        const extraDupatta = lehenga.extraDupatta || 'No';
        return `<div class="lehenga-item">
          <div class="lehenga-header">
            <span>Lehenga ${index + 1}</span>
            <span class="salesmen-badge">${getSalesmenNames(lehenga)}</span>
          </div>
          <div class="lehenga-row"><span class="lehenga-label">Design:</span><span class="lehenga-value">${lehenga.design || 'N/A'}</span></div>
          <div class="lehenga-row"><span class="lehenga-label">Color:</span><span class="lehenga-value">${lehenga.color || 'N/A'}</span></div>
          <div class="lehenga-row"><span class="lehenga-label">Blouse:</span><span class="lehenga-value">${lehenga.blouseOption || 'N/A'}</span></div>
          <div class="lehenga-row"><span class="lehenga-label">Main Dupatta:</span><span class="lehenga-value">${mainDupatta}</span></div>
          <div class="lehenga-row"><span class="lehenga-label">Extra Dupatta:</span><span class="lehenga-value">${extraDupatta}</span></div>
          ${!isUnstitched ? `
            <div class="measurement-section">
              <div class="lehenga-row"><span class="lehenga-label">Length:</span><span class="lehenga-value">${lehenga.length || 'Free'}</span></div>
              <div class="lehenga-row"><span class="lehenga-label">Waist:</span><span class="lehenga-value">${lehenga.waist || 'Free'}</span></div>
              <div class="lehenga-row"><span class="lehenga-label">Hip:</span><span class="lehenga-value">${lehenga.hip || 'Free'}</span></div>
            </div>
          ` : '<div style="text-align:center;font-size:9px;color:#666;background:#fff3cd;padding:2px;border-radius:2px">🧵 UNSTITCHED</div>'}
          <div class="lehenga-row" style="margin-top:2px"><span class="lehenga-label">Amount:</span><span class="lehenga-value" style="font-weight:700;color:#4a154b">₹${lehenga.amount ? parseFloat(lehenga.amount).toLocaleString('en-IN') : '0'}</span></div>
        </div>`;
      }).join('') : '<div style="text-align:center;padding:8px;font-size:10px;color:#666">No items</div>'}
      ${formattedOrder.lehengaDetails && formattedOrder.lehengaDetails.length > 3 ? `<div style="text-align:center;font-size:9px;color:#666;margin-top:3px;background:#f8f9fa;padding:3px;border-radius:2px">+${formattedOrder.lehengaDetails.length - 3} more items</div>` : ''}
    </div>
    <div class="payment-summary">
      <div class="payment-row"><span>Total Amount:</span><span>₹${formattedOrder.formattedTotal}</span></div>
      <div class="payment-row"><span>Paid Amount:</span><span>₹${formattedOrder.formattedPaid}</span></div>
      ${pendingAmount > 0 ? `<div class="payment-row total-row"><span>Pending Amount:</span><span style="color:#dc3545">₹${pendingAmount.toLocaleString('en-IN')}</span></div>` : ''}
    </div>
    ${formattedOrder.notes ? `<div class="notes-section"><strong>Notes:</strong> ${formattedOrder.notes.substring(0, 80)}${formattedOrder.notes.length > 80 ? '...' : ''}</div>` : ''}
    <div class="no-return">🚫 NO EXCHANGE / NO RETURN</div>
    <div class="qr-section">
      <img src="${qrCodeUrl}" alt="QR Code" onerror="this.onerror=null; this.src='${generateQRCodeWithFallback(qrData, 1)}'">
      <div class="tracking-info">
        <div style="font-weight:600;margin-bottom:1px">Scan to Track Your Order</div>
        <div>Track your order status online</div>
      </div>
    </div>
    <div class="receipt-footer">
      <div style="font-weight:600;margin-bottom:2px;font-size:10px">Thank you for your business!</div>
      <div class="signature">
        <div class="signature-box">Customer Signature</div>
        <div class="signature-box">Authorized Signature</div>
      </div>
      <div class="terms-compact">
        <p style="margin:1px">• No exchange/return • Payment on delivery</p>
        <p style="margin:1px">• Measurements once confirmed cannot be changed</p>
      </div>
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        setTimeout(function() {
          window.close();
        }, 1000);
      }, 500);
    };
  </script>
</body>
</html>`;
  }, [formattedOrder, getSalesmenNames, qrCodeAttempts]);

  const generateReceiptHTML = useCallback(() => {
    if (!formattedOrder) return '';
    
    const pendingAmount = formattedOrder.pendingAmount;
    const qrData = `https://manager-e49ba.web.app/track.html?order=${formattedOrder.billNumber}`;
    const qrAttemptKey = `receipt-${qrData}`;
    const qrCodeUrl = generateQRCodeWithFallback(qrData, qrCodeAttempts[qrAttemptKey] || 0);

    const lehengaTableRows = formattedOrder.lehengaDetails && formattedOrder.lehengaDetails.length > 0
      ? formattedOrder.lehengaDetails.map((lehenga, index) => {
          const isUnstitched = lehenga.stitchingOption === 'Unstitched' || (!lehenga.length && !lehenga.waist && !lehenga.hip);
          const mainDupatta = lehenga.mainDupatta || 'N/A';
          const extraDupatta = lehenga.extraDupatta || 'No';
          return `<tr>
            <td style="border:1px solid #ddd;padding:4px;text-align:center;font-weight:600;font-size:9px">${index + 1}</td>
            <td style="border:1px solid #ddd;padding:4px;font-size:9px">${lehenga.design ? lehenga.design.substring(0, 20) + (lehenga.design.length > 20 ? '...' : '') : 'N/A'}</td>
            <td style="border:1px solid #ddd;padding:4px;font-size:9px">${lehenga.color ? lehenga.color.substring(0, 15) + (lehenga.color.length > 15 ? '...' : '') : 'N/A'}</td>
            <td style="border:1px solid #ddd;padding:4px;font-size:9px">${lehenga.blouseOption ? lehenga.blouseOption.substring(0, 12) + (lehenga.blouseOption.length > 12 ? '...' : '') : 'N/A'}</td>
            <td style="border:1px solid #ddd;padding:4px;font-size:9px">${mainDupatta.substring(0, 12) + (mainDupatta.length > 12 ? '...' : '')}</td>
            <td style="border:1px solid #ddd;padding:4px;font-size:9px">${extraDupatta.substring(0, 8)}</td>
            <td style="border:1px solid #ddd;padding:4px;text-align:center;font-size:9px">${isUnstitched ? 'Unstitched' : (lehenga.length || 'Free')}</td>
            <td style="border:1px solid #ddd;padding:4px;text-align:center;font-size:9px">${isUnstitched ? '' : (lehenga.waist || 'Free')}</td>
            <td style="border:1px solid #ddd;padding:4px;background:#f3e8ff;font-weight:600;color:#6b21a8;font-size:8px;text-align:center">${getSalesmenNames(lehenga).substring(0, 15) + (getSalesmenNames(lehenga).length > 15 ? '...' : '')}</td>
            <td style="border:1px solid #ddd;padding:4px;text-align:right;font-weight:700;font-size:9px">₹${lehenga.amount ? parseFloat(lehenga.amount).toLocaleString('en-IN') : '0'}</td>
          </tr>`;
        }).join('')
      : '<tr><td colspan="10" style="border:1px solid #ddd;padding:6px;text-align:center;font-size:10px">No lehenga details</td></tr>';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt-${formattedOrder.billNumber}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;margin:0;padding:8px;color:#000;line-height:1.3;background:#fff;font-size:12px}
    .receipt{max-width:700px;margin:0 auto;background:#fff;border:1px solid #ddd;padding:12px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;padding-bottom:8px;border-bottom:2px solid #4a154b}
    .logo-section{text-align:center;margin-bottom:6px}
    .company-logo{max-width:120px;height:auto;margin-bottom:3px}
    .shop-info h1{margin:0 0 4px 0;font-size:18px;color:#4a154b;font-weight:700}
    .shop-info p{margin:2px 0;font-size:10px}
    .invoice-info{text-align:right}
    .invoice-info h2{margin:0 0 6px 0;font-size:16px;color:#000;font-weight:700}
    .invoice-info p{margin:2px 0;font-size:10px}
    .customer-info{margin-bottom:8px;padding:8px;background:#f8f9fa;border-radius:4px;border-left:3px solid #4a154b;font-size:11px}
    .customer-info h3{margin:0 0 6px 0;color:#4a154b;font-size:13px}
    .customer-info p{margin:3px 0;font-size:11px}
    .lehenga-details{margin-bottom:8px}
    .lehenga-details h3{margin:0 0 6px 0;color:#fff;font-size:13px;text-align:center;background:#4a154b;padding:6px;border-radius:3px}
    .items-table{width:100%;border-collapse:collapse;font-size:9px;margin-bottom:6px;box-shadow:0 1px 2px rgba(0,0,0,0.1);table-layout:fixed}
    .items-table th{background:#4a154b;color:#fff;padding:6px 4px;text-align:center;font-weight:600;border:1px solid #ddd;font-size:9px}
    .items-table td{word-wrap:break-word;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .items-table tr:nth-child(even){background:#f8f9fa}
    .payment-details{margin-bottom:8px;padding:10px;background:#e8f5e8;border-radius:4px;border:1px solid #28a745}
    .payment-details h3{margin:0 0 6px 0;color:#155724;font-size:13px}
    .payment-item{display:flex;justify-content:space-between;padding:6px;background:#fff;border-radius:3px;font-weight:600;margin-bottom:3px;font-size:11px}
    .payment-item.total{background:#155724;color:#fff;font-size:12px}
    .amount-words{margin-top:6px;padding:6px;background:#fff3cd;border-left:3px solid #ffc107;border-radius:2px;font-size:10px}
    .amount-words p{margin:0;font-weight:600;color:#856404}
    .notes-section{margin-bottom:8px;padding:8px;background:#fff3cd;border-radius:4px;border:1px solid #ffc107;font-size:10px}
    .notes-section h3{margin:0 0 6px 0;color:#856404;font-size:12px}
    .notes-section p{margin:0;color:#664d03}
    
    .tracking-section{margin:8px 0;padding:8px;background:#e3f2fd;border-radius:4px;border:1px solid #2196f3}
    .tracking-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
    .tracking-header h3{margin:0;color:#1565c0;font-size:12px}
    .current-status{background:#1565c0;color:#fff;padding:2px 6px;border-radius:10px;font-size:9px;font-weight:600}
    .tracking-steps-compact{display:flex;justify-content:space-between;font-size:8px;text-align:center}
    .tracking-step-compact{flex:1;padding:2px}
    .step-icon-compact{font-size:12px;margin-bottom:1px}
    .step-label-compact{font-weight:600;color:#333;line-height:1.1}
    .step-active{color:#4a154b;font-weight:700}
    
    .no-return-policy{text-align:center;font-weight:700;font-size:11px;color:#dc3545;margin:8px 0;padding:6px;background:#f8d7da;border:1px solid #dc3545;border-radius:4px}
    .terms-section{margin:8px 0;padding:8px;background:#f8f9fa;border-radius:4px;font-size:9px;text-align:left}
    .terms-section h4{margin:0 0 6px 0;font-weight:700;color:#4a154b;text-align:center;font-size:10px}
    .terms-section ul{margin:0;padding-left:12px;line-height:1.3}
    .terms-section li{margin-bottom:2px}
    
    .qr-section-compact{display:flex;align-items:center;justify-content:space-between;margin:8px 0;padding:8px;background:#f8f9fa;border-radius:4px;border:1px solid #ddd}
    .qr-info{flex:1;padding-right:8px}
    .qr-info h4{margin:0 0 4px 0;font-size:11px;color:#4a154b}
    .qr-info p{margin:2px 0;font-size:9px;color:#666}
    .qr-code-compact img{max-width:70px;height:70px}
    
    .receipt-footer{text-align:center;padding-top:8px;border-top:1px solid #000;font-size:10px}
    .receipt-footer p{margin:3px 0}
    .signature-section{display:flex;justify-content:space-between;margin-top:12px;gap:8px}
    .customer-sign,.company-sign{width:48%;border-top:1px solid #000;padding-top:4px;text-align:center;font-size:10px}
    .customer-sign p,.company-sign p{margin:2px 0;font-weight:600}
    
    @media print{
      body{margin:0;padding:5px;print-color-adjust:exact;-webkit-print-color-adjust:exact;font-size:10px}
      @page{margin:0.3cm;size:A4}
      .receipt{max-width:100%;padding:8px;border:none}
      .customer-info,.payment-details,.lehenga-item{page-break-inside:avoid}
      .items-table{font-size:8px}
      .items-table th,.items-table td{padding:3px 2px}
      .tracking-step-compact{font-size:7px}
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="logo-section">
      <img src="https://firebasestorage.googleapis.com/v0/b/manager-e49ba.firebasestorage.app/o/Untitled-1.png?alt=media"           alt="AKDK Jain Logo" class="company-logo" onerror="this.style.display='none'">
    </div>

    <div class="header">
      <div class="shop-info">
        <h1>AKDK JAIN</h1>
        <p>📍 988/5, Kucha Natwa, Near town, Chandni Chowk, Delhi - 110006</p>
        <p>📱 MOB: +91 8700208934, 9870589648</p>
        <p>📧 Email: akdkjain@gmail.com</p>
      </div>
      <div class="invoice-info">
        <h2>ESTIMATE</h2>
        <p><strong>DATE:</strong> ${formatDate(formattedOrder.createdAt)}</p>
        <p><strong>ORDER NO.:</strong> #${formattedOrder.billNumber}</p>
        <p><strong>DELIVERY DATE:</strong> ${formatDate(formattedOrder.deliveryDate)}</p>
      </div>
    </div>

    <div class="customer-info">
      <h3>👤 CUSTOMER DETAILS:</h3>
      <p><strong>Name:</strong> ${formattedOrder.customerName}</p>
      <p><strong>Phone:</strong> ${formatPhoneNumber(formattedOrder.phoneNumber)}</p>
      <p><strong>Payment Type:</strong> ${formattedOrder.paymentType || 'N/A'}</p>
    </div>

    ${formattedOrder.lehengaDetails && formattedOrder.lehengaDetails.length > 0 ? `
      <div class="lehenga-details">
        <h3>👗 LEHENGA DETAILS (${formattedOrder.lehengaDetails.length} Items)</h3>
        <table class="items-table">
          <thead>
            <tr>
              <th style="width:25px">No</th>
              <th style="width:80px">Design</th>
              <th style="width:60px">Color</th>
              <th style="width:50px">Blouse</th>
              <th style="width:50px">Main Dupatta</th>
              <th style="width:40px">Extra Dupatta</th>
              <th style="width:40px">Length</th>
              <th style="width:40px">Waist</th>
              <th style="width:60px">Salesmen</th>
              <th style="width:45px">Amount</th>
            </tr>
          </thead>
          <tbody>${lehengaTableRows}</tbody>
        </table>
      </div>
    ` : ''}

    <div class="payment-details">
      <h3>💰 PAYMENT SUMMARY</h3>
      <div class="payment-item">
        <span>Total Amount:</span>
        <span>₹${formattedOrder.formattedTotal}</span>
      </div>
      <div class="payment-item">
        <span>Paid Amount:</span>
        <span>₹${formattedOrder.formattedPaid}</span>
      </div>
      ${pendingAmount > 0 ? `
        <div class="payment-item">
          <span>Pending Amount:</span>
          <span style="color:#dc3545">₹${pendingAmount.toLocaleString('en-IN')}</span>
        </div>
      ` : ''}
      
      <div class="payment-item total">
        <span>Payment Type:</span>
        <span>${formattedOrder.paymentType || 'N/A'}</span>
      </div>

      <div class="amount-words">
        <p>💬 AMOUNT IN WORDS: <strong>${amountInWords(formattedOrder.totalAmount)}</strong></p>
      </div>
    </div>

    <div class="tracking-section">
      <div class="tracking-header">
        <h3>📦 ORDER TRACKING</h3>
        <div class="current-status">${formattedOrder.status || 'Pending'}</div>
      </div>
      <div class="tracking-steps-compact">
        <div class="tracking-step-compact">
          <div class="step-icon-compact">📝</div>
          <div class="step-label-compact ${formattedOrder.status === 'Pending' ? 'step-active' : ''}">Order Placed</div>
        </div>
        <div class="tracking-step-compact">
          <div class="step-icon-compact">✅</div>
          <div class="step-label-compact ${formattedOrder.status === 'Confirmed' ? 'step-active' : ''}">Confirmed</div>
        </div>
        <div class="tracking-step-compact">
          <div class="step-icon-compact">🧵</div>
          <div class="step-label-compact ${formattedOrder.status === 'On Stitching' ? 'step-active' : ''}">Stitching</div>
        </div>
        <div class="tracking-step-compact">
          <div class="step-icon-compact">🎀</div>
          <div class="step-label-compact ${formattedOrder.status === 'Stitched' ? 'step-active' : ''}">Stitched</div>
        </div>
        <div class="tracking-step-compact">
          <div class="step-icon-compact">📦</div>
          <div class="step-label-compact ${formattedOrder.status === 'Ready' ? 'step-active' : ''}">Ready</div>
        </div>
        <div class="tracking-step-compact">
          <div class="step-icon-compact">🚚</div>
          <div class="step-label-compact ${formattedOrder.status === 'Delivered' ? 'step-active' : ''}">Delivered</div>
        </div>
      </div>
    </div>

    ${formattedOrder.notes ? `
      <div class="notes-section">
        <h3>📝 SPECIAL INSTRUCTIONS:</h3>
        <p>${formattedOrder.notes.substring(0, 150)}${formattedOrder.notes.length > 150 ? '...' : ''}</p>
      </div>
    ` : ''}

    <div class="no-return-policy">
      ⚠️ GOODS ONCE SOLD WILL NOT BE TAKEN BACK OR EXCHANGED ⚠️
    </div>

    <div class="terms-section">
      <h4>📋 TERMS & CONDITIONS</h4>
      <ul>
        <li><strong>No Exchange or Return:</strong> Once delivered, items cannot be exchanged or returned</li>
        <li><strong>Payment Terms:</strong> Full payment required on or before delivery date</li>
        <li><strong>Measurements:</strong> Once measurements are confirmed, they cannot be altered</li>
        <li><strong>Delivery Date:</strong> Subject to change based on customization requirements</li>
      </ul>
    </div>

    <div class="qr-section-compact">
      <div class="qr-info">
        <h4>Track Your Order Online</h4>
        <p>Scan the QR code to track real-time order status and updates on your mobile device</p>
        <p style="font-weight:600;color:#4a154b;margin-top:4px">Order #${formattedOrder.billNumber}</p>
      </div>
      <div class="qr-code-compact">
        <img src="${qrCodeUrl}" alt="QR Code" onerror="this.onerror=null; this.src='${generateQRCodeWithFallback(qrData, 1)}'">
      </div>
    </div>

    <div class="receipt-footer">
      <p><strong>Thank you for your business! We appreciate your trust in AKDK Jain.</strong></p>
      <p>For any queries, contact: +91 8700208934 / 9870589648 | Email: akdkjain@gmail.com</p>
      <div class="signature-section">
        <div class="customer-sign">
          <p>CUSTOMER SIGNATURE</p>
          <p style="font-size:8px;margin-top:4px">Name: ${formattedOrder.customerName}</p>
          <p style="font-size:8px">Date: ${formatDate(formattedOrder.createdAt)}</p>
        </div>
        <div class="company-sign">
          <p>FOR AKDK JAIN</p>
          <p style="font-size:8px;margin-top:4px">Authorized Signatory</p>
          <p style="font-size:8px">Date: ${formatDate(formattedOrder.createdAt)}</p>
        </div>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        setTimeout(function() {
          window.close();
        }, 1000);
      }, 500);
    };
  </script>
</body>
</html>`;
  }, [formattedOrder, getSalesmenNames, qrCodeAttempts]);

  const generateStickerHTML = useCallback(() => {
    if (!formattedOrder || !formattedOrder.lehengaDetails) return '';

    const stickersToGenerate = selectedLehengaIndex === 'all' 
      ? formattedOrder.lehengaDetails 
      : [formattedOrder.lehengaDetails[parseInt(selectedLehengaIndex)]];

    const stickersHTML = stickersToGenerate.map((lehenga, index) => {
      const actualIndex = selectedLehengaIndex === 'all' ? index : parseInt(selectedLehengaIndex);
      const amountCode = generateAmountCode(lehenga.amount || 0);
      const isUnstitched = lehenga.stitchingOption === 'Unstitched' || (!lehenga.length && !lehenga.waist && !lehenga.hip);
      const salesmenNames = getSalesmenNames(lehenga);
      const qrData = `https://manager-e49ba.web.app/track.html?order=${formattedOrder.billNumber}`;
      const qrAttemptKey = `sticker-${qrData}-${actualIndex}`;
      const qrCodeUrl = generateQRCodeWithFallback(qrData, qrCodeAttempts[qrAttemptKey] || 0);
      const mainDupatta = lehenga.mainDupatta || 'N/A';
      const extraDupatta = lehenga.extraDupatta || 'No';

      return `
        <div class="sticker-page">
          <div class="sticker-container">
            <div class="sticker-header">
              <div class="bill-number">Bill #${formattedOrder.billNumber}</div>
              <div class="qr-code">
                <img src="${qrCodeUrl}" alt="QR" style="width:45px;height:45px" onerror="this.onerror=null; this.src='${generateQRCodeWithFallback(qrData, 1)}'">
              </div>
            </div>
            <div class="lehenga-number">
              <span class="lehenga-badge">Lehenga ${actualIndex + 1}</span>
            </div>
            <div class="info-section customer-section">
              <div class="section-title">👤 CUSTOMER</div>
              <div class="info-item">
                <span class="info-label">Name:</span>
                <span class="info-value">${formattedOrder.customerName}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Delivery:</span>
                <span class="info-value">${formatDate(formattedOrder.deliveryDate)}</span>
              </div>
            </div>
            <div class="info-section salesmen-section">
              <div class="section-title">🤝 SALESMEN</div>
              <div class="salesmen-names">${salesmenNames}</div>
            </div>
            <div class="info-section design-section">
              <div class="section-title">👗 DESIGN DETAILS</div>
              <div class="info-item">
                <span class="info-label">Design:</span>
                <span class="info-value">${lehenga.design || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Color:</span>
                <span class="info-value">${lehenga.color || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Blouse:</span>
                <span class="info-value">${lehenga.blouseOption || 'N/A'}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Main Dupatta:</span>
                <span class="info-value">${mainDupatta}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Extra Dupatta:</span>
                <span class="info-value">${extraDupatta}</span>
              </div>
            </div>
            ${!isUnstitched ? `
              <div class="info-section measurement-section">
                <div class="section-title">📏 MEASUREMENTS</div>
                <div class="measurement-grid">
                  <div class="measurement-item">
                    <div class="measurement-label">Length</div>
                    <div class="measurement-value">${lehenga.length || 'Free'}</div>
                  </div>
                  <div class="measurement-item">
                    <div class="measurement-label">Waist</div>
                    <div class="measurement-value">${lehenga.waist || 'Free'}</div>
                  </div>
                  <div class="measurement-item">
                    <div class="measurement-label">Hip</div>
                    <div class="measurement-value">${lehenga.hip || 'Free'}</div>
                  </div>
                </div>
              </div>
            ` : `
              <div class="info-section unstitched-section">
                <div class="unstitched-label">🧵 UNSTITCHED</div>
              </div>
            `}
            <div class="amount-section">
              <div class="amount-code">${amountCode}</div>
            </div>
            <div class="thank-you-section">
              <div class="thank-you-note">Thank you for choosing AKDK Jain!</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Stickers-${formattedOrder.billNumber}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;background:#f5f5f5;padding:5mm}
    .sticker-page{page-break-after:always;display:flex;justify-content:center;align-items:center;min-height:15cm;padding:3mm}
    .sticker-page:last-child{page-break-after:avoid}
    .sticker-container{width:10cm;height:15cm;background:#fff;border:3px solid #4a154b;border-radius:8px;padding:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);overflow:hidden}
    .sticker-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;padding-bottom:4px;border-bottom:2px solid #e5e7eb}
    .bill-number{font-size:12px;font-weight:800;color:#4a154b;background:linear-gradient(135deg,#f3e8ff 0%,#e9d5ff 100%);padding:4px 8px;border-radius:3px}
    .qr-code{background:#f8f9fa;padding:2px;border-radius:3px}
    .lehenga-number{text-align:center;margin-bottom:6px}
    .lehenga-badge{display:inline-block;background:linear-gradient(135deg,#6b21a8 0%,#8b5cf6 100%);color:#fff;padding:4px 12px;border-radius:12px;font-weight:700;font-size:10px;box-shadow:0 2px 4px rgba(107,33,168,0.3)}
    .info-section{margin-bottom:6px;padding:5px;border-radius:4px}
    .customer-section{background:linear-gradient(135deg,#dbeafe 0%,#bfdbfe 100%);border-left:3px solid #2563eb}
    .salesmen-section{background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border-left:3px solid #f59e0b;border:2px solid #f59e0b}
    .design-section{background:linear-gradient(135deg,#fce7f3 0%,#fbcfe8 100%);border-left:3px solid #ec4899}
    .measurement-section{background:linear-gradient(135deg,#d1fae5 0%,#a7f3d0 100%);border-left:3px solid #10b981}
    .unstitched-section{background:linear-gradient(135deg,#fed7aa 0%,#fdba74 100%);border-left:3px solid #f97316;text-align:center}
    .section-title{font-size:9px;font-weight:700;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.3px}
    .info-item{display:flex;justify-content:space-between;margin-bottom:2px;font-size:8px}
    .info-label{font-weight:600;color:#374151}
    .info-value{font-weight:700;color:#111827;text-align:right}
    .salesmen-names{text-align:center;font-size:9px;font-weight:700;color:#92400e;padding:4px;background:#fff;border-radius:3px;margin-top:2px;text-transform:none;letter-spacing:0px}
    .measurement-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:3px}
    .measurement-item{text-align:center;background:#fff;padding:3px;border-radius:3px}
    .measurement-label{font-size:6px;font-weight:600;color:#6b7280;margin-bottom:1px}
    .measurement-value{font-size:10px;font-weight:800;color:#047857}
    .unstitched-label{font-size:12px;font-weight:700;color:#9a3412;padding:4px}
    .amount-section{background:#22c55e !important;background:linear-gradient(135deg,#4ade80 0%,#22c55e 100%) !important;print-color-adjust:exact !important;-webkit-print-color-adjust:exact !important;padding:8px;border-radius:4px;margin:6px 0}
    .amount-code{text-align:center;font-size:16px;font-weight:900;letter-spacing:1px;text-shadow:1px 1px 2px rgba(0,0,0,0.3);color:#fff}
    .thank-you-note{text-align:center;font-size:8px;font-weight:600;color:#6b7280;padding:4px;background:#f9fafb;border-radius:3px;border:1px dashed #d1d5db}
    @media print{body{background:#fff;padding:0}.sticker-page{min-height:15cm;padding:0;margin:0}.sticker-container{box-shadow:none;page-break-inside:avoid}.amount-section{background:#22c55e !important}@page{size:10cm 15cm;margin:0}}
  </style>
</head>
<body>
  ${stickersHTML}
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        setTimeout(function() {
          window.close();
        }, 1000);
      }, 500);
    };
  </script>
</body>
</html>`;
  }, [formattedOrder, selectedLehengaIndex, getSalesmenNames, qrCodeAttempts]);

  // Improved print handler with error handling and double-click prevention
  const handlePrint = useCallback(async () => {
    if (!formattedOrder || isPrinting) {
      return;
    }

    setIsPrinting(true);
    setError(null);

    const htmlGenerators = {
      customerReceipt: generateSmallReceiptHTML,
      officeReceipt: generateReceiptHTML,
      sticker: generateStickerHTML
    };

    const htmlContent = htmlGenerators[printType]?.();
    
    if (!htmlContent) {
      setError('Could not generate print content');
      setIsPrinting(false);
      return;
    }

    try {
      const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
      if (!printWindow) {
        setError('Popup blocked! Please allow popups for this site.');
        setIsPrinting(false);
        return;
      }

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      // Focus the window
      printWindow.focus();
      
      // Reset printing state after a timeout
      setTimeout(() => {
        setIsPrinting(false);
      }, 3000);
      
    } catch (err) {
      console.error('Print error:', err);
      setError('Failed to open print window. Please try again.');
      setIsPrinting(false);
    }
  }, [printType, formattedOrder, generateSmallReceiptHTML, generateReceiptHTML, generateStickerHTML, isPrinting]);

  // Loading state
  if (loading) {
    return (
      <div className="print-order-modal" role="dialog" aria-labelledby="print-dialog-title" aria-modal="true">
        <div className="print-modal-content">
          <div className="print-modal-header">
            <h2 id="print-dialog-title">🖨️ Print Order</h2>
            <button className="close-btn" onClick={onClose} aria-label="Close dialog">×</button>
          </div>
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div className="loading-spinner" aria-label="Loading order details"></div>
            <p style={{ marginTop: '20px', color: 'var(--color-text-secondary)' }}>
              Loading order details...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="print-order-modal" role="dialog" aria-labelledby="print-dialog-title" aria-modal="true">
        <div className="print-modal-content">
          <div className="print-modal-header">
            <h2 id="print-dialog-title">❌ Error</h2>
            <button className="close-btn" onClick={onClose} aria-label="Close dialog">×</button>
          </div>
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
            <h3 style={{ color: 'var(--color-error)', marginBottom: '16px' }}>
              {error}
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
              Please check the order ID and try again.
            </p>
            <button 
              className="btn btn--primary"
              onClick={() => setError(null)}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No order state
  if (!formattedOrder) {
    return (
      <div className="print-order-modal" role="dialog" aria-labelledby="print-dialog-title" aria-modal="true">
        <div className="print-modal-content">
          <div className="print-modal-header">
            <h2 id="print-dialog-title">🖨️ Print Order</h2>
            <button className="close-btn" onClick={onClose} aria-label="Close dialog">×</button>
          </div>
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>📄</div>
            <h3 style={{ color: 'var(--color-text)', marginBottom: '16px' }}>
              No Order Selected
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>
              Please select an order to print.
            </p>
            <button 
              className="btn btn--primary"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div 
      className="print-order-modal" 
      role="dialog"
      aria-labelledby="print-dialog-title"
      aria-modal="true"
    >
      <div className="print-modal-content">
        <div className="print-modal-header">
          <h2 id="print-dialog-title">
            🖨️ Print Order - #{formattedOrder.billNumber}
          </h2>
          <button 
            className="close-btn" 
            onClick={onClose}
            aria-label="Close print dialog"
          >
            ×
          </button>
        </div>

        <div className="print-modal-body">
          <div className="print-section">
            <h3>📄 Select Print Format</h3>
            <div className="print-type-grid">
              <button
                className={`print-type-btn ${printType === 'customerReceipt' ? 'active' : ''}`}
                onClick={() => setPrintType('customerReceipt')}
                aria-pressed={printType === 'customerReceipt'}
              >
                <div className="print-type-icon">🧾</div>
                <div className="print-type-label">Customer Receipt</div>
                <div className="print-type-desc">10x15cm compact</div>
              </button>

              <button
                className={`print-type-btn ${printType === 'officeReceipt' ? 'active' : ''}`}
                onClick={() => setPrintType('officeReceipt')}
                aria-pressed={printType === 'officeReceipt'}
              >
                <div className="print-type-icon">📋</div>
                <div className="print-type-label">Office Receipt</div>
                <div className="print-type-desc">Full A4 format</div>
              </button>

              <button
                className={`print-type-btn ${printType === 'sticker' ? 'active' : ''}`}
                onClick={() => setPrintType('sticker')}
                aria-pressed={printType === 'sticker'}
              >
                <div className="print-type-icon">🏷️</div>
                <div className="print-type-label">Lehenga Sticker</div>
                <div className="print-type-desc">10x15cm labels</div>
              </button>
            </div>
          </div>

          {printType === 'sticker' && formattedOrder.lehengaDetails && formattedOrder.lehengaDetails.length > 0 && (
            <div className="print-section">
              <h3>👗 Select Lehenga</h3>
              <div className="lehenga-selection">
                <button
                  className={`lehenga-btn ${selectedLehengaIndex === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedLehengaIndex('all')}
                  aria-pressed={selectedLehengaIndex === 'all'}
                >
                  All ({formattedOrder.lehengaDetails.length})
                </button>
                {formattedOrder.lehengaDetails.map((lehenga, index) => (
                  <button
                    key={index}
                    className={`lehenga-btn ${selectedLehengaIndex === String(index) ? 'active' : ''}`}
                    onClick={() => setSelectedLehengaIndex(String(index))}
                    aria-pressed={selectedLehengaIndex === String(index)}
                  >
                    L{index + 1}: {getSalesmenNames(lehenga)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="print-section">
            <h3>📊 Order Summary</h3>
            <div className="order-summary">
              <div className="summary-row">
                <span className="summary-label">👤 Customer:</span>
                <span className="summary-value">{formattedOrder.customerName}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">📱 Phone:</span>
                <span className="summary-value">{formatPhoneNumber(formattedOrder.phoneNumber)}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">📅 Delivery:</span>
                <span className="summary-value">{formatDate(formattedOrder.deliveryDate)}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">👗 Items:</span>
                <span className="summary-value">{formattedOrder.lehengaCount} Lehenga(s)</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">💰 Total:</span>
                <span className="summary-value highlight">₹{formattedOrder.formattedTotal}</span>
              </div>
              {formattedOrder.pendingAmount > 0 && (
                <div className="summary-row">
                  <span className="summary-label">⚠️ Pending:</span>
                  <span className="summary-value pending">₹{formattedOrder.formattedPending}</span>
                </div>
              )}
            </div>
          </div>

          <div className="print-actions">
            <button 
              className="print-btn" 
              onClick={handlePrint}
              disabled={isPrinting}
              aria-live="polite"
              aria-label={isPrinting ? 'Printing in progress' : `Print ${printType} for order ${formattedOrder.billNumber}`}
            >
              <span className="print-btn-icon">
                {isPrinting ? '🔄' : '🖨️'}
              </span>
              <span className="print-btn-text">
                {isPrinting ? 'Printing...' : 'Print Now'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// PropTypes for better development experience
PrintOrder.propTypes = {
  orderId: PropTypes.string,
  onClose: PropTypes.func.isRequired
};

// Default props
PrintOrder.defaultProps = {
  orderId: null
};

// Export with error boundary
export default function PrintOrderWithErrorBoundary(props) {
  return (
    <PrintOrderErrorBoundary onClose={props.onClose}>
      <PrintOrder {...props} />
    </PrintOrderErrorBoundary>
  );
}
