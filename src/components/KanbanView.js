// KanbanView.js - ENHANCED VERSION
import React, { useState } from 'react';
import './KanbanView.css';

const KanbanView = ({ orders, onEditOrder, onStatusUpdate }) => {
  const [draggedOrder, setDraggedOrder] = useState(null);

  const statusColumns = {
    'pending': { title: '⏳ Pending', color: '#ffc107', icon: '⏳' },
    'confirmed': { title: '✅ Confirmed', color: '#17a2b8', icon: '✅' },
    'on stitching': { title: '✂️ On Stitching', color: '#f59e0b', icon: '✂️' },
    'stitched': { title: '👗 Stitched', color: '#6f42c1', icon: '👗' },
    'ready': { title: '📦 Ready', color: '#20c997', icon: '📦' },
    'delivered': { title: '🎉 Delivered', color: '#28a745', icon: '🎉' },
    'cancelled': { title: '❌ Cancelled', color: '#dc3545', icon: '❌' }
  };

  const getOrdersByStatus = (status) => {
    return orders.filter(order => 
      order.status?.toLowerCase() === status.toLowerCase()
    );
  };

  const handleDragStart = (e, order) => {
    setDraggedOrder(order);
    e.dataTransfer.setData('text/plain', order.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, status) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drop-zone');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drop-zone');
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drop-zone');
    
    if (draggedOrder && draggedOrder.status !== newStatus) {
      onStatusUpdate(draggedOrder.id, newStatus);
    }
    
    setDraggedOrder(null);
  };

  const isDeliveryDateOverdue = (deliveryDate) => {
    if (!deliveryDate) return false;
    try {
      const parsedDate = new Date(deliveryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      parsedDate.setHours(0, 0, 0, 0);
      return parsedDate < today;
    } catch {
      return false;
    }
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    try {
      let date;
      if (typeof dateValue === 'object' && dateValue.seconds) {
        date = new Date(dateValue.seconds * 1000);
      } else {
        date = new Date(dateValue);
      }
      if (isNaN(date.getTime())) return 'N/A';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="kanban-container">
      <div className="kanban-board">
        {Object.entries(statusColumns).map(([status, column]) => {
          const columnOrders = getOrdersByStatus(status);
          
          return (
            <div 
              key={status}
              className={`kanban-column column-${status.replace(' ', '-')}`}
              onDragOver={(e) => handleDragOver(e, status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, status)}
            >
              <div 
                className="column-header"
                style={{ borderLeftColor: column.color }}
              >
                <h3>
                  <span className="column-icon">{column.icon}</span>
                  {column.title}
                </h3>
                <span className="column-count">
                  {columnOrders.length}
                </span>
              </div>
              <div className="column-content">
                {columnOrders.map(order => (
                  <div 
                    key={order.id} 
                    className="kanban-card"
                    draggable
                    onDragStart={(e) => handleDragStart(e, order)}
                    onClick={() => onEditOrder(order.id)}
                  >
                    <div className="card-header">
                      <strong>#{order.billNumber}</strong>
                      <span className="card-amount">
                        ₹{order.totalAmount ? parseFloat(order.totalAmount).toLocaleString('en-IN') : '0'}
                      </span>
                    </div>
                    <div className="card-customer">{order.customerName}</div>
                    <div className="card-phone">{order.phoneNumber}</div>
                    
                    {order.pendingAmount > 0 && (
                      <div className="card-pending">
                        Pending: ₹{parseFloat(order.pendingAmount).toLocaleString('en-IN')}
                      </div>
                    )}
                    
                    {isDeliveryDateOverdue(order.deliveryDate) && status !== 'delivered' && status !== 'cancelled' && (
                      <div className="card-overdue">
                        Overdue: {formatDate(order.deliveryDate)}
                      </div>
                    )}

                    <div className="card-delivery">
                      Delivery: {formatDate(order.deliveryDate)}
                    </div>

                    <div className="card-actions">
                      <button 
                        className="card-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditOrder(order.id);
                        }}
                        title="Edit Order"
                      >
                        ✏️
                      </button>
                      <button 
                        className="card-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Add WhatsApp functionality here if needed
                        }}
                        title="Send WhatsApp"
                      >
                        💬
                      </button>
                      <button 
                        className="card-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Add PDF generation here if needed
                        }}
                        title="Generate PDF"
                      >
                        📄
                      </button>
                    </div>
                  </div>
                ))}
                
                {columnOrders.length === 0 && (
                  <div className="column-empty">
                    <div className="column-empty-icon">📭</div>
                    <p>No orders</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KanbanView;