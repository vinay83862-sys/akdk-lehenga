// WhatsAppIntegration.js - SEPARATE COMPONENT FOR WHATSAPP FEATURES
import React, { useState, useCallback } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import './WhatsAppIntegration.css';

const WhatsAppIntegration = ({ 
  order, 
  onClose, 
  addNotification,
  formatDate 
}) => {
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [whatsappAttachment, setWhatsappAttachment] = useState('none');
  const [isSending, setIsSending] = useState(false);

  // WhatsApp Templates
  const [whatsappTemplates] = useState({
    orderConfirmed: "Namaste {customerName}! Your order #{billNumber} has been confirmed. Thank you for choosing us! 🎉",
    readyForPickup: "Hello {customerName}! Your order #{billNumber} is ready for pickup. Please visit our store. 📦",
    paymentReminder: "Dear {customerName}, friendly reminder: Your order #{billNumber} has pending amount of ₹{pendingAmount}. Kindly clear it at earliest. 💰",
    deliveryUpdate: "Hello {customerName}! Your order #{billNumber} is out for delivery. Expected delivery: {deliveryDate}. 🚚",
    estimateShared: "Hello {customerName}! Here's the estimate for your order #{billNumber}. Total: ₹{totalAmount}, Paid: ₹{paidAmount}, Pending: ₹{pendingAmount}. Delivery: {deliveryDate}."
  });

  // Generate PDF Blob for WhatsApp
  const generatePDFBlob = useCallback((order) => {
    return new Promise((resolve, reject) => {
      try {
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(20);
        doc.setTextColor(26, 31, 54);
        doc.text('A.K.D.K. Designer Lehenga\'s', 105, 20, { align: 'center' });
        
        doc.setFontSize(16);
        doc.text('Order Estimate', 105, 30, { align: 'center' });
        
        // Order details
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        
        const startY = 50;
        const lineHeight = 10;
        
        doc.text(`Order #: ${order.billNumber || 'N/A'}`, 20, startY);
        doc.text(`Customer: ${order.customerName || 'N/A'}`, 20, startY + lineHeight);
        doc.text(`Phone: ${order.phoneNumber || 'N/A'}`, 20, startY + lineHeight * 2);
        doc.text(`Date: ${formatDate(order.createdAt)}`, 20, startY + lineHeight * 3);
        doc.text(`Delivery Date: ${formatDate(order.deliveryDate)}`, 20, startY + lineHeight * 4);
        
        // Items table
        if (order.lehengaDetails && order.lehengaDetails.length > 0) {
          doc.autoTable({
            startY: startY + lineHeight * 6,
            head: [['Design', 'Quantity', 'Price', 'Amount']],
            body: order.lehengaDetails.map(item => [
              item.design || 'N/A',
              item.quantity || 1,
              `₹${item.price || 0}`,
              `₹${((item.price || 0) * (item.quantity || 1)).toLocaleString('en-IN')}`
            ]),
            theme: 'grid',
            headStyles: { fillColor: [26, 31, 54] },
            styles: { fontSize: 10 },
            headStyles: { fontSize: 10 }
          });
        }
        
        // Amount details
        const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 20 : startY + lineHeight * 8;
        
        doc.setFontSize(14);
        doc.text(`Total Amount: ₹${parseFloat(order.totalAmount || 0).toLocaleString('en-IN')}`, 20, finalY);
        doc.text(`Paid Amount: ₹${parseFloat(order.paidAmount || 0).toLocaleString('en-IN')}`, 20, finalY + 10);
        doc.setTextColor(237, 137, 54);
        doc.text(`Pending Amount: ₹${parseFloat(order.pendingAmount || 0).toLocaleString('en-IN')}`, 20, finalY + 20);
        
        // Footer
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text('Thank you for your business!', 105, 270, { align: 'center' });
        doc.text('Follow us: @akdk_clothing', 105, 280, { align: 'center' });
        
        // Convert to blob
        const pdfBlob = doc.output('blob');
        resolve(pdfBlob);
        
      } catch (error) {
        reject(error);
      }
    });
  }, [formatDate]);

  // Generate WhatsApp message from template
  const generateWhatsAppMessage = (order, templateType) => {
    const template = whatsappTemplates[templateType];
    
    return template
      .replace(/{customerName}/g, order.customerName || 'Customer')
      .replace(/{billNumber}/g, order.billNumber || 'N/A')
      .replace(/{pendingAmount}/g, order.pendingAmount ? parseFloat(order.pendingAmount).toLocaleString('en-IN') : '0')
      .replace(/{deliveryDate}/g, formatDate(order.deliveryDate))
      .replace(/{totalAmount}/g, order.totalAmount ? parseFloat(order.totalAmount).toLocaleString('en-IN') : '0')
      .replace(/{paidAmount}/g, order.paidAmount ? parseFloat(order.paidAmount).toLocaleString('en-IN') : '0');
  };

  // Send WhatsApp message
  const sendWhatsAppMessage = async () => {
    if (!order || !order.phoneNumber) {
      addNotification('error', 'No phone number found for this order', '❌');
      return;
    }

    setIsSending(true);
    
    try {
      const cleanPhone = order.phoneNumber.replace(/\D/g, '');
      let formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
      
      if (formattedPhone.startsWith('0')) {
        formattedPhone = formattedPhone.substring(1);
      }

      if (whatsappAttachment === 'pdf' || whatsappAttachment === 'both') {
        // Generate and download PDF first
        const pdfBlob = await generatePDFBlob(order);
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.href = pdfUrl;
        downloadLink.download = `Estimate_${order.billNumber}.pdf`;
        
        // Create WhatsApp URL
        let whatsappUrl = `https://wa.me/${formattedPhone}`;
        if (whatsappMessage && whatsappAttachment === 'both') {
          whatsappUrl += `?text=${encodeURIComponent(whatsappMessage)}`;
        }
        
        // Show instructions
        const userConfirmed = window.confirm(
          `📱 WhatsApp Process:\n\n1. PDF will download automatically\n2. WhatsApp will open\n3. Please attach the downloaded PDF manually\n\nClick OK to continue`
        );
        
        if (userConfirmed) {
          // Download PDF
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          
          // Open WhatsApp after delay
          setTimeout(() => {
            window.open(whatsappUrl, '_blank');
            
            addNotification('info', 
              `📁 PDF Downloaded! \n💬 WhatsApp Opened! \n📎 Please attach the PDF file manually.`,
              '✅'
            );
          }, 1500);
        }
        
      } else {
        // Message only - direct open
        const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(whatsappMessage)}`;
        window.open(whatsappUrl, '_blank');
        addNotification('success', 'WhatsApp opened with your message', '💬');
      }
      
      onClose();
      
    } catch (error) {
      console.error('WhatsApp error:', error);
      addNotification('error', 'Failed to process WhatsApp request', '❌');
    } finally {
      setIsSending(false);
    }
  };

  // Set default message when component mounts or order changes
  React.useEffect(() => {
    if (order) {
      const defaultMessage = generateWhatsAppMessage(order, 'estimateShared');
      setWhatsappMessage(defaultMessage);
    }
  }, [order]);

  if (!order) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content whatsapp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>💬 Send WhatsApp Message</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="whatsapp-recipient">
            <strong>To:</strong> {order.customerName} ({order.phoneNumber})
          </div>
          
          {/* Attachment Options */}
          <div className="attachment-options">
            <h4>📎 Send Options:</h4>
            <div className="attachment-buttons">
              <button
                className={`attachment-btn ${whatsappAttachment === 'none' ? 'active' : ''}`}
                onClick={() => setWhatsappAttachment('none')}
              >
                <div className="attachment-icon">📝</div>
                <div className="attachment-text">Message Only</div>
                <small className="attachment-desc">Instant Send</small>
              </button>
              <button
                className={`attachment-btn ${whatsappAttachment === 'pdf' ? 'active' : ''}`}
                onClick={() => setWhatsappAttachment('pdf')}
              >
                <div className="attachment-icon">📄</div>
                <div className="attachment-text">PDF Estimate</div>
                <small className="attachment-desc">Auto Download + WhatsApp</small>
              </button>
              <button
                className={`attachment-btn ${whatsappAttachment === 'both' ? 'active' : ''}`}
                onClick={() => setWhatsappAttachment('both')}
              >
                <div className="attachment-icon">📝📄</div>
                <div className="attachment-text">Message + PDF</div>
                <small className="attachment-desc">Auto Download + WhatsApp</small>
              </button>
            </div>
            
            {/* Smart Instructions */}
            {(whatsappAttachment === 'pdf' || whatsappAttachment === 'both') && (
              <div className="smart-instructions">
                <div className="instructions-box">
                  <h5>🚀 Automated Process:</h5>
                  <ol>
                    <li>PDF will auto-download</li>
                    <li>WhatsApp will open automatically</li>
                    <li>Attach the downloaded PDF manually</li>
                    <li>Send your message</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
          
          {/* Quick Templates */}
          <div className="message-templates">
            <h4>⚡ Quick Templates:</h4>
            <div className="template-buttons">
              <button
                className="template-btn"
                onClick={() => setWhatsappMessage(generateWhatsAppMessage(order, 'orderConfirmed'))}
              >
                <span className="template-icon">✅</span>
                <div className="template-text">Order Confirmed</div>
              </button>
              <button
                className="template-btn"
                onClick={() => setWhatsappMessage(generateWhatsAppMessage(order, 'readyForPickup'))}
              >
                <span className="template-icon">📦</span>
                <div className="template-text">Ready for Pickup</div>
              </button>
              <button
                className="template-btn"
                onClick={() => setWhatsappMessage(generateWhatsAppMessage(order, 'paymentReminder'))}
              >
                <span className="template-icon">💰</span>
                <div className="template-text">Payment Reminder</div>
              </button>
              <button
                className="template-btn"
                onClick={() => setWhatsappMessage(generateWhatsAppMessage(order, 'deliveryUpdate'))}
              >
                <span className="template-icon">🚚</span>
                <div className="template-text">Delivery Update</div>
              </button>
            </div>
          </div>
          
          {/* Message Editor */}
          <div className="message-editor">
            <label>✏️ Your Message:</label>
            <textarea
              value={whatsappMessage}
              onChange={(e) => setWhatsappMessage(e.target.value)}
              rows="4"
              placeholder="Type your message here..."
              className="message-textarea"
            />
            <div className="character-count">
              Character count: {whatsappMessage.length}
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button 
            className={`btn-whatsapp-send ${isSending ? 'loading' : ''}`}
            onClick={sendWhatsAppMessage}
            disabled={isSending}
            style={{
              background: whatsappAttachment === 'none' ? '#25D366' : 
                         whatsappAttachment === 'pdf' ? '#8B5CF6' : '#06B6D4'
            }}
          >
            {isSending ? (
              <>
                <span className="loading-spinner"></span>
                Processing...
              </>
            ) : (
              <>
                {whatsappAttachment === 'none' && '💬 Send Message'}
                {whatsappAttachment === 'pdf' && '📄 Download PDF & Open WhatsApp'}
                {whatsappAttachment === 'both' && '🚀 Download & Open WhatsApp'}
              </>
            )}
          </button>
          <button 
            className="btn-secondary"
            onClick={onClose}
            disabled={isSending}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppIntegration;