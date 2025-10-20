import React from 'react';
import OrdersTable from './OrdersTable';

function Orders({ onEditOrder, onNavigate }) {
  return (
    <div className="orders-page">
      <OrdersTable onEditOrder={onEditOrder} onNavigate={onNavigate} />
    </div>
  );
}

export default Orders;