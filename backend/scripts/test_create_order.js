const axios = require('axios');

const testOrder = {
  order: {
    order_number: 'ORD-TEST-' + Date.now(),
    customer_name: 'Test Customer',
    mobile_number: '1234567890',
    order_type: 'dine_in',
    subtotal: 100.00,
    tax_amount: 5.00,
    grand_total: 105.00,
    status: 'pending',
    notes: null,
    restaurant_table_id: null,
    take_away_method: null,
    car_make: null,
    car_license_plate: null,
    delivery_address: null
  },
  items: [
    {
      menu_item_id: '6e36f603-4fa1-4e90-be53-4b55cefd4d7f', // test item from your DB
      quantity: 1,
      unit_price: 100.00,
      total_price: 100.00
    }
  ]
};

axios.post('http://localhost:4000/api/orders', testOrder)
  .then(response => {
    console.log('✅ Order created successfully:');
    console.log(JSON.stringify(response.data, null, 2));
  })
  .catch(error => {
    console.error('❌ Error creating order:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  });
