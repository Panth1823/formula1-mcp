import axios from 'axios';

const ERGAST_BASE = 'https://api.jolpi.ca/ergast/f1';

/**
 * @typedef {Object} TestResult
 * @property {string} name
 * @property {string} endpoint
 * @property {'PASS' | 'FAIL'} status
 * @property {number} [statusCode]
 * @property {string} [dataValidation]
 * @property {string} [error]
 * @property {number} [responseTime]
 * @property {number | string} [dataPoints]
 */

/** @type {TestResult[]} */
const results = [];

/**
 * @param {string} name
 * @param {string} url
 * @param {(data: any) => {valid: boolean, message: string, dataPoints?: number | string}} validator
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

async function runErgastTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ERGAST API - COMPREHENSIVE TESTING');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Test 1: Race Results - 2023 Bahrain GP
  results.push(await testEndpoint(
    '1. Race Results (2023 Bahrain GP)',
    `${ERGAST_BASE}/2023/1/results.json`,
    (data) => {
      if (!data?.MRData?.RaceTable?.Races) {
        return { valid: false, message: 'Invalid response structure' };
      }
      
      const race = data.MRData.RaceTable.Races[0];
      if (!race?.Results || race.Results.length === 0) {
        return { valid: false, message: 'No results found' };
      }
      
      const winner = race.Results[0];
      if (!winner.Driver || !winner.Constructor || winner.position !== '1') {
        return { valid: false, message: 'Invalid winner data' };
      }
      
      const raceName = race.raceName;
      const winnerName = `${winner.Driver.givenName} ${winner.Driver.familyName}`;
      const team = winner.Constructor.name;
      const points = winner.points;
      
      return {
        valid: true,
        message: `${raceName}: Winner: ${winnerName} (${team}), ${points} points`,
        dataPoints: race.Results.length
      };
    }
  ));

  // Test 2: Driver Standings - 2023 Championship
  results.push(await testEndpoint(
    '2. Driver Standings (2023 Final)',
    `${ERGAST_BASE}/2023/driverStandings.json`,
    (data) => {
      if (!data?.MRData?.StandingsTable?.StandingsLists) {
        return { valid: false, message: 'Invalid response structure' };
      }
      
      const standings = data.MRData.StandingsTable.StandingsLists[0];
      if (!standings?.DriverStandings || standings.DriverStandings.length === 0) {
        return { valid: false, message: 'No standings found' };
      }
      
      const champion = standings.DriverStandings[0];
      if (!champion.Driver || champion.position !== '1') {
        return { valid: false, message: 'Invalid champion data' };
      }
      
      const championName = `${champion.Driver.givenName} ${champion.Driver.familyName}`;
      const points = champion.points;
      const wins = champion.wins;
      const totalDrivers = standings.DriverStandings.length;
      
      return {
        valid: true,
        message: `Champion: ${championName} (${points} pts, ${wins} wins), ${totalDrivers} drivers`,
        dataPoints: totalDrivers
      };
    }
  ));

  // Test 3: Constructor Standings - 2023 Championship
  results.push(await testEndpoint(
    '3. Constructor Standings (2023 Final)',
    `${ERGAST_BASE}/2023/constructorStandings.json`,
    (data) => {
      if (!data?.MRData?.StandingsTable?.StandingsLists) {
        return { valid: false, message: 'Invalid response structure' };
      }
      
      const standings = data.MRData.StandingsTable.StandingsLists[0];
      if (!standings?.ConstructorStandings || standings.ConstructorStandings.length === 0) {
        return { valid: false, message: 'No standings found' };
      }
      
      const winner = standings.ConstructorStandings[0];
      if (!winner.Constructor || winner.position !== '1') {
        return { valid: false, message: 'Invalid winner data' };
      }
      
      const teamName = winner.Constructor.name;
      const points = winner.points;
      const wins = winner.wins;
      const totalTeams = standings.ConstructorStandings.length;
      
      return {
        valid: true,
        message: `Champion: ${teamName} (${points} pts, ${wins} wins), ${totalTeams} teams`,
        dataPoints: totalTeams
      };
    }
  ));

  // Test 4: Lap Times - Verstappen's laps in 2023 Bahrain GP
  results.push(await testEndpoint(
    '4. Lap Times (Verstappen - 2023 Bahrain)',
    `${ERGAST_BASE}/2023/1/drivers/max_verstappen/laps.json`,
    (data) => {
      if (!data?.MRData?.RaceTable?.Races) {
        return { valid: false, message: 'Invalid response structure' };
      }
      
      const race = data.MRData.RaceTable.Races[0];
      if (!race?.Laps || race.Laps.length === 0) {
        return { valid: false, message: 'No lap data found' };
      }
      
      const totalLaps = race.Laps.length;
      const firstLap = race.Laps[0];
      const lastLap = race.Laps[race.Laps.length - 1];
      
      if (!firstLap.Timings?.[0]?.time) {
        return { valid: false, message: 'Invalid lap time data' };
      }
      
      // Find fastest lap
      let fastestLap = { lap: '', time: '' };
      let fastestSeconds = Infinity;
      
      race.Laps.forEach((lap) => {
        const timing = lap.Timings?.[0];
        if (timing?.time) {
          const timeStr = timing.time;
          const parts = timeStr.split(':');
          const seconds = parts.length === 2 
            ? parseInt(parts[0]) * 60 + parseFloat(parts[1])
            : parseFloat(timeStr);
          
          if (seconds < fastestSeconds) {
            fastestSeconds = seconds;
            fastestLap = { lap: lap.number, time: timeStr };
          }
        }
      });
      
      return {
        valid: true,
        message: `${totalLaps} laps, Fastest: Lap ${fastestLap.lap} (${fastestLap.time})`,
        dataPoints: totalLaps
      };
    }
  ));

  // Test 5: Race Calendar - 2024 Season
  results.push(await testEndpoint(
    '5. Race Calendar (2024 Season)',
    `${ERGAST_BASE}/2024.json`,
    (data) => {
      if (!data?.MRData?.RaceTable?.Races) {
        return { valid: false, message: 'Invalid response structure' };
      }
      
      const races = data.MRData.RaceTable.Races;
      if (races.length === 0) {
        return { valid: false, message: 'No races found for 2024' };
      }
      
      const opener = races[0];
      const finale = races[races.length - 1];
      
      if (!opener.raceName || !opener.Circuit?.circuitName) {
        return { valid: false, message: 'Invalid race data' };
      }
      
      const openerName = `${opener.raceName} (${opener.Circuit.circuitName})`;
      const finaleName = `${finale.raceName} (${finale.Circuit.circuitName})`;
      
      return {
        valid: true,
        message: `${races.length} races, Opener: ${openerName}, Finale: ${finaleName}`,
        dataPoints: races.length
      };
    }
  ));

  // Test 6: Circuit Info - Monaco
  results.push(await testEndpoint(
    '6. Circuit Info (Monaco)',
    `${ERGAST_BASE}/circuits/monaco.json`,
    (data) => {
      if (!data?.MRData?.CircuitTable?.Circuits) {
        return { valid: false, message: 'Invalid response structure' };
      }
      
      const circuit = data.MRData.CircuitTable.Circuits[0];
      if (!circuit) {
        return { valid: false, message: 'Circuit not found' };
      }
      
      if (!circuit.circuitName || !circuit.Location) {
        return { valid: false, message: 'Missing circuit details' };
      }
      
      const name = circuit.circuitName;
      const location = `${circuit.Location.locality}, ${circuit.Location.country}`;
      const lat = circuit.Location.lat;
      const long = circuit.Location.long;
      
      return {
        valid: true,
        message: `${name} @ ${location} (${lat}, ${long})`,
        dataPoints: '1 circuit'
      };
    }
  ));

  // Test 7: Seasons List
  results.push(await testEndpoint(
    '7. Season List (Last 10 years)',
    `${ERGAST_BASE}/seasons.json?limit=10&offset=64`,
    (data) => {
      if (!data?.MRData?.SeasonTable?.Seasons) {
        return { valid: false, message: 'Invalid response structure' };
      }
      
      const seasons = data.MRData.SeasonTable.Seasons;
      if (seasons.length === 0) {
        return { valid: false, message: 'No seasons found' };
      }
      
      const latest = seasons[seasons.length - 1];
      const oldest = seasons[0];
      
      if (!latest.season || !oldest.season) {
        return { valid: false, message: 'Invalid season data' };
      }
      
      return {
        valid: true,
        message: `${seasons.length} seasons, Range: ${oldest.season} - ${latest.season}`,
        dataPoints: seasons.length
      };
    }
  ));

  // Test 8: Qualifying Results - 2023 Bahrain GP
  results.push(await testEndpoint(
    '8. Qualifying Results (2023 Bahrain)',
    `${ERGAST_BASE}/2023/1/qualifying.json`,
    (data) => {
      if (!data?.MRData?.RaceTable?.Races) {
        return { valid: false, message: 'Invalid response structure' };
      }
      
      const race = data.MRData.RaceTable.Races[0];
      if (!race?.QualifyingResults || race.QualifyingResults.length === 0) {
        return { valid: false, message: 'No qualifying results found' };
      }
      
      const polePosition = race.QualifyingResults[0];
      if (!polePosition.Driver || polePosition.position !== '1') {
        return { valid: false, message: 'Invalid pole position data' };
      }
      
      const driverName = `${polePosition.Driver.givenName} ${polePosition.Driver.familyName}`;
      const team = polePosition.Constructor.name;
      const q3Time = polePosition.Q3 || 'N/A';
      const totalDrivers = race.QualifyingResults.length;
      
      return {
        valid: true,
        message: `Pole: ${driverName} (${team}) ${q3Time}, ${totalDrivers} drivers`,
        dataPoints: totalDrivers
      };
    }
  ));

  // Test 9: Driver Information - Lewis Hamilton
  results.push(await testEndpoint(
    '9. Driver Info (Lewis Hamilton)',
    `${ERGAST_BASE}/drivers/hamilton.json`,
    (data) => {
      if (!data?.MRData?.DriverTable?.Drivers) {
        return { valid: false, message: 'Invalid response structure' };
      }
      
      const driver = data.MRData.DriverTable.Drivers[0];
      if (!driver) {
        return { valid: false, message: 'Driver not found' };
      }
      
      if (!driver.givenName || !driver.familyName || !driver.nationality) {
        return { valid: false, message: 'Missing driver details' };
      }
      
      const name = `${driver.givenName} ${driver.familyName}`;
      const nationality = driver.nationality;
      const dob = driver.dateOfBirth;
      const number = driver.permanentNumber || 'N/A';
      
      return {
        valid: true,
        message: `${name} (#${number}), ${nationality}, Born: ${dob}`,
        dataPoints: '1 driver'
      };
    }
  ));

  // Test 10: Constructor Information - Mercedes
  results.push(await testEndpoint(
    '10. Constructor Info (Mercedes)',
    `${ERGAST_BASE}/constructors/mercedes.json`,
    (data) => {
      if (!data?.MRData?.ConstructorTable?.Constructors) {
        return { valid: false, message: 'Invalid response structure' };
      }
      
      const constructor = data.MRData.ConstructorTable.Constructors[0];
      if (!constructor) {
        return { valid: false, message: 'Constructor not found' };
      }
      
      if (!constructor.name || !constructor.nationality) {
        return { valid: false, message: 'Missing constructor details' };
      }
      
      const name = constructor.name;
      const nationality = constructor.nationality;
      const url = constructor.url;
      
      return {
        valid: true,
        message: `${name} (${nationality}), URL: ${url ? '✓' : '✗'}`,
        dataPoints: '1 constructor'
      };
    }
  ));

  // Test 11: Pit Stops - 2023 Bahrain GP
  results.push(await testEndpoint(
    '11. Pit Stops (2023 Bahrain GP)',
    `${ERGAST_BASE}/2023/1/pitstops.json`,
    (data) => {
      if (!data?.MRData?.RaceTable?.Races) {
        return { valid: false, message: 'Invalid response structure' };
      }
      
      const race = data.MRData.RaceTable.Races[0];
      if (!race?.PitStops || race.PitStops.length === 0) {
        return { valid: false, message: 'No pit stop data found' };
      }
      
      const pitStops = race.PitStops;
      
      // Find fastest pit stop
      let fastestStop = { driver: '', time: '', duration: Infinity };
      pitStops.forEach((stop) => {
        const duration = parseFloat(stop.duration);
        if (duration < fastestStop.duration) {
          fastestStop = {
            driver: `${stop.driverId}`,
            time: stop.time,
            duration: duration
          };
        }
      });
      
      const avgDuration = (pitStops.reduce((sum, stop) => sum + parseFloat(stop.duration), 0) / pitStops.length).toFixed(3);
      
      return {
        valid: true,
        message: `${pitStops.length} stops, Avg: ${avgDuration}s, Fastest: ${fastestStop.duration.toFixed(3)}s (${fastestStop.driver})`,
        dataPoints: pitStops.length
      };
    }
  ));

  // Test 12: Drivers List - 2024 Season
  results.push(await testEndpoint(
    '12. Drivers List (2024 Season)',
    `${ERGAST_BASE}/2024/drivers.json`,
    (data) => {
      if (!data?.MRData?.DriverTable?.Drivers) {
        return { valid: false, message: 'Invalid response structure' };
      }
      
      const drivers = data.MRData.DriverTable.Drivers;
      if (drivers.length === 0) {
        return { valid: false, message: 'No drivers found for 2024' };
      }
      
      const hasVerstappen = drivers.some((d) => d.driverId === 'max_verstappen');
      const hasHamilton = drivers.some((d) => d.driverId === 'hamilton');
      const hasLeclerc = drivers.some((d) => d.driverId === 'leclerc');
      
      return {
        valid: true,
        message: `${drivers.length} drivers, VER: ${hasVerstappen ? '✓' : '✗'}, HAM: ${hasHamilton ? '✓' : '✗'}, LEC: ${hasLeclerc ? '✓' : '✗'}`,
        dataPoints: drivers.length
      };
    }
  ));

  // Test 13: Circuits List
  results.push(await testEndpoint(
    '13. Circuits List (First 10)',
    `${ERGAST_BASE}/circuits.json?limit=10`,
    (data) => {
      if (!data?.MRData?.CircuitTable?.Circuits) {
        return { valid: false, message: 'Invalid response structure' };
      }
      
      const circuits = data.MRData.CircuitTable.Circuits;
      if (circuits.length === 0) {
        return { valid: false, message: 'No circuits found' };
      }
      
      const hasMonaco = circuits.some((c) => c.circuitId === 'monaco');
      const hasSilverstone = circuits.some((c) => c.circuitId === 'silverstone');
      const hasMonza = circuits.some((c) => c.circuitId === 'monza');
      
      const countries = new Set(circuits.map((c) => c.Location.country));
      
      return {
        valid: true,
        message: `${circuits.length} circuits in ${countries.size} countries, MON: ${hasMonaco ? '✓' : '✗'}, SIL: ${hasSilverstone ? '✓' : '✗'}, MON: ${hasMonza ? '✓' : '✗'}`,
        dataPoints: circuits.length
      };
    }
  ));

  // Test 14: Constructors List - 2024 Season
  results.push(await testEndpoint(
    '14. Constructors List (2024 Season)',
    `${ERGAST_BASE}/2024/constructors.json`,
    (data) => {
      if (!data?.MRData?.ConstructorTable?.Constructors) {
        return { valid: false, message: 'Invalid response structure' };
      }
      
      const constructors = data.MRData.ConstructorTable.Constructors;
      if (constructors.length === 0) {
        return { valid: false, message: 'No constructors found for 2024' };
      }
      
      const hasRedBull = constructors.some((c) => c.constructorId === 'red_bull');
      const hasMercedes = constructors.some((c) => c.constructorId === 'mercedes');
      const hasFerrari = constructors.some((c) => c.constructorId === 'ferrari');
      
      return {
        valid: true,
        message: `${constructors.length} teams, RBR: ${hasRedBull ? '✓' : '✗'}, MER: ${hasMercedes ? '✓' : '✗'}, FER: ${hasFerrari ? '✓' : '✗'}`,
        dataPoints: constructors.length
      };
    }
  ));

  // Summary
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('  ERGAST API - TEST SUMMARY');
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
runErgastTests()
  .then(() => {
    const allPassed = results.every(r => r.status === 'PASS');
    process.exit(allPassed ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
