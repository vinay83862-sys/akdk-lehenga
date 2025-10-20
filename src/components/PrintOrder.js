// PrintOrder.js - Premium Theme
import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import './PrintOrder.css';

function PrintOrder({ orderId, onClose }) {
  const [order, setOrder] = useState(null);
  const [printType, setPrintType] = useState('customerReceipt');
  const [selectedLehengaIndex, setSelectedLehengaIndex] = useState('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (orderId) {
      setLoading(true);
      const orderRef = ref(db, `Orders/${orderId}`);
      onValue(orderRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setOrder({
            id: orderId,
            ...data
          });
        }
        setLoading(false);
      });
    }
  }, [orderId]);

  // Generate amount code (PINKREDJAS mapping) - Modified to remove first 5 S characters
  const generateAmountCode = (amount) => {
    const codeMapping = {
      '0': 'S', '1': 'P', '2': 'I', '3': 'N', '4': 'K',
      '5': 'R', '6': 'E', '7': 'D', '8': 'J', '9': 'A'
    };
    
    const formattedAmount = String(Math.round(amount || 0)).padStart(10, '0');
    let codedAmount = '';
    
    for (let i = 0; i < formattedAmount.length; i++) {
      codedAmount += codeMapping[formattedAmount[i]] || 'S';
    }
    
    // Remove first 5 S characters as requested
    return codedAmount.substring(5);
  };

  // Format date function
  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    
    try {
      let date;
      
      if (typeof dateValue === 'object' && dateValue.seconds) {
        date = new Date(dateValue.seconds * 1000);
      } else if (typeof dateValue === 'string') {
        if (dateValue.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
          const parts = dateValue.split('/');
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          date = new Date(year, month, day);
        } else if (dateValue.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
          const parts = dateValue.split('-');
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          date = new Date(year, month, day);
        } else {
          date = new Date(dateValue);
        }
      } else if (typeof dateValue === 'number') {
        date = new Date(dateValue);
      } else {
        return 'Invalid Date';
      }
      
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}-${month}-${year}`;
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Generate Small Customer Receipt HTML (Sticker Size - 10x15)
  const generateSmallReceiptHTML = () => {
    if (!order) return '';

    const pendingAmount = order.pendingAmount ? parseFloat(order.pendingAmount) : 0;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Customer Estimate - Bill #${order.billNumber}</title>
        <style>
          body {
            margin: 0;
            padding: 10px;
            font-family: 'Arial', sans-serif;
            background: white;
          }
          .small-receipt {
            width: 10cm;
            height: 15cm;
            border: 2px solid #000;
            padding: 12px;
            font-family: 'Arial', sans-serif;
            font-size: 12px;
            line-height: 1.3;
            background: white;
            box-sizing: border-box;
            margin: 0 auto;
          }
          .receipt-header {
            text-align: center;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid #000;
          }
          .shop-name {
            font-weight: 700;
            font-size: 16px;
            color: #4a154b;
            margin-bottom: 3px;
          }
          .receipt-title {
            font-weight: 600;
            font-size: 14px;
            color: #000;
            margin-bottom: 5px;
          }
          .shop-contact {
            font-size: 10px;
            font-weight: 600;
          }
          .customer-info {
            margin-bottom: 10px;
            padding: 8px;
            background: #f8f9fa;
            border-radius: 4px;
            border-left: 3px solid #4a154b;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
          }
          .label {
            font-weight: 600;
            color: #495057;
            min-width: 60px;
          }
          .value {
            font-weight: 500;
            color: #000;
            text-align: right;
            flex: 1;
          }
          .lehenga-details {
            flex: 1;
            margin-bottom: 10px;
            max-height: 300px;
            overflow-y: auto;
          }
          .lehenga-item {
            padding: 8px;
            margin-bottom: 8px;
            background: #fff;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 11px;
          }
          .lehenga-header {
            font-weight: 700;
            color: #4a154b;
            margin-bottom: 5px;
            padding-bottom: 3px;
            border-bottom: 1px dashed #ccc;
          }
          .lehenga-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
          }
          .lehenga-label {
            font-weight: 600;
            color: #495057;
            min-width: 70px;
          }
          .lehenga-value {
            font-weight: 500;
            color: #000;
            text-align: right;
            flex: 1;
          }
          .measurement-section {
            background: #e3f2fd;
            padding: 5px;
            border-radius: 3px;
            margin: 5px 0;
            border-left: 3px solid #2196f3;
          }
          .payment-summary {
            margin-bottom: 10px;
            padding: 8px;
            background: #e8f5e8;
            border-radius: 4px;
            border: 1px solid #28a745;
          }
          .payment-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
            font-weight: 600;
          }
          .total-row {
            border-top: 1px solid #28a745;
            padding-top: 5px;
            margin-top: 5px;
            font-size: 13px;
            color: #155724;
          }
          .notes-section {
            margin-bottom: 10px;
            padding: 8px;
            background: #fff3cd;
            border-radius: 4px;
            border: 1px solid #ffc107;
            font-size: 10px;
          }
          .no-return {
            text-align: center;
            font-weight: 700;
            font-size: 11px;
            color: #dc3545;
            margin: 8px 0;
            padding: 5px;
            background: #f8d7da;
            border: 1px solid #dc3545;
            border-radius: 3px;
          }
          .receipt-footer {
            text-align: center;
            padding-top: 8px;
            border-top: 1px solid #000;
            font-size: 10px;
          }
          .signature {
            margin-top: 15px;
            display: flex;
            justify-content: space-between;
          }
          .signature-box {
            width: 45%;
            border-top: 1px solid #000;
            padding-top: 3px;
            text-align: center;
            font-size: 10px;
          }
          @media print {
            body { margin: 0; padding: 0; }
            .small-receipt { 
              border: 1px solid #000 !important; 
              margin: 0 !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="small-receipt">
          <div class="receipt-header">
            <div class="shop-name">AKDK Jain</div>
            <div class="receipt-title">CUSTOMER ESTIMATE</div>
            <div class="shop-contact">Mob: 8700208934, 9870589648</div>
          </div>

          <div class="customer-info">
            <div class="info-row">
              <span class="label">Bill No:</span>
              <span class="value">${order.billNumber}</span>
            </div>
            <div class="info-row">
              <span class="label">Name:</span>
              <span class="value">${order.customerName}</span>
            </div>
            <div class="info-row">
              <span class="label">Phone:</span>
              <span class="value">${order.phoneNumber}</span>
            </div>
            <div class="info-row">
              <span class="label">Date:</span>
              <span class="value">${formatDate(order.createdAt)}</span>
            </div>
            <div class="info-row">
              <span class="label">Delivery:</span>
              <span class="value">${formatDate(order.deliveryDate)}</span>
            </div>
          </div>

          <div class="lehenga-details">
            ${order.lehengaDetails && order.lehengaDetails.length > 0 ? 
              order.lehengaDetails.map((lehenga, index) => {
                // Check if lehenga is unstitched (no measurements provided)
                const isUnstitched = lehenga.stitchingOption === 'Unstitched' || 
                                    (!lehenga.length && !lehenga.waist && !lehenga.hip);
                
                return `
                  <div class="lehenga-item">
                    <div class="lehenga-header">Lehenga ${index + 1} - ₹${lehenga.amount ? parseFloat(lehenga.amount).toLocaleString('en-IN') : '0'}</div>
                    <div class="lehenga-row">
                      <span class="lehenga-label">Design:</span>
                      <span class="lehenga-value">${lehenga.design || 'N/A'}</span>
                    </div>
                    <div class="lehenga-row">
                      <span class="lehenga-label">Color:</span>
                      <span class="lehenga-value">${lehenga.color || 'N/A'}</span>
                    </div>
                    <div class="lehenga-row">
                      <span class="lehenga-label">Stitching:</span>
                      <span class="lehenga-value">${isUnstitched ? 'Unstitched' : (lehenga.stitchingOption || 'N/A')}</span>
                    </div>
                    ${!isUnstitched ? `
                      <div class="measurement-section">
                        <div class="lehenga-row">
                          <span class="lehenga-label">Length:</span>
                          <span class="lehenga-value">${lehenga.length || 'Free'}</span>
                        </div>
                        <div class="lehenga-row">
                          <span class="lehenga-label">Waist:</span>
                          <span class="lehenga-value">${lehenga.waist || 'Free'}</span>
                        </div>
                        <div class="lehenga-row">
                          <span class="lehenga-label">Hip:</span>
                          <span class="lehenga-value">${lehenga.hip || 'Free'}</span>
                        </div>
                      </div>
                    ` : ''}
                    <div class="lehenga-row">
                      <span class="lehenga-label">Blouse:</span>
                      <span class="lehenga-value">${lehenga.blouseOption || 'N/A'}</span>
                    </div>
                    ${lehenga.mainDupatta ? `
                      <div class="lehenga-row">
                        <span class="lehenga-label">Main Dupatta:</span>
                        <span class="lehenga-value">${lehenga.mainDupatta}</span>
                      </div>
                    ` : ''}
                    ${lehenga.extraDupatta === 'Yes' ? `
                      <div class="lehenga-row">
                        <span class="lehenga-label">Extra Dupatta:</span>
                        <span class="lehenga-value">${lehenga.extraDupattaType || 'Yes'}</span>
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('') 
              : '<div class="lehenga-item">No lehenga details available</div>'
            }
          </div>

          <div class="payment-summary">
            <div class="payment-row">
              <span>Total Amount:</span>
              <span>₹${order.totalAmount ? parseFloat(order.totalAmount).toLocaleString('en-IN') : '0'}</span>
            </div>
            <div class="payment-row">
              <span>Paid Amount:</span>
              <span>₹${order.paidAmount ? parseFloat(order.paidAmount).toLocaleString('en-IN') : '0'}</span>
            </div>
            ${pendingAmount > 0 ? `
              <div class="payment-row total-row">
                <span>Pending Amount:</span>
                <span>₹${pendingAmount.toLocaleString('en-IN')}</span>
              </div>
            ` : ''}
          </div>

          <div class="no-return">
            NO RETURN | NO REFUND | NO EXCHANGE
          </div>

          ${order.notes ? `
            <div class="notes-section">
              <strong>Notes:</strong> ${order.notes}
            </div>
          ` : ''}

          <div class="receipt-footer">
            <div>Thank you for your business!</div>
            <div class="signature">
              <div class="signature-box">Customer Signature</div>
              <div class="signature-box">Authorized Signature</div>
            </div>
          </div>
        </div>
        
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() {
              window.close();
            }, 1000);
          }
        </script>
      </body>
      </html>
    `;
  };

  // Generate A4 Customer Receipt HTML - UPDATED LEHENGA DETAILS SECTION
  const generateReceiptHTML = () => {
    if (!order) return '';

    const pendingAmount = order.pendingAmount ? parseFloat(order.pendingAmount) : 0;

    // Generate table rows for lehenga details
    const lehengaTableRows = order.lehengaDetails && order.lehengaDetails.length > 0 
      ? order.lehengaDetails.map((lehenga, index) => {
          // Check if lehenga is unstitched
          const isUnstitched = lehenga.stitchingOption === 'Unstitched' || 
                              (!lehenga.length && !lehenga.waist && !lehenga.hip);
          
          return `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: 600;">${index + 1}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${lehenga.design || 'N/A'}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${lehenga.color || 'N/A'}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${lehenga.blouseOption || 'N/A'}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${lehenga.mainDupatta || 'N/A'}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${lehenga.extraDupatta === 'Yes' ? (lehenga.extraDupattaType || 'Yes') : 'NO'}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${isUnstitched ? 'Unstitched' : (lehenga.length || 'Free')}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${isUnstitched ? '' : (lehenga.waist || 'Free')}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${isUnstitched ? '' : (lehenga.hip || 'Free')}</td>
            </tr>
          `;
        }).join('')
      : '<tr><td colspan="9" style="border: 1px solid #ddd; padding: 8px; text-align: center;">No lehenga details available</td></tr>';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Customer Estimate - Bill #${order.billNumber}</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            color: #000;
            line-height: 1.4;
          }
          .customer-receipt {
            max-width: 800px;
            margin: 0 auto;
            background: white;
          }
          .receipt-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #000;
          }
          .shop-info h1 {
            margin: 0 0 8px 0;
            font-size: 24px;
            color: #4a154b;
          }
          .shop-info p {
            margin: 2px 0;
            font-size: 12px;
          }
          .invoice-info {
            text-align: right;
          }
          .invoice-info h2 {
            margin: 0 0 10px 0;
            font-size: 20px;
            color: #000;
          }
          .invoice-info p {
            margin: 3px 0;
            font-size: 12px;
          }
          .customer-info {
            margin-bottom: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #4a154b;
          }
          .customer-info h3 {
            margin: 0 0 10px 0;
            color: #4a154b;
            font-size: 16px;
          }
          .customer-info p {
            margin: 5px 0;
            font-size: 13px;
          }
          .lehenga-details {
            margin-bottom: 20px;
          }
          .lehenga-details h3 {
            margin: 0 0 10px 0;
            color: #4a154b;
            font-size: 16px;
            text-align: center;
            background: #4a154b;
            color: white;
            padding: 8px;
            border-radius: 4px;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-bottom: 15px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          .items-table th {
            background: #4a154b;
            color: white;
            padding: 10px 8px;
            text-align: center;
            font-weight: 600;
            border: 1px solid #ddd;
            font-size: 11px;
          }
          .items-table td {
            padding: 8px;
            border: 1px solid #ddd;
            text-align: center;
          }
          .items-table tr:nth-child(even) {
            background: #f8f9fa;
          }
          .items-table tr:hover {
            background: #e9ecef;
          }
          .payment-details {
            margin-bottom: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #28a745;
          }
          .payment-details h3 {
            margin: 0 0 15px 0;
            color: #28a745;
            font-size: 16px;
          }
          .payment-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
          }
          .payment-item {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
            border-bottom: 1px dashed #ddd;
          }
          .payment-item span:first-child {
            font-weight: 600;
            color: #495057;
          }
          .payment-item span:last-child {
            font-weight: 700;
            color: #000;
          }
          .notes-section {
            margin-bottom: 20px;
            padding: 15px;
            background: #fff3cd;
            border-radius: 8px;
            border-left: 4px solid #ffc107;
          }
          .notes-section h3 {
            margin: 0 0 8px 0;
            color: #856404;
            font-size: 16px;
          }
          .notes-section p {
            margin: 0;
            font-style: italic;
          }
          .no-return-policy {
            text-align: center;
            font-weight: 700;
            font-size: 14px;
            color: #dc3545;
            margin: 20px 0;
            padding: 15px;
            background: #f8d7da;
            border: 2px solid #dc3545;
            border-radius: 8px;
          }
          .receipt-footer {
            text-align: center;
            padding-top: 20px;
            border-top: 2px solid #000;
          }
          .receipt-footer p {
            margin: 5px 0;
          }
          .signature-section {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
          }
          .customer-sign, .company-sign {
            width: 45%;
            border-top: 1px solid #000;
            padding-top: 5px;
            text-align: center;
            font-size: 12px;
          }
          @media print {
            body { margin: 0; }
            .customer-receipt { box-shadow: none; }
            .items-table { font-size: 10px; }
            .items-table th, .items-table td { padding: 6px 4px; }
          }
        </style>
      </head>
      <body>
        <div class="customer-receipt">
          <div class="receipt-header">
            <div class="shop-info">
              <h1>AKDK Jain</h1>
              <p>988/5, Kucha Natwa, Near town, Chandni Chowk, Delhi - 110006</p>
              <p>MOB: +91 8700208934, 9870589648</p>
              <p>GSTIN/UIN: 07AAPCA4720PIZ7</p>
            </div>
            
            <div class="invoice-info">
              <h2>ESTIMATE</h2>
              <p><strong>DATE:</strong> ${formatDate(order.createdAt)}</p>
              <p><strong>ORDER NO.:</strong> #${order.billNumber}</p>
            </div>
          </div>

          <div class="customer-info">
            <h3>Customer Details:</h3>
            <p><strong>Name:</strong> ${order.customerName}</p>
            <p><strong>Phone:</strong> ${order.phoneNumber}</p>
            <p><strong>Bill No:</strong> ${order.billNumber}</p>
            <p><strong>Delivery Date:</strong> ${formatDate(order.deliveryDate)}</p>
          </div>

          ${order.lehengaDetails && order.lehengaDetails.length > 0 ? `
            <div class="lehenga-details">
              <h3>LEHENGA DETAILS (${order.lehengaDetails.length} Items)</h3>
              <table class="items-table">
                <thead>
                  <tr>
                    <th style="width: 30px;">No</th>
                    <th>Design</th>
                    <th>Color</th>
                    <th>Blouse</th>
                    <th>Dupatta</th>
                    <th>Extra Dupatta</th>
                    <th>Length</th>
                    <th>Waist</th>
                    <th>Hip</th>
                  </tr>
                </thead>
                <tbody>
                  ${lehengaTableRows}
                </tbody>
              </table>
            </div>
          ` : ''}

          <div class="payment-details">
            <h3>Payment Summary:</h3>
            <div class="payment-grid">
              <div class="payment-item">
                <span>Total Amount:</span>
                <span>₹${order.totalAmount ? parseFloat(order.totalAmount).toLocaleString('en-IN') : '0'}</span>
              </div>
              <div class="payment-item">
                <span>Paid Amount:</span>
                <span>₹${order.paidAmount ? parseFloat(order.paidAmount).toLocaleString('en-IN') : '0'}</span>
              </div>
              ${pendingAmount > 0 ? `
                <div class="payment-item">
                  <span>Pending Amount:</span>
                  <span>₹${pendingAmount.toLocaleString('en-IN')}</span>
                </div>
              ` : ''}
              <div class="payment-item">
                <span>Payment Type:</span>
                <span>${order.paymentType || 'N/A'}</span>
              </div>
              <div class="payment-item">
                <span>Status:</span>
                <span>${order.status || 'Pending'}</span>
              </div>
            </div>
          </div>

          <div class="no-return-policy">
            NO RETURN | NO REFUND | NO EXCHANGE
          </div>

          ${order.notes ? `
            <div class="notes-section">
              <h3>Notes:</h3>
              <p>${order.notes}</p>
            </div>
          ` : ''}

          <div class="receipt-footer">
            <p><strong>Thank you for your business!</strong></p>
            <p>For any queries, contact: +91 8700208934</p>
            <div class="signature-section">
              <div class="customer-sign">
                <p>Customer Signature</p>
              </div>
              <div class="company-sign">
                <p>Authorized Signature</p>
              </div>
            </div>
          </div>
        </div>
        
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() {
              window.close();
            }, 1000);
          }
        </script>
      </body>
      </html>
    `;
  };

  // Generate Lehenga Sticker HTML
  const generateStickerHTML = () => {
    if (!order || !order.lehengaDetails) return '';

    const lehengasToPrint = selectedLehengaIndex === 'all' 
      ? order.lehengaDetails 
      : [order.lehengaDetails[selectedLehengaIndex]];

    const stickerHTML = lehengasToPrint.map((lehenga, index) => {
      const actualIndex = selectedLehengaIndex === 'all' ? index : parseInt(selectedLehengaIndex);
      
      // Check if lehenga is unstitched (no measurements provided)
      const isUnstitched = lehenga.stitchingOption === 'Unstitched' || 
                          (!lehenga.length && !lehenga.waist && !lehenga.hip);
      
      const stitchingDetails = !isUnstitched ? `
        <div class="measurement-section">
          <div class="measurement-title">MEASUREMENTS</div>
          <div class="measurement-grid">
            <div class="measurement-item">
              <span class="measurement-label">LENGTH</span>
              <span class="measurement-value">${lehenga.length || 'Free'}</span>
            </div>
            <div class="measurement-item">
              <span class="measurement-label">WAIST</span>
              <span class="measurement-value">${lehenga.waist || 'Free'}</span>
            </div>
            <div class="measurement-item">
              <span class="measurement-label">HIP</span>
              <span class="measurement-value">${lehenga.hip || 'Free'}</span>
            </div>
          </div>
        </div>
      ` : '';

      return `
        <div class="lehenga-sticker">
          <div class="sticker-header">
            <div class="shop-name">AKDK Jain</div>
            <div class="sticker-title">LEHENGA STICKER</div>
          </div>

          <div class="sticker-content">
            <div class="order-info">
              <div class="info-row">
                <span class="label">Bill No:</span>
                <span class="value">${order.billNumber}</span>
              </div>
              <div class="info-row">
                <span class="label">Name:</span>
                <span class="value">${order.customerName}</span>
              </div>
              <div class="info-row">
                <span class="label">Lehenga #${actualIndex + 1}:</span>
                <span class="value">${lehenga.design || 'N/A'}</span>
              </div>
            </div>

            <div class="lehenga-details">
              <div class="detail-row">
                <span class="label">Color:</span>
                <span class="value">${lehenga.color || 'N/A'}</span>
              </div>
              <div class="detail-row">
                <span class="label">Stitching:</span>
                <span class="value">${isUnstitched ? 'Unstitched' : (lehenga.stitchingOption || 'N/A')}</span>
              </div>
              <div class="detail-row">
                <span class="label">Blouse:</span>
                <span class="value">${lehenga.blouseOption || 'N/A'}</span>
              </div>
              ${lehenga.mainDupatta ? `
                <div class="detail-row">
                  <span class="label">Main Dupatta:</span>
                  <span class="value">${lehenga.mainDupatta}</span>
                </div>
              ` : ''}
              ${lehenga.extraDupatta === 'Yes' ? `
                <div class="detail-row">
                  <span class="label">Extra Dupatta:</span>
                  <span class="value">${lehenga.extraDupattaType || 'Yes'}</span>
                </div>
              ` : ''}
            </div>

            ${stitchingDetails}

            <div class="amount-section">
              <div class="amount-code">
                ${generateAmountCode(lehenga.amount)}
              </div>
            </div>

            <div class="no-return">
              NO RETURN | NO REFUND
            </div>

            <div class="sticker-footer">
              <div class="delivery-info">
                Delivery: ${formatDate(order.deliveryDate)}
              </div>
              <div class="thank-you-note">
                Thank you for choosing AKDK Jain!
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Lehenga Stickers - Bill #${order.billNumber}</title>
        <style>
          body {
            margin: 0;
            padding: 10px;
            font-family: 'Arial', sans-serif;
            background: white;
          }
          .lehenga-stickers {
            display: grid;
            gap: 10px;
          }
          .lehenga-sticker {
            width: 10cm;
            height: 15cm;
            border: 2px solid #000;
            padding: 12px;
            font-family: 'Arial', sans-serif;
            font-size: 12px;
            line-height: 1.3;
            background: white;
            page-break-after: always;
            box-sizing: border-box;
            margin: 0 auto;
          }
          .sticker-header {
            text-align: center;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid #000;
          }
          .shop-name {
            font-weight: 700;
            font-size: 16px;
            color: #4a154b;
            margin-bottom: 3px;
          }
          .sticker-title {
            font-weight: 600;
            font-size: 14px;
            color: #000;
          }
          .sticker-content {
            height: calc(100% - 40px);
            display: flex;
            flex-direction: column;
          }
          .order-info {
            margin-bottom: 10px;
            padding: 8px;
            background: #f8f9fa;
            border-radius: 4px;
            border-left: 3px solid #4a154b;
          }
          .info-row, .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
          }
          .label {
            font-weight: 600;
            color: #495057;
            min-width: 70px;
          }
          .value {
            font-weight: 500;
            color: #000;
            text-align: right;
            flex: 1;
          }
          .lehenga-details {
            margin-bottom: 10px;
            padding: 8px;
            background: #fff;
            border: 1px dashed #6c757d;
            border-radius: 4px;
          }
          .measurement-section {
            margin-bottom: 10px;
            padding: 8px;
            background: #e3f2fd;
            border-radius: 6px;
            border: 2px solid #2196f3;
          }
          .measurement-title {
            text-align: center;
            font-weight: 700;
            font-size: 12px;
            color: #1976d2;
            margin-bottom: 5px;
            text-decoration: underline;
          }
          .measurement-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 3px;
          }
          .measurement-item {
            display: flex;
            justify-content: space-between;
            padding: 3px 5px;
            background: white;
            border-radius: 3px;
            font-weight: 600;
          }
          .measurement-label {
            color: #1976d2;
          }
          .measurement-value {
            color: #000;
          }
          .amount-section {
            margin-bottom: 8px;
            padding: 10px;
            background: #e8f5e8;
            border-radius: 6px;
            border: 2px solid #28a745;
            text-align: center;
          }
          .amount-code {
            font-size: 18px;
            font-weight: 700;
            color: #dc3545;
            letter-spacing: 2px;
            word-break: break-all;
          }
          .no-return {
            text-align: center;
            font-weight: 700;
            font-size: 11px;
            color: #dc3545;
            margin: 8px 0;
            padding: 5px;
            background: #f8d7da;
            border: 1px solid #dc3545;
            border-radius: 3px;
          }
          .sticker-footer {
            padding: 8px;
            background: #e3f2fd;
            border-radius: 4px;
            border: 1px solid #2196f3;
            text-align: center;
          }
          .delivery-info, .thank-you-note {
            font-weight: 600;
            font-size: 11px;
            margin-bottom: 3px;
          }
          .thank-you-note {
            color: #4a154b;
            font-style: italic;
          }
          @media print {
            body { margin: 0; padding: 0; }
            .lehenga-sticker { 
              border: 1px solid #000 !important; 
              margin: 0 !important; 
              page-break-after: always;
            }
          }
        </style>
      </head>
      <body>
        <div class="lehenga-stickers">
          ${stickerHTML}
        </div>
        
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() {
              window.close();
            }, 1000);
          }
        </script>
      </body>
      </html>
    `;
  };

  // Handle Print Function
  const handlePrint = () => {
    let htmlContent = '';
    
    if (printType === 'customerReceipt') {
      htmlContent = generateReceiptHTML();
    } else if (printType === 'customerSmallReceipt') {
      htmlContent = generateSmallReceiptHTML();
    } else {
      htmlContent = generateStickerHTML();
    }

    if (!htmlContent) {
      alert('No content to print!');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Focus on the new window
    printWindow.focus();
  };

  if (loading) {
    return (
      <div className="print-order-modal">
        <div className="print-modal-content">
          <div className="loading">
            <div className="spinner"></div>
            Loading order details...
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="print-order-modal">
        <div className="print-modal-content">
          <div className="loading">
            <div className="error-icon">❌</div>
            Order not found or unable to load order details.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="print-order-modal">
      <div className="print-modal-content">
        <div className="print-modal-header">
          <h2>🖨️ Print Options</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="print-controls">
          <div className="print-type-selector">
            <label>Print Type:</label>
            <select 
              value={printType} 
              onChange={(e) => setPrintType(e.target.value)}
            >
              <option value="customerReceipt">Customer Estimate (A4)</option>
              <option value="customerSmallReceipt">Customer Small Receipt</option>
              <option value="lehengaSticker">Lehenga Sticker</option>
            </select>
          </div>

          {printType === 'lehengaSticker' && order.lehengaDetails && (
            <div className="lehenga-selector">
              <label>Select Lehenga:</label>
              <select 
                value={selectedLehengaIndex} 
                onChange={(e) => setSelectedLehengaIndex(e.target.value)}
              >
                <option value="all">All Lehengas ({order.lehengaDetails.length})</option>
                {order.lehengaDetails.map((_, index) => (
                  <option key={index} value={index}>
                    Lehenga {index + 1}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="print-info">
            <p>
              <strong>Order:</strong> #{order.billNumber} - {order.customerName}
              <br />
              {printType === 'lehengaSticker' && selectedLehengaIndex !== 'all' && (
                <span>
                  <strong>Printing:</strong> Lehenga {parseInt(selectedLehengaIndex) + 1}
                </span>
              )}
              {printType === 'lehengaSticker' && selectedLehengaIndex === 'all' && (
                <span>
                  <strong>Printing:</strong> All {order.lehengaDetails.length} lehengas
                </span>
              )}
              {printType === 'customerSmallReceipt' && (
                <span>
                  <strong>Printing:</strong> Small Customer Receipt
                </span>
              )}
            </p>
          </div>

          <div className="print-actions">
            <button className="btn-primary" onClick={handlePrint}>
              {printType === 'customerReceipt' ? '🖨️ Print A4 Estimate' : 
               printType === 'customerSmallReceipt' ? '🧾 Print Small Receipt' : 
               '🏷️ Print Lehenga Sticker(s)'}
            </button>
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PrintOrder;