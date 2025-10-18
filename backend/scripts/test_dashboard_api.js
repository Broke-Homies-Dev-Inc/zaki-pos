const axios = require('axios');

async function testDashboardAPI() {
  try {
    console.log('🔍 Testing Dashboard API Endpoint...\n');
    console.log('📍 URL: http://localhost:4000/api/dashboard\n');
    
    const response = await axios.get('http://localhost:4000/api/dashboard');
    const stats = response.data;
    
    console.log('✅ API Response:');
    console.log('═'.repeat(60));
    console.log(JSON.stringify(stats, null, 2));
    console.log('═'.repeat(60));
    
    console.log('\n📊 Formatted Statistics:');
    console.log('─'.repeat(60));
    console.log(`Today's Revenue:  ${stats.todayRevenue.toFixed(2)}`);
    console.log(`  → ${stats.revenueChange}`);
    console.log('');
    console.log(`Today's Orders:   ${stats.todayOrders}`);
    console.log(`  → ${stats.ordersChange}`);
    console.log('');
    console.log(`New Customers:    ${stats.newCustomers}`);
    console.log(`  → ${stats.customersThisHour} this hour`);
    console.log('');
    console.log(`Pending Orders:   ${stats.pendingOrders}`);
    console.log('─'.repeat(60));
    
    console.log('\n✅ Dashboard API is working correctly!');
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Error: Backend server is not running!');
      console.log('\n💡 Start the backend server with:');
      console.log('   cd backend');
      console.log('   npm run dev');
    } else {
      console.error('❌ Error:', error.message);
      if (error.response) {
        console.error('Response:', error.response.data);
      }
    }
  }
}

testDashboardAPI();
