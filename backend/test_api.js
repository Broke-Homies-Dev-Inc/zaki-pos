// Test the settings API endpoint
const axios = require('axios');

async function testAPI() {
  try {
    console.log('Testing GET /api/setting/settings...\n');
    const response = await axios.get('http://localhost:4000/api/setting/settings');
    
    console.log('✅ API Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    console.log('\n📊 Field Types:');
    console.log('loyalty_points_enabled:', typeof response.data.loyalty_points_enabled, '=', response.data.loyalty_points_enabled);
    console.log('loyalty_points_per_100:', typeof response.data.loyalty_points_per_100, '=', response.data.loyalty_points_per_100);
    console.log('points_value:', typeof response.data.points_value, '=', response.data.points_value);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testAPI();
