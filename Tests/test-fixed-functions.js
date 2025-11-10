/**
 * Test the 3 fixed functions
 */

import { F1DataService } from '../build/services/f1-data.service.js';

const f1Service = F1DataService.getInstance();

async function testFixedFunctions() {
  console.log('🧪 Testing 3 Fixed Functions\n');
  console.log('='.repeat(60));

  // Test 1: getCarData (with speed>=0 filter auto-added)
  console.log('\n📊 Test 1: getCarData (Fixed with speed>=0 filter)');
  console.log('-'.repeat(60));
  try {
    const sessionKey = '9159'; // 2024 Shanghai GP Race
    const driverNumber = '1'; // Max Verstappen
    
    console.log(`Requesting: session_key=${sessionKey}, driver_number=${driverNumber}`);
    console.log('Expected: Auto-adds speed>=0 filter to satisfy OpenF1 API');
    
    const carData = await f1Service.getCarData(driverNumber, sessionKey);
    
    if (carData && carData.length > 0) {
      console.log(`✅ SUCCESS: Retrieved ${carData.length} telemetry data points`);
      console.log('\nSample data point:');
      console.log(JSON.stringify(carData[0], null, 2));
    } else {
      console.log('⚠️  Empty result (might be no data for this session)');
    }
  } catch (error) {
    console.log(`❌ FAILED: ${error.message}`);
  }

  // Test 2: getTeamRadio (with improved error handling)
  console.log('\n\n📻 Test 2: getTeamRadio (Fixed with better error handling)');
  console.log('-'.repeat(60));
  try {
    const sessionKey = '9159'; // 2024 Shanghai GP Race
    const driverNumber = '1'; // Max Verstappen
    
    console.log(`Requesting: session_key=${sessionKey}, driver_number=${driverNumber}`);
    console.log('Expected: Gracefully handles errors, returns empty array if no data');
    
    const teamRadio = await f1Service.getTeamRadio(sessionKey, driverNumber);
    
    if (teamRadio && teamRadio.length > 0) {
      console.log(`✅ SUCCESS: Retrieved ${teamRadio.length} team radio messages`);
      console.log('\nSample radio message:');
      console.log(JSON.stringify(teamRadio[0], null, 2));
    } else {
      console.log('✅ SUCCESS: No team radio data (gracefully returned empty array)');
    }
  } catch (error) {
    console.log(`❌ FAILED: ${error.message}`);
  }

  // Test 3: getDriverInfo (now uses Ergast API)
  console.log('\n\n👤 Test 3: getDriverInfo (Fixed - now uses Ergast API)');
  console.log('-'.repeat(60));
  try {
    const driverId = 'verstappen'; // Max Verstappen
    
    console.log(`Requesting: driverId=${driverId}`);
    console.log('Expected: Uses Ergast API, no session_key needed');
    
    const driverInfo = await f1Service.getDriverInfo(driverId);
    
    if (driverInfo) {
      console.log('✅ SUCCESS: Retrieved driver information');
      console.log('\nDriver details:');
      console.log(JSON.stringify(driverInfo, null, 2));
    } else {
      console.log('⚠️  Driver not found (returned null)');
    }
  } catch (error) {
    console.log(`❌ FAILED: ${error.message}`);
  }

  // Additional test: getDriverInfo with different driver
  console.log('\n\n👤 Test 3b: getDriverInfo - Lewis Hamilton');
  console.log('-'.repeat(60));
  try {
    const driverId = 'hamilton';
    
    console.log(`Requesting: driverId=${driverId}`);
    
    const driverInfo = await f1Service.getDriverInfo(driverId);
    
    if (driverInfo) {
      console.log('✅ SUCCESS: Retrieved driver information');
      console.log(`\nDriver: ${driverInfo.givenName} ${driverInfo.familyName}`);
      console.log(`Number: ${driverInfo.permanentNumber || 'N/A'}`);
      console.log(`Nationality: ${driverInfo.nationality}`);
      console.log(`DOB: ${driverInfo.dateOfBirth}`);
    } else {
      console.log('⚠️  Driver not found');
    }
  } catch (error) {
    console.log(`❌ FAILED: ${error.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Testing Complete!\n');
}

// Run tests
testFixedFunctions().catch(console.error);
