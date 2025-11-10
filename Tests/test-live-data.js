import axios from 'axios';

const OPENF1_BASE = 'https://api.openf1.org/v1';

/**
 * @typedef {Object} TestResult
 * @property {string} name
 * @property {string} endpoint
 * @property {'PASS' | 'FAIL' | 'WARN'} status
 * @property {number} [statusCode]
 * @property {string} [dataValidation]
 * @property {string} [error]
 * @property {number} [responseTime]
 * @property {number} [dataPoints]
 * @property {Object} [details]
 */

/** @type {TestResult[]} */
const results = [];

/**
 * Test an endpoint with validation
 * @param {string} name
 * @param {string} url
 * @param {(data: any) => {valid: boolean, message: string, dataPoints?: number, details?: Object}} validator
 * @param {boolean} allowEmpty - Whether empty data is acceptable
 * @returns {Promise<TestResult>}
 */
async function testEndpoint(name, url, validator, allowEmpty = false) {
  const startTime = Date.now();
  
  try {
    console.log(`\n🔍 Testing: ${name}`);
    console.log(`   URL: ${url}`);
    
    const response = await axios.get(url, { 
      timeout: 20000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'F1-MCP-Server/1.0'
      }
    });
    const responseTime = Date.now() - startTime;
    
    // Check if data is empty
    if (Array.isArray(response.data) && response.data.length === 0 && !allowEmpty) {
      console.log(`   ⚠️  WARN - No data available (may be no live session)`);
      return {
        name,
        endpoint: url,
        status: 'WARN',
        statusCode: response.status,
        dataValidation: 'No data available - likely no active session',
        responseTime,
        dataPoints: 0
      };
    }
    
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
        dataPoints: validation.dataPoints,
        details: validation.details
      };
    }
    
    console.log(`   ✅ PASS - ${validation.message}`);
    console.log(`   ⏱️  Response time: ${responseTime}ms`);
    if (validation.details) {
      console.log(`   📊 Details:`, JSON.stringify(validation.details, null, 2));
    }
    
    return {
      name,
      endpoint: url,
      status: 'PASS',
      statusCode: response.status,
      dataValidation: validation.message,
      responseTime,
      dataPoints: validation.dataPoints,
      details: validation.details
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMsg = error.response?.status 
      ? `HTTP ${error.response.status}: ${error.response.statusText}`
      : error.message;
    
    console.log(`   ❌ FAIL - ${errorMsg}`);
    
    return {
      name,
      endpoint: url,
      status: 'FAIL',
      error: errorMsg,
      responseTime
    };
  }
}

/**
 * Find the most recent session key for testing
 */
async function findRecentSessionKey() {
  try {
    console.log('\n🔎 Finding recent session for testing...');
    
    // Get recent sessions from 2024
    const response = await axios.get(`${OPENF1_BASE}/sessions?year=2024`, { timeout: 10000 });
    
    if (response.data.length === 0) {
      throw new Error('No 2024 sessions found');
    }
    
    // Sort by date descending to get most recent
    const sessions = response.data.sort((a, b) => 
      new Date(b.date_start).getTime() - new Date(a.date_start).getTime()
    );
    
    const recentSession = sessions[0];
    console.log(`   ✓ Found session: ${recentSession.session_name} at ${recentSession.circuit_short_name}`);
    console.log(`   ✓ Session key: ${recentSession.session_key}`);
    console.log(`   ✓ Date: ${recentSession.date_start}`);
    
    return recentSession.session_key.toString();
  } catch (error) {
    console.error(`   ✗ Failed to find recent session: ${error.message}`);
    // Fallback to known session key (2023 Abu Dhabi GP)
    console.log(`   ⚠️  Using fallback session key: 9165 (2023 Abu Dhabi GP)`);
    return '9165';
  }
}

/**
 * Test for latest live timing data
 */
async function testLiveTimingEndpoints() {
  console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║           LIVE TIMING DATA ENDPOINTS TEST                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  // Test 1: Live Timing Data (general endpoint)
  results.push(await testEndpoint(
    '1. Live Timing Data (Current)',
    `${OPENF1_BASE}/live_timing`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: true, message: 'No live timing data (no active session)', dataPoints: 0 };
      
      const sample = data[0];
      const requiredFields = ['driver_number', 'date'];
      const missingFields = requiredFields.filter(field => sample[field] === undefined);
      
      if (missingFields.length > 0) {
        return { valid: false, message: `Missing fields: ${missingFields.join(', ')}` };
      }
      
      const drivers = new Set(data.map(d => d.driver_number));
      
      return {
        valid: true,
        message: `${data.length} timing points for ${drivers.size} driver(s)`,
        dataPoints: data.length,
        details: { uniqueDrivers: drivers.size }
      };
    },
    true
  ));
  
  // Test 2: Session Status
  results.push(await testEndpoint(
    '2. Current Session Status',
    `${OPENF1_BASE}/session_status`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: true, message: 'No active session', dataPoints: 0 };
      
      const sample = data[0];
      if (!sample.date || sample.status === undefined) {
        return { valid: false, message: 'Missing date or status field' };
      }
      
      const latestStatus = data[data.length - 1];
      
      return {
        valid: true,
        message: `Session status: ${latestStatus.status || 'Unknown'}`,
        dataPoints: data.length,
        details: { 
          latestStatus: latestStatus.status,
          lastUpdate: latestStatus.date
        }
      };
    },
    true
  ));
}

/**
 * Test car telemetry endpoints
 */
async function testCarDataEndpoints(sessionKey) {
  console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║             CAR TELEMETRY DATA ENDPOINTS                  ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  // Test 3: Live Car Data (all drivers)
  results.push(await testEndpoint(
    '3. Live Car Telemetry (All Drivers)',
    `${OPENF1_BASE}/car_data?session_key=${sessionKey}`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: true, message: 'No car data available', dataPoints: 0 };
      
      const sample = data[0];
      const requiredFields = ['speed', 'throttle', 'rpm', 'n_gear', 'brake', 'drs', 'driver_number'];
      const missingFields = requiredFields.filter(field => sample[field] === undefined);
      
      if (missingFields.length > 0) {
        return { valid: false, message: `Missing fields: ${missingFields.join(', ')}` };
      }
      
      const drivers = new Set(data.map(d => d.driver_number));
      const maxSpeed = Math.max(...data.map(d => d.speed || 0));
      const maxRpm = Math.max(...data.map(d => d.rpm || 0));
      
      return {
        valid: true,
        message: `${data.length} telemetry points for ${drivers.size} driver(s)`,
        dataPoints: data.length,
        details: {
          drivers: drivers.size,
          maxSpeed: Math.round(maxSpeed),
          maxRpm: maxRpm,
          samplePoint: {
            speed: sample.speed,
            throttle: sample.throttle,
            rpm: sample.rpm,
            gear: sample.n_gear,
            drs: sample.drs
          }
        }
      };
    },
    true
  ));
  
  // Test 4: Specific Driver Car Data (Verstappen #1)
  results.push(await testEndpoint(
    '4. Car Telemetry (Driver #1)',
    `${OPENF1_BASE}/car_data?session_key=${sessionKey}&driver_number=1`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: true, message: 'No data for driver #1', dataPoints: 0 };
      
      const avgSpeed = data.reduce((sum, d) => sum + (d.speed || 0), 0) / data.length;
      const avgThrottle = data.reduce((sum, d) => sum + (d.throttle || 0), 0) / data.length;
      const drsActivations = data.filter(d => d.drs > 10).length;
      
      return {
        valid: true,
        message: `${data.length} telemetry points for driver #1`,
        dataPoints: data.length,
        details: {
          avgSpeed: Math.round(avgSpeed),
          avgThrottle: Math.round(avgThrottle),
          drsActivations
        }
      };
    },
    true
  ));
  
  // Test 5: High-speed telemetry filter
  results.push(await testEndpoint(
    '5. High-Speed Telemetry (>300 km/h)',
    `${OPENF1_BASE}/car_data?session_key=${sessionKey}&speed>=300`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: true, message: 'No high-speed data', dataPoints: 0 };
      
      const drivers = new Set(data.map(d => d.driver_number));
      const maxSpeed = Math.max(...data.map(d => d.speed || 0));
      const topSpeedPoint = data.find(d => d.speed === maxSpeed);
      
      return {
        valid: true,
        message: `${data.length} high-speed points from ${drivers.size} driver(s)`,
        dataPoints: data.length,
        details: {
          maxSpeed: Math.round(maxSpeed),
          topSpeedDriver: topSpeedPoint?.driver_number,
          driversReaching300: drivers.size
        }
      };
    },
    true
  ));
}

/**
 * Test position tracking endpoints
 */
async function testPositionEndpoints(sessionKey) {
  console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║           POSITION TRACKING ENDPOINTS                     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  // Test 6: Position Data (all drivers)
  results.push(await testEndpoint(
    '6. Live Position Data (All Drivers)',
    `${OPENF1_BASE}/position?session_key=${sessionKey}`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: true, message: 'No position data', dataPoints: 0 };
      
      const sample = data[0];
      if (sample.position === undefined || !sample.driver_number) {
        return { valid: false, message: 'Missing position or driver_number' };
      }
      
      const drivers = new Set(data.map(d => d.driver_number));
      const positions = new Set(data.map(d => d.position));
      
      // Get latest positions for each driver
      const latestPositions = new Map();
      data.forEach(d => {
        const existing = latestPositions.get(d.driver_number);
        if (!existing || new Date(d.date) > new Date(existing.date)) {
          latestPositions.set(d.driver_number, d);
        }
      });
      
      const currentGrid = Array.from(latestPositions.values())
        .sort((a, b) => a.position - b.position)
        .slice(0, 5)
        .map(d => `P${d.position}:${d.driver_number}`);
      
      return {
        valid: true,
        message: `${data.length} position updates for ${drivers.size} driver(s)`,
        dataPoints: data.length,
        details: {
          drivers: drivers.size,
          uniquePositions: positions.size,
          top5: currentGrid
        }
      };
    },
    true
  ));
  
  // Test 7: Specific Driver Position (#1)
  results.push(await testEndpoint(
    '7. Position Data (Driver #1)',
    `${OPENF1_BASE}/position?session_key=${sessionKey}&driver_number=1`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: true, message: 'No position data for driver #1', dataPoints: 0 };
      
      const positions = data.map(d => d.position);
      const bestPosition = Math.min(...positions);
      const worstPosition = Math.max(...positions);
      const finalPosition = positions[positions.length - 1];
      
      return {
        valid: true,
        message: `${data.length} position updates for driver #1`,
        dataPoints: data.length,
        details: {
          bestPosition,
          worstPosition,
          finalPosition,
          positionChanges: positions.length
        }
      };
    },
    true
  ));
  
  // Test 8: Intervals (gaps between drivers)
  results.push(await testEndpoint(
    '8. Driver Intervals (Gaps)',
    `${OPENF1_BASE}/intervals?session_key=${sessionKey}`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: true, message: 'No interval data available', dataPoints: 0 };
      
      const sample = data[0];
      if (!sample.driver_number || sample.interval === undefined) {
        return { valid: false, message: 'Missing driver_number or interval' };
      }
      
      // Get latest intervals
      const latestIntervals = new Map();
      data.forEach(d => {
        const existing = latestIntervals.get(d.driver_number);
        if (!existing || new Date(d.date) > new Date(existing.date)) {
          latestIntervals.set(d.driver_number, d);
        }
      });
      
      const closestBattle = Array.from(latestIntervals.values())
        .filter(d => d.interval && d.interval < 2)
        .length;
      
      return {
        valid: true,
        message: `${data.length} interval measurements recorded`,
        dataPoints: data.length,
        details: {
          driversTracked: latestIntervals.size,
          closeBattles: closestBattle
        }
      };
    },
    true
  ));
}

/**
 * Test race control and communications
 */
async function testCommunicationEndpoints(sessionKey) {
  console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║         RACE CONTROL & COMMUNICATIONS ENDPOINTS           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  // Test 9: Race Control Messages
  results.push(await testEndpoint(
    '9. Race Control Messages',
    `${OPENF1_BASE}/race_control?session_key=${sessionKey}`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: true, message: 'No race control messages', dataPoints: 0 };
      
      const sample = data[0];
      if (!sample.message || !sample.category) {
        return { valid: false, message: 'Missing message or category' };
      }
      
      const categories = new Set(data.map(d => d.category));
      const flags = data.filter(d => d.flag);
      const drivers = data.filter(d => d.driver_number);
      
      return {
        valid: true,
        message: `${data.length} race control messages`,
        dataPoints: data.length,
        details: {
          categories: Array.from(categories),
          flagMessages: flags.length,
          driverSpecific: drivers.length
        }
      };
    },
    true
  ));
  
  // Test 10: Team Radio
  results.push(await testEndpoint(
    '10. Team Radio (All Drivers)',
    `${OPENF1_BASE}/team_radio?session_key=${sessionKey}`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: true, message: 'No team radio available', dataPoints: 0 };
      
      const sample = data[0];
      if (!sample.recording_url || !sample.driver_number) {
        return { valid: false, message: 'Missing recording_url or driver_number' };
      }
      
      const drivers = new Set(data.map(d => d.driver_number));
      const hasValidUrls = data.every(d => d.recording_url && d.recording_url.startsWith('http'));
      
      if (!hasValidUrls) {
        return { valid: false, message: 'Some recording URLs are invalid' };
      }
      
      return {
        valid: true,
        message: `${data.length} team radio messages from ${drivers.size} driver(s)`,
        dataPoints: data.length,
        details: {
          drivers: drivers.size,
          allUrlsValid: hasValidUrls,
          sampleUrl: sample.recording_url.substring(0, 50) + '...'
        }
      };
    },
    true
  ));
  
  // Test 11: Team Radio (Specific Driver)
  results.push(await testEndpoint(
    '11. Team Radio (Driver #1)',
    `${OPENF1_BASE}/team_radio?session_key=${sessionKey}&driver_number=1`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: true, message: 'No team radio for driver #1', dataPoints: 0 };
      
      return {
        valid: true,
        message: `${data.length} team radio messages for driver #1`,
        dataPoints: data.length,
        details: {
          firstMessage: data[0].date,
          lastMessage: data[data.length - 1].date
        }
      };
    },
    true
  ));
}

/**
 * Test weather and environmental data
 */
async function testWeatherEndpoints(sessionKey) {
  console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║           WEATHER & ENVIRONMENTAL DATA                    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  // Test 12: Live Weather Data
  results.push(await testEndpoint(
    '12. Live Weather Data',
    `${OPENF1_BASE}/weather?session_key=${sessionKey}`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: true, message: 'No weather data available', dataPoints: 0 };
      
      const sample = data[0];
      const requiredFields = ['air_temperature', 'track_temperature', 'humidity', 'wind_speed', 'pressure'];
      const missingFields = requiredFields.filter(field => sample[field] === undefined);
      
      if (missingFields.length > 0) {
        return { valid: false, message: `Missing fields: ${missingFields.join(', ')}` };
      }
      
      const latest = data[data.length - 1];
      const avgAirTemp = (data.reduce((sum, d) => sum + d.air_temperature, 0) / data.length).toFixed(1);
      const avgTrackTemp = (data.reduce((sum, d) => sum + d.track_temperature, 0) / data.length).toFixed(1);
      
      return {
        valid: true,
        message: `${data.length} weather readings`,
        dataPoints: data.length,
        details: {
          currentAirTemp: latest.air_temperature,
          currentTrackTemp: latest.track_temperature,
          avgAirTemp: parseFloat(avgAirTemp),
          avgTrackTemp: parseFloat(avgTrackTemp),
          humidity: latest.humidity,
          windSpeed: latest.wind_speed,
          rainfall: latest.rainfall
        }
      };
    },
    true
  ));
}

/**
 * Test lap and stint data
 */
async function testLapDataEndpoints(sessionKey) {
  console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║             LAP & STINT DATA ENDPOINTS                    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  // Test 13: Lap Data
  results.push(await testEndpoint(
    '13. Lap Data (All Drivers)',
    `${OPENF1_BASE}/laps?session_key=${sessionKey}`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: true, message: 'No lap data available', dataPoints: 0 };
      
      const sample = data[0];
      if (sample.lap_duration === undefined || !sample.lap_number) {
        return { valid: false, message: 'Missing lap_duration or lap_number' };
      }
      
      const drivers = new Set(data.map(d => d.driver_number));
      const validLaps = data.filter(d => d.lap_duration && d.lap_duration > 0);
      
      if (validLaps.length === 0) {
        return { valid: true, message: `${data.length} laps but no valid lap times`, dataPoints: data.length };
      }
      
      const fastestLap = Math.min(...validLaps.map(d => d.lap_duration));
      const avgLapTime = validLaps.reduce((sum, d) => sum + d.lap_duration, 0) / validLaps.length;
      
      return {
        valid: true,
        message: `${data.length} laps for ${drivers.size} driver(s)`,
        dataPoints: data.length,
        details: {
          drivers: drivers.size,
          validLaps: validLaps.length,
          fastestLap: fastestLap.toFixed(3),
          avgLapTime: avgLapTime.toFixed(3)
        }
      };
    },
    true
  ));
  
  // Test 14: Stints (Tire Strategy)
  results.push(await testEndpoint(
    '14. Stints/Tire Strategy',
    `${OPENF1_BASE}/stints?session_key=${sessionKey}`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: true, message: 'No stint data available', dataPoints: 0 };
      
      const sample = data[0];
      if (!sample.compound || sample.stint_number === undefined) {
        return { valid: false, message: 'Missing compound or stint_number' };
      }
      
      const compounds = new Set(data.map(d => d.compound));
      const drivers = new Set(data.map(d => d.driver_number));
      const avgStintLength = data.reduce((sum, d) => sum + (d.lap_end - d.lap_start), 0) / data.length;
      
      return {
        valid: true,
        message: `${data.length} stints from ${drivers.size} driver(s)`,
        dataPoints: data.length,
        details: {
          drivers: drivers.size,
          compounds: Array.from(compounds),
          avgStintLength: Math.round(avgStintLength)
        }
      };
    },
    true
  ));
  
  // Test 15: Pit Stops
  results.push(await testEndpoint(
    '15. Pit Stop Data',
    `${OPENF1_BASE}/pit?session_key=${sessionKey}`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: true, message: 'No pit stop data', dataPoints: 0 };
      
      const sample = data[0];
      if (!sample.driver_number || sample.pit_duration === undefined) {
        return { valid: false, message: 'Missing driver_number or pit_duration' };
      }
      
      const validStops = data.filter(d => d.pit_duration !== null && d.pit_duration > 0);
      
      if (validStops.length === 0) {
        return { valid: true, message: `${data.length} pit entries but no completed stops`, dataPoints: data.length };
      }
      
      const fastestStop = Math.min(...validStops.map(d => d.pit_duration));
      const avgDuration = validStops.reduce((sum, d) => sum + d.pit_duration, 0) / validStops.length;
      const drivers = new Set(validStops.map(d => d.driver_number));
      
      return {
        valid: true,
        message: `${data.length} pit stops (${validStops.length} completed)`,
        dataPoints: data.length,
        details: {
          completedStops: validStops.length,
          drivers: drivers.size,
          fastestStop: fastestStop.toFixed(2),
          avgDuration: avgDuration.toFixed(2)
        }
      };
    },
    true
  ));
}

/**
 * Test driver and meeting metadata
 */
async function testMetadataEndpoints(sessionKey) {
  console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║           METADATA & INFORMATION ENDPOINTS                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  // Test 16: Drivers in Session
  results.push(await testEndpoint(
    '16. Drivers in Session',
    `${OPENF1_BASE}/drivers?session_key=${sessionKey}`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: false, message: 'No driver data found' };
      
      const sample = data[0];
      if (!sample.driver_number || !sample.name_acronym) {
        return { valid: false, message: 'Missing driver_number or name_acronym' };
      }
      
      const uniqueDrivers = new Set(data.map(d => d.driver_number));
      const teams = new Set(data.map(d => d.team_name).filter(t => t));
      
      return {
        valid: true,
        message: `${uniqueDrivers.size} unique drivers from ${teams.size} team(s)`,
        dataPoints: data.length,
        details: {
          uniqueDrivers: uniqueDrivers.size,
          teams: teams.size,
          sampleDriver: {
            number: sample.driver_number,
            acronym: sample.name_acronym,
            team: sample.team_name
          }
        }
      };
    }
  ));
  
  // Test 17: Meetings (2024 Season)
  results.push(await testEndpoint(
    '17. Meetings/Events (2024)',
    `${OPENF1_BASE}/meetings?year=2024`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: false, message: 'No meetings found for 2024' };
      
      const sample = data[0];
      if (!sample.meeting_name || !sample.country_name) {
        return { valid: false, message: 'Missing meeting_name or country_name' };
      }
      
      const countries = new Set(data.map(d => d.country_name));
      const circuits = new Set(data.map(d => d.circuit_short_name));
      
      return {
        valid: true,
        message: `${data.length} meetings in ${countries.size} countries`,
        dataPoints: data.length,
        details: {
          countries: countries.size,
          circuits: circuits.size,
          firstRace: data[0].meeting_name,
          lastRace: data[data.length - 1].meeting_name
        }
      };
    }
  ));
  
  // Test 18: Sessions for Recent Meeting
  results.push(await testEndpoint(
    '18. Sessions (Latest Meeting)',
    `${OPENF1_BASE}/sessions?year=2024`,
    (data) => {
      if (!Array.isArray(data)) return { valid: false, message: 'Response is not an array' };
      if (data.length === 0) return { valid: false, message: 'No sessions found' };
      
      const sessionTypes = new Set(data.map(d => d.session_name));
      const circuits = new Set(data.map(d => d.circuit_short_name));
      
      // Get most recent session
      const sorted = data.sort((a, b) => 
        new Date(b.date_start).getTime() - new Date(a.date_start).getTime()
      );
      const recent = sorted[0];
      
      return {
        valid: true,
        message: `${data.length} sessions across ${circuits.size} circuit(s)`,
        dataPoints: data.length,
        details: {
          sessionTypes: Array.from(sessionTypes),
          circuits: circuits.size,
          mostRecent: {
            name: recent.session_name,
            circuit: recent.circuit_short_name,
            date: recent.date_start
          }
        }
      };
    }
  ));
}

/**
 * Print comprehensive test summary
 */
function printSummary() {
  console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║              COMPREHENSIVE TEST SUMMARY                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  const totalTime = results.reduce((sum, r) => sum + (r.responseTime || 0), 0);
  const avgTime = (totalTime / results.length).toFixed(0);
  const totalDataPoints = results.reduce((sum, r) => sum + (r.dataPoints || 0), 0);
  
  console.log(`📊 OVERALL RESULTS:`);
  console.log(`   ✅ Passed:  ${passed}/${results.length}`);
  console.log(`   ❌ Failed:  ${failed}/${results.length}`);
  console.log(`   ⚠️  Warning: ${warned}/${results.length} (no live data available)`);
  console.log(`   ⏱️  Average response time: ${avgTime}ms`);
  console.log(`   ⏱️  Total test time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`   📈 Total data points retrieved: ${totalDataPoints.toLocaleString()}\n`);
  
  if (failed > 0) {
    console.log('❌ FAILED TESTS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   - ${r.name}`);
      console.log(`     ${r.error || r.dataValidation}`);
    });
    console.log();
  }
  
  if (warned > 0) {
    console.log('⚠️  WARNINGS (No Live Data):');
    results.filter(r => r.status === 'WARN').forEach(r => {
      console.log(`   - ${r.name}`);
    });
    console.log();
  }
  
  // Detailed results table
  console.log('📋 DETAILED TEST RESULTS:\n');
  console.log('Test                                      Status  Time(ms)  Data Pts  Validation');
  console.log('─'.repeat(105));
  
  results.forEach(r => {
    const name = r.name.padEnd(41);
    const status = r.status === 'PASS' ? '✅ PASS' : r.status === 'WARN' ? '⚠️  WARN' : '❌ FAIL';
    const time = (r.responseTime || 0).toString().padStart(7);
    const points = (r.dataPoints?.toString() || '-').padStart(8);
    const validation = (r.dataValidation || r.error || '-').substring(0, 45);
    
    console.log(`${name} ${status}  ${time}  ${points}  ${validation}`);
  });
  
  // Performance Analysis
  console.log('\n\n📈 PERFORMANCE ANALYSIS:\n');
  const passedTests = results.filter(r => r.status === 'PASS' && r.responseTime);
  if (passedTests.length > 0) {
    const sorted = passedTests.sort((a, b) => (b.responseTime || 0) - (a.responseTime || 0));
    const fastest = sorted[sorted.length - 1];
    const slowest = sorted[0];
    
    console.log(`   ⚡ Fastest endpoint: ${fastest.name} (${fastest.responseTime}ms)`);
    console.log(`   🐌 Slowest endpoint: ${slowest.name} (${slowest.responseTime}ms)`);
    console.log(`   📊 Median response time: ${sorted[Math.floor(sorted.length / 2)].responseTime}ms`);
  }
  
  // Data Richness Analysis
  console.log('\n📊 DATA RICHNESS ANALYSIS:\n');
  const dataTests = results.filter(r => r.status === 'PASS' && r.dataPoints);
  if (dataTests.length > 0) {
    const sorted = dataTests.sort((a, b) => (b.dataPoints || 0) - (a.dataPoints || 0));
    const richest = sorted.slice(0, 3);
    
    console.log('   Top 3 data-rich endpoints:');
    richest.forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.name}: ${r.dataPoints?.toLocaleString()} data points`);
    });
  }
  
  console.log('\n');
}

/**
 * Main test runner
 */
async function runLiveDataTests() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   F1 MCP SERVER - COMPREHENSIVE LIVE DATA ENDPOINT TEST   ║');
  console.log('║                     OpenF1 API v1                         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  console.log(`Started: ${new Date().toISOString()}\n`);
  
  try {
    // Find recent session for testing
    const sessionKey = await findRecentSessionKey();
    
    // Run all test suites
    await testLiveTimingEndpoints();
    await testCarDataEndpoints(sessionKey);
    await testPositionEndpoints(sessionKey);
    await testCommunicationEndpoints(sessionKey);
    await testWeatherEndpoints(sessionKey);
    await testLapDataEndpoints(sessionKey);
    await testMetadataEndpoints(sessionKey);
    
    // Print comprehensive summary
    printSummary();
    
    console.log(`Completed: ${new Date().toISOString()}\n`);
    
    // Exit with appropriate code
    const failed = results.filter(r => r.status === 'FAIL').length;
    process.exit(failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Test suite failed with error:', error);
    process.exit(1);
  }
}

// Run the comprehensive test suite
runLiveDataTests();
