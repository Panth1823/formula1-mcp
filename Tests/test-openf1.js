import axios from 'axios';

const OPENF1_BASE = 'https://api.openf1.org/v1';

/**
 * @typedef {Object} TestResult
 * @property {string} name
 * @property {string} endpoint
 * @property {'PASS' | 'FAIL'} status
 * @property {number} [statusCode]
 * @property {string} [dataValidation]
 * @property {string} [error]
 * @property {number} [responseTime]
 * @property {number} [dataPoints]
 */

/** @type {TestResult[]} */
const results = [];

/**
 * @param {string} name
 * @param {string} url
 * @param {(data: any) => {valid: boolean, message: string, dataPoints?: number}} validator
 * @returns {Promise<TestResult>}
 */
async function testEndpoint(name, url, validator) {
  const startTime = Date.now();
  
  try {
    console.log(`\n🔍 Testing: ${name}`);
    console.log(`   URL: ${url}`);
    
    const response = await axios.get(url, { timeout: 15000 });
    const responseTime = Date.now() - startTime;
    
    const validation = validator(response.data);
    
    if (!validation.valid) {
      console.log(`   ❌ FAIL - Validation: ${validation.message}`);
      return {
        name,
        endpoint: url,
        status: 'FAIL',
        statusCode: response.status,
        dataValidation: validation.message,
        responseTime,
        dataPoints: validation.dataPoints
      };
    }
    
    console.log(`   ✅ PASS - ${validation.message}`);
    console.log(`   ⏱️  Response time: ${responseTime}ms`);
    
    return {
      name,
      endpoint: url,
      status: 'PASS',
      statusCode: response.status,
      dataValidation: validation.message,
      responseTime,
      dataPoints: validation.dataPoints
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.log(`   ❌ FAIL - ${error.response?.status || error.message}`);
    
    return {
      name,
      endpoint: url,
      status: 'FAIL',
      error: error.response?.status ? `HTTP ${error.response.status}` : error.message,
      responseTime
    };
  }
}

async function runOpenF1Tests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  OPENF1 API - COMPREHENSIVE TESTING');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Test 1: Sessions - Get 2024 Bahrain GP sessions
  results.push(await testEndpoint(
    '1. Historical Sessions (2024 Bahrain GP)',
    `${OPENF1_BASE}/sessions?year=2024&country_name=Bahrain&session_name=Race`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: false, message: 'No sessions found for 2024 Bahrain Race' };
      
      const session = data[0];
      const hasRequiredFields = session.session_key && session.session_name && session.circuit_short_name;
      
      if (!hasRequiredFields) {
        return { valid: false, message: 'Missing required fields (session_key, session_name, circuit_short_name)' };
      }
      
      return {
        valid: true,
        message: `Found ${data.length} session(s), session_key: ${session.session_key}, circuit: ${session.circuit_short_name}`,
        dataPoints: data.length
      };
    }
  ));

  // Test 2: Weather Data - Real session
  results.push(await testEndpoint(
    '2. Weather Data (2023 Abu Dhabi GP)',
    `${OPENF1_BASE}/weather?session_key=9165`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: false, message: 'No weather data found' };
      
      const sample = data[0];
      const requiredFields = ['air_temperature', 'track_temperature', 'humidity', 'wind_speed'];
      const missingFields = requiredFields.filter(field => sample[field] === undefined);
      
      if (missingFields.length > 0) {
        return { valid: false, message: `Missing fields: ${missingFields.join(', ')}` };
      }
      
      const avgAirTemp = (data.reduce((sum, d) => sum + d.air_temperature, 0) / data.length).toFixed(1);
      const avgTrackTemp = (data.reduce((sum, d) => sum + d.track_temperature, 0) / data.length).toFixed(1);
      
      return {
        valid: true,
        message: `${data.length} readings, Avg Air: ${avgAirTemp}°C, Track: ${avgTrackTemp}°C`,
        dataPoints: data.length
      };
    }
  ));

  // Test 3: Car Telemetry - Verstappen's high speed moments
  results.push(await testEndpoint(
    '3. Car Telemetry (Verstappen #1, speed > 300 km/h)',
    `${OPENF1_BASE}/car_data?session_key=9165&driver_number=1&speed>=300`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: false, message: 'No telemetry data found' };
      
      const sample = data[0];
      const requiredFields = ['speed', 'throttle', 'rpm', 'n_gear', 'brake'];
      const missingFields = requiredFields.filter(field => sample[field] === undefined);
      
      if (missingFields.length > 0) {
        return { valid: false, message: `Missing fields: ${missingFields.join(', ')}` };
      }
      
      const maxSpeed = Math.max(...data.map((d) => d.speed));
      const maxRpm = Math.max(...data.map((d) => d.rpm));
      const avgThrottle = (data.reduce((sum, d) => sum + d.throttle, 0) / data.length).toFixed(1);
      
      return {
        valid: true,
        message: `${data.length} points, Max speed: ${maxSpeed} km/h, Max RPM: ${maxRpm}, Avg throttle: ${avgThrottle}%`,
        dataPoints: data.length
      };
    }
  ));

  // Test 4: Pit Stops - Full race analysis
  results.push(await testEndpoint(
    '4. Pit Stops (2023 Abu Dhabi GP)',
    `${OPENF1_BASE}/pit?session_key=9165`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: false, message: 'No pit stop data found' };
      
      const sample = data[0];
      if (!sample.driver_number || sample.pit_duration === undefined) {
        return { valid: false, message: 'Missing driver_number or pit_duration' };
      }
      
      const validStops = data.filter((d) => d.pit_duration !== null && d.pit_duration > 0);
      
      if (validStops.length === 0) {
        return { valid: false, message: 'No valid pit stops with duration' };
      }
      
      const avgDuration = (validStops.reduce((sum, d) => sum + d.pit_duration, 0) / validStops.length).toFixed(2);
      const fastestStop = Math.min(...validStops.map((d) => d.pit_duration)).toFixed(2);
      
      return {
        valid: true,
        message: `${data.length} stops (${validStops.length} with duration), Avg: ${avgDuration}s, Fastest: ${fastestStop}s`,
        dataPoints: data.length
      };
    }
  ));

  // Test 5: Team Radio - Verstappen communications
  results.push(await testEndpoint(
    '5. Team Radio (Verstappen #1)',
    `${OPENF1_BASE}/team_radio?session_key=9165&driver_number=1`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: false, message: 'No team radio found' };
      
      const sample = data[0];
      if (!sample.recording_url || !sample.date) {
        return { valid: false, message: 'Missing recording_url or date' };
      }
      
      const hasValidUrls = data.every((d) => d.recording_url && d.recording_url.startsWith('http'));
      
      if (!hasValidUrls) {
        return { valid: false, message: 'Some recording URLs are invalid' };
      }
      
      return {
        valid: true,
        message: `${data.length} radio messages, All have valid recording URLs`,
        dataPoints: data.length
      };
    }
  ));

  // Test 6: Race Control Messages
  results.push(await testEndpoint(
    '6. Race Control (2023 Abu Dhabi GP)',
    `${OPENF1_BASE}/race_control?session_key=9165`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: false, message: 'No race control messages' };
      
      const sample = data[0];
      if (!sample.message || !sample.category) {
        return { valid: false, message: 'Missing message or category' };
      }
      
      const flags = data.filter((d) => d.flag);
      const incidents = data.filter((d) => d.category === 'Flag' || d.category === 'SafetyCar');
      
      return {
        valid: true,
        message: `${data.length} messages, ${flags.length} with flags, ${incidents.length} incidents`,
        dataPoints: data.length
      };
    }
  ));

  // Test 7: Drivers - Session participants
  results.push(await testEndpoint(
    '7. Drivers (2023 Abu Dhabi GP)',
    `${OPENF1_BASE}/drivers?session_key=9165`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: false, message: 'No drivers found' };
      
      const sample = data[0];
      if (!sample.driver_number || !sample.name_acronym) {
        return { valid: false, message: 'Missing driver_number or name_acronym' };
      }
      
      const uniqueDrivers = new Set(data.map((d) => d.driver_number));
      const hasVerstappen = data.some((d) => d.driver_number === 1);
      const hasHamilton = data.some((d) => d.driver_number === 44);
      
      return {
        valid: true,
        message: `${uniqueDrivers.size} unique drivers, VER: ${hasVerstappen ? '✓' : '✗'}, HAM: ${hasHamilton ? '✓' : '✗'}`,
        dataPoints: data.length
      };
    }
  ));

  // Test 8: Laps - Verstappen's race pace
  results.push(await testEndpoint(
    '8. Laps (Verstappen #1)',
    `${OPENF1_BASE}/laps?session_key=9165&driver_number=1`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: false, message: 'No lap data found' };
      
      const sample = data[0];
      if (sample.lap_duration === undefined || !sample.lap_number) {
        return { valid: false, message: 'Missing lap_duration or lap_number' };
      }
      
      const validLaps = data.filter((d) => d.lap_duration && d.lap_duration > 0);
      
      if (validLaps.length === 0) {
        return { valid: false, message: 'No valid laps with duration' };
      }
      
      const avgLapTime = (validLaps.reduce((sum, d) => sum + d.lap_duration, 0) / validLaps.length).toFixed(3);
      const fastestLap = Math.min(...validLaps.map((d) => d.lap_duration)).toFixed(3);
      
      return {
        valid: true,
        message: `${data.length} laps, Avg: ${avgLapTime}s, Fastest: ${fastestLap}s`,
        dataPoints: data.length
      };
    }
  ));

  // Test 9: Stints - Tire strategy
  results.push(await testEndpoint(
    '9. Stints/Tire Strategy',
    `${OPENF1_BASE}/stints?session_key=9165`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: false, message: 'No stint data found' };
      
      const sample = data[0];
      if (!sample.compound || sample.stint_number === undefined) {
        return { valid: false, message: 'Missing compound or stint_number' };
      }
      
      const compounds = new Set(data.map((d) => d.compound));
      const drivers = new Set(data.map((d) => d.driver_number));
      const avgStintLaps = (data.reduce((sum, d) => sum + (d.lap_end - d.lap_start), 0) / data.length).toFixed(1);
      
      return {
        valid: true,
        message: `${data.length} stints, ${drivers.size} drivers, ${compounds.size} compounds (${[...compounds].join(', ')}), Avg: ${avgStintLaps} laps`,
        dataPoints: data.length
      };
    }
  ));

  // Test 10: Position - Track position data
  results.push(await testEndpoint(
    '10. Position Data',
    `${OPENF1_BASE}/position?session_key=9165&driver_number=1`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: false, message: 'No position data found' };
      
      const sample = data[0];
      if (sample.position === undefined || !sample.date) {
        return { valid: false, message: 'Missing position or date' };
      }
      
      const positions = data.map((d) => d.position);
      const bestPosition = Math.min(...positions);
      const worstPosition = Math.max(...positions);
      const finalPosition = positions[positions.length - 1];
      
      return {
        valid: true,
        message: `${data.length} position updates, Best: P${bestPosition}, Worst: P${worstPosition}, Final: P${finalPosition}`,
        dataPoints: data.length
      };
    }
  ));

  // Test 11: Meetings - 2024 Season
  results.push(await testEndpoint(
    '11. Meetings (2024 Season)',
    `${OPENF1_BASE}/meetings?year=2024`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: false, message: 'No meetings found for 2024' };
      
      const sample = data[0];
      if (!sample.meeting_name || !sample.country_name) {
        return { valid: false, message: 'Missing meeting_name or country_name' };
      }
      
      const countries = new Set(data.map((d) => d.country_name));
      const hasBahrain = data.some((d) => d.country_name === 'Bahrain');
      const hasAbuDhabi = data.some((d) => d.country_name === 'United Arab Emirates');
      
      return {
        valid: true,
        message: `${data.length} meetings in ${countries.size} countries, Season opener (Bahrain): ${hasBahrain ? '✓' : '✗'}, Finale (Abu Dhabi): ${hasAbuDhabi ? '✓' : '✗'}`,
        dataPoints: data.length
      };
    }
  ));

  // Test 12: Intervals - Live gaps
  results.push(await testEndpoint(
    '12. Intervals (Driver Gaps)',
    `${OPENF1_BASE}/intervals?session_key=9165`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      // Intervals might be empty for some sessions, that's OK
      if (data.length === 0) {
        return { valid: true, message: 'No interval data (may be empty for this session)', dataPoints: 0 };
      }
      
      const sample = data[0];
      if (!sample.driver_number || sample.interval === undefined) {
        return { valid: false, message: 'Missing driver_number or interval' };
      }
      
      return {
        valid: true,
        message: `${data.length} interval measurements recorded`,
        dataPoints: data.length
      };
    }
  ));

  // Summary
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('  OPENF1 API - TEST SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const totalTime = results.reduce((sum, r) => sum + (r.responseTime || 0), 0);
  const avgTime = (totalTime / results.length).toFixed(0);

  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);
  console.log(`⏱️  Average response time: ${avgTime}ms`);
  console.log(`⏱️  Total test time: ${(totalTime / 1000).toFixed(2)}s\n`);

  if (failed > 0) {
    console.log('❌ FAILED TESTS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   - ${r.name}`);
      console.log(`     ${r.error || r.dataValidation}`);
    });
    console.log();
  }

  // Detailed results table
  console.log('📊 DETAILED RESULTS:\n');
  console.log('Test                                    Status  Time(ms)  Data Points  Validation');
  console.log('─'.repeat(100));
  
  results.forEach(r => {
    const name = r.name.padEnd(39);
    const status = r.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
    const time = (r.responseTime || 0).toString().padStart(7);
    const points = (r.dataPoints?.toString() || '-').padStart(11);
    const validation = r.dataValidation || r.error || '-';
    
    console.log(`${name} ${status}  ${time}  ${points}  ${validation.substring(0, 40)}`);
  });

  console.log('\n');
  
  return results;
}

// Run tests
runOpenF1Tests()
  .then(() => {
    const allPassed = results.every(r => r.status === 'PASS');
    process.exit(allPassed ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
