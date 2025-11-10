import axios, { AxiosRequestConfig } from "axios";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { openf1Auth } from './openf1-auth.service.js';
import { openf1Stream, OpenF1Topic, LiveDataHandler } from './openf1-stream.service.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

// OpenF1 API base URL
const OPENF1_BASE_URL = config.openf1BaseUrl;

// FastF1 API base URL - we'll need to use ergast API as a substitute since FastF1 is Python-only
const FASTF1_BASE_URL = config.fastf1BaseUrl;

// Simple in-memory cache with TTL
interface CacheItem<T> {
  data: T;
  expiresAt: number;
}

export interface LiveTimingData {
  date: string;
  session_status: string;
  driver_number: string;
  driver_id: string;
  lap_time: number;
  position: number;
  lap_number: number;
  sector_1_time?: number;
  sector_2_time?: number;
  sector_3_time?: number;
}

export interface SessionData {
  session_key: string;
  session_name: string;
  session_type: string;
  start_date: string;
  end_date: string;
  status: string;
}

// Interface for data from /sessions endpoint
export interface HistoricalSessionData {
  circuit_key: number;
  circuit_short_name: string;
  country_code: string;
  country_key: number;
  country_name: string;
  date_end: string;
  date_start: string;
  gmt_offset: string;
  location: string;
  meeting_key: number;
  session_key: number; // This is the key we need
  session_name: string;
  session_type: string;
  year: number;
}

export interface WeatherData {
  air_temperature: number;
  track_temperature: number;
  humidity: number;
  pressure: number;
  wind_direction: number;
  wind_speed: number;
  rainfall: number;
  date: string;
}

export interface CarData {
  brake: number;
  date: string;
  driver_number: number;
  drs: number;
  n_gear: number;
  rpm: number;
  speed: number;
  throttle: number;
}

export interface PitData {
  date: string;
  driver_number: number;
  pit_duration: number | null;
  stop_timestamp: string;
  pit_type: string;
}

export interface TeamRadioData {
  date: string;
  driver_number: number;
  recording_url: string;
}

export interface RaceControlData {
  date: string;
  category: string;
  message: string;
  flag: string | null;
  scope: string | null;
  sector: number | null;
  driver_number: number | null;
}

// Additional interfaces for specific API responses
export interface DetailedTelemetryData extends CarData {
  tyre_compound: string;
  tyre_life: number;
  ers_deployed: number;
  ers_harvested: number;
  fuel_remaining: number;
  track_position: number;
  distance: number;
}

export interface SectorAnalysis {
  driver_number: string;
  sector_number: number;
  sector_time: number;
  personal_best: boolean;
  session_best: boolean;
  lap_number: number;
  compound: string;
  tyre_age: number;
}

export interface TyreStrategyData {
  driver_number: string;
  stint_number: number;
  compound: string;
  laps_on_tyre: number;
  average_time: number;
  degradation: number;
}

export interface TrackPositionData {
  driver_number: string;
  lap_number: number;
  position: number;
  gap_to_leader: number;
  gap_to_ahead: number;
  sector: number;
  timestamp: string;
}

export interface RaceResult {
  Results?: [
    {
      position: string;
      Constructor?: {
        name: string;
      };
      FastestLap?: {
        rank: string;
      };
    }
  ];
  Qualifying?: [
    {
      position: string;
    }
  ];
  date?: string;
}

export interface ChampionshipStanding {
  DriverStandings?: [
    {
      position: string;
    }
  ];
}

export interface CircuitRaceResult {
  season: string;
  Results?: {
    Driver: {
      familyName: string;
    };
    FastestLap?: {
      rank: string;
      Time?: {
        time: string;
      };
    };
  }[];
  QualifyingResults?: {
    Q3: string;
    Driver: {
      familyName: string;
    };
  }[];
}

export interface SeasonRaceResult {
  round: string;
  raceName: string;
  Results: {
    position: string;
    Driver: {
      driverId: string;
      code: string;
      givenName: string;
      familyName: string;
    };
    Constructor: {
      constructorId: string;
      name: string;
    };
    points: string;
  }[];
}

export interface SeasonData {
  MRData: {
    RaceTable: {
      season: string;
      Races: SeasonRaceResult[];
    };
  };
}

export class F1DataService {
  private static instance: F1DataService;
  private cache: Map<string, CacheItem<any>> = new Map();
  private defaultCacheTTL = 5 * 60 * 1000; // 5 minutes in ms
  private liveCacheTTL = 10 * 1000; // 10 seconds for live data
  
  // Live data storage (in-memory for now, could be database)
  private liveDataStore: {
    carData: Map<number, CarData>;
    positions: Map<number, TrackPositionData>;
    raceControl: RaceControlData[];
    teamRadio: TeamRadioData[];
    weather: WeatherData | null;
    sessionInfo: any | null;
  } = {
    carData: new Map(),
    positions: new Map(),
    raceControl: [],
    teamRadio: [],
    weather: null,
    sessionInfo: null,
  };

  private constructor() {
    // Streaming disabled - live data functions will return empty/null
    logger.info('F1DataService initialized (streaming disabled)');
  }

  public static getInstance(): F1DataService {
    if (!F1DataService.instance) {
      F1DataService.instance = new F1DataService();
    }
    return F1DataService.instance;
  }
  
  /**
   * Handle live car data from MQTT
   * Note: Streaming disabled - this handler is not used
   */
  private handleCarData(topic: string, data: any): void {
    if (Array.isArray(data)) {
      data.forEach(car => {
        if (car.driver_number) {
          this.liveDataStore.carData.set(car.driver_number, car);
        }
      });
    } else if (data.driver_number) {
      this.liveDataStore.carData.set(data.driver_number, data);
    }
    logger.debug('Updated live car data', { count: this.liveDataStore.carData.size });
  }
  
  /**
   * Handle live position data from MQTT
   */
  private handlePosition(topic: string, data: any): void {
    if (Array.isArray(data)) {
      data.forEach(pos => {
        if (pos.driver_number) {
          this.liveDataStore.positions.set(pos.driver_number, pos);
        }
      });
    } else if (data.driver_number) {
      this.liveDataStore.positions.set(data.driver_number, data);
    }
    logger.debug('Updated live positions', { count: this.liveDataStore.positions.size });
  }
  
  /**
   * Handle race control messages from MQTT
   */
  private handleRaceControl(topic: string, data: any): void {
    if (Array.isArray(data)) {
      this.liveDataStore.raceControl.push(...data);
    } else {
      this.liveDataStore.raceControl.push(data);
    }
    
    // Keep only last 100 messages
    if (this.liveDataStore.raceControl.length > 100) {
      this.liveDataStore.raceControl = this.liveDataStore.raceControl.slice(-100);
    }
    logger.debug('Updated race control messages', { count: this.liveDataStore.raceControl.length });
  }
  
  /**
   * Handle team radio from MQTT
   */
  private handleTeamRadio(topic: string, data: any): void {
    if (Array.isArray(data)) {
      this.liveDataStore.teamRadio.push(...data);
    } else {
      this.liveDataStore.teamRadio.push(data);
    }
    
    // Keep only last 50 messages
    if (this.liveDataStore.teamRadio.length > 50) {
      this.liveDataStore.teamRadio = this.liveDataStore.teamRadio.slice(-50);
    }
    logger.debug('Updated team radio', { count: this.liveDataStore.teamRadio.length });
  }
  
  /**
   * Handle weather data from MQTT
   */
  private handleWeather(topic: string, data: any): void {
    this.liveDataStore.weather = Array.isArray(data) ? data[0] : data;
    logger.debug('Updated weather data');
  }
  
  /**
   * Handle session info from MQTT
   */
  private handleSessionInfo(topic: string, data: any): void {
    this.liveDataStore.sessionInfo = data;
    logger.debug('Updated session info');
  }

  // Cache helper methods
  private getCachedData<T>(key: string): T | null {
    if (!this.cache.has(key)) {
      return null;
    }

    const cachedItem = this.cache.get(key)!;
    if (Date.now() > cachedItem.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cachedItem.data;
  }

  private setCachedData<T>(
    key: string,
    data: T,
    ttl: number = this.defaultCacheTTL
  ): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  private async fetchWithErrorHandling<T>(
    url: string,
    errorMessage: string,
    useCache: boolean = true,
    cacheTTL?: number
  ): Promise<T> {
    const cacheKey = url;

    if (useCache) {
      const cachedData = this.getCachedData<T>(cacheKey);
      if (cachedData) {
        return cachedData;
      }
    }

    try {
      const response = await axios.get<T>(url);

      if (useCache) {
        this.setCachedData(cacheKey, response.data, cacheTTL);
      }

      return response.data;
    } catch (error: any) {
      console.error(`${errorMessage}:`, error);
      // Preserve the status code in the error message for better handling
      const statusCode = error.response?.status || 0;
      throw new McpError(
        ErrorCode.InternalError,
        `${errorMessage}: ${statusCode}`
      );
    }
  }
  
  /**
   * Fetch data with authentication (for endpoints requiring OAuth2)
   */
  private async fetchWithAuth<T>(
    url: string,
    errorMessage: string,
    useCache: boolean = true,
    cacheTTL?: number
  ): Promise<T> {
    const cacheKey = url;

    if (useCache) {
      const cachedData = this.getCachedData<T>(cacheKey);
      if (cachedData) {
        return cachedData;
      }
    }

    try {
      // Get access token
      const accessToken = await openf1Auth.getAccessToken();
      
      // Make authenticated request
      const axiosConfig: AxiosRequestConfig = {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      };
      
      const response = await axios.get<T>(url, axiosConfig);

      if (useCache) {
        this.setCachedData(cacheKey, response.data, cacheTTL);
      }

      return response.data;
    } catch (error: any) {
      logger.error(errorMessage, { error, url });
      
      // If 401, invalidate token and retry once
      if (error.response?.status === 401) {
        openf1Auth.invalidateToken();
        
        try {
          const accessToken = await openf1Auth.getAccessToken();
          const axiosConfig: AxiosRequestConfig = {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          };
          const response = await axios.get<T>(url, axiosConfig);
          
          if (useCache) {
            this.setCachedData(cacheKey, response.data, cacheTTL);
          }
          
          return response.data;
        } catch (retryError: any) {
          throw new McpError(
            ErrorCode.InternalError,
            `${errorMessage} (retry failed): ${retryError.response?.status || "Unknown error"}`
          );
        }
      }
      
      throw new McpError(
        ErrorCode.InternalError,
        `${errorMessage}: ${error.response?.status || "Unknown error"}`
      );
    }
  }

  // Method to get historical session keys
  async getHistoricalSessions(filters?: {
    year?: number;
    circuit_short_name?: string;
    session_name?: string;
    country_name?: string;
    location?: string;
  }): Promise<HistoricalSessionData[]> {
    let url = `${OPENF1_BASE_URL}/sessions`;
    const params = new URLSearchParams();

    if (filters) {
      if (filters.year) params.append("year", filters.year.toString());
      if (filters.circuit_short_name)
        params.append("circuit_short_name", filters.circuit_short_name);
      if (filters.session_name)
        params.append("session_name", filters.session_name);
      if (filters.country_name)
        params.append("country_name", filters.country_name);
      if (filters.location) params.append("location", filters.location);
    }

    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    try {
      return await this.fetchWithErrorHandling<HistoricalSessionData[]>(
        url,
        "Failed to fetch historical sessions",
        true, // Use cache, but maybe with a longer TTL? Default is 5 mins.
        this.defaultCacheTTL
      );
    } catch (error: any) {
      logger.error('Failed to fetch historical sessions', { url, error: error.message });
      // Return empty array instead of throwing
      return [];
    }
  }

  // OpenF1 API Methods (Live/Recent Data)
  /**
   * Get live timing data
   * If streaming is active, returns from live store; otherwise fetches from REST API
   */
  async getLiveTimingData(): Promise<LiveTimingData[]> {
    // If streaming is active and we have live positions, return them
    if (openf1Stream.isActive() && this.liveDataStore.positions.size > 0) {
      logger.debug('Returning live timing data from stream');
      return Array.from(this.liveDataStore.positions.values()).map(pos => ({
        date: pos.timestamp || new Date().toISOString(),
        session_status: this.liveDataStore.sessionInfo?.status || 'unknown',
        driver_number: String(pos.driver_number),
        driver_id: String(pos.driver_number), // May need mapping
        lap_time: 0, // Would need to track from lap data
        position: pos.position,
        lap_number: pos.lap_number,
      }));
    }
    
    // Fallback to REST API (historical data)
    try {
      return await this.fetchWithErrorHandling<LiveTimingData[]>(
        `${OPENF1_BASE_URL}/live_timing`,
        "Failed to fetch live timing data",
        true,
        this.liveCacheTTL
      );
    } catch (error: any) {
      // Return empty array for 422 (no live data available) instead of throwing
      if (error.message && error.message.includes('422')) {
        logger.debug('No live timing data available (422 - no active session)');
        return [];
      }
      throw error;
    }
  }
  
  /**
   * Get live car telemetry data
   * Note: Streaming disabled - uses REST API only
   */
  async getLiveCarData(): Promise<CarData[]> {
    // Use REST API (streaming disabled)
    logger.debug('Fetching car data from REST API');
    try {
      return await this.fetchWithErrorHandling<CarData[]>(
        `${OPENF1_BASE_URL}/car_data`,
        "Failed to fetch car data",
        true,
        this.liveCacheTTL
      );
    } catch (error: any) {
      // Return empty array for 422 (no live data available) instead of throwing
      if (error.message && error.message.includes('422')) {
        logger.debug('No live car data available (422 - no active session)');
        return [];
      }
      throw error;
    }
  }
  
  /**
   * Get live position data
   * Note: Streaming disabled - uses REST API only
   */
  async getLivePositions(): Promise<TrackPositionData[]> {
    // Use REST API (streaming disabled)
    logger.debug('Fetching positions from REST API');
    try {
      return await this.fetchWithErrorHandling<TrackPositionData[]>(
        `${OPENF1_BASE_URL}/position`,
        "Failed to fetch position data",
        true,
        this.liveCacheTTL
      );
    } catch (error: any) {
      // Return empty array for 422 (no live data available) instead of throwing
      if (error.message && error.message.includes('422')) {
        logger.debug('No live position data available (422 - no active session)');
        return [];
      }
      throw error;
    }
  }
  
  /**
   * Get live race control messages
   * Note: Streaming disabled - uses REST API only
   */
  async getLiveRaceControl(): Promise<RaceControlData[]> {
    // Use REST API (streaming disabled)
    logger.debug('Fetching race control from REST API');
    try {
      return await this.fetchWithErrorHandling<RaceControlData[]>(
        `${OPENF1_BASE_URL}/race_control`,
        "Failed to fetch race control data",
        true,
        this.liveCacheTTL
      );
    } catch (error: any) {
      // Return empty array for 422 (no live data available) instead of throwing
      if (error.message && error.message.includes('422')) {
        logger.debug('No race control data available (422 - no active session)');
        return [];
      }
      throw error;
    }
  }
  
  /**
   * Get live team radio
   * Note: Streaming disabled - uses REST API only
   */
  async getLiveTeamRadio(): Promise<TeamRadioData[]> {
    // Use REST API (streaming disabled)
    logger.debug('Fetching team radio from REST API');
    try {
      return await this.fetchWithErrorHandling<TeamRadioData[]>(
        `${OPENF1_BASE_URL}/team_radio`,
        "Failed to fetch team radio data",
        true,
        this.liveCacheTTL
      );
    } catch (error: any) {
      // Return empty array for 422 (no live data available) instead of throwing
      if (error.message && error.message.includes('422')) {
        logger.debug('No team radio data available (422 - no active session)');
        return [];
      }
      throw error;
    }
  }
  
  /**
   * Get live weather data
   * Note: Streaming disabled - uses REST API only
   */
  async getLiveWeather(): Promise<WeatherData | null> {
    // Use REST API (streaming disabled)
    logger.debug('Fetching weather from REST API');
    try {
      const data = await this.fetchWithErrorHandling<WeatherData[]>(
        `${OPENF1_BASE_URL}/weather`,
        "Failed to fetch weather data",
        true,
        this.liveCacheTTL
      );
      return data.length > 0 ? data[0] : null;
    } catch (error: any) {
      // Return null for 422 (no live data available) instead of throwing
      if (error.message && error.message.includes('422')) {
        logger.debug('No live weather data available (422 - no active session)');
        return null;
      }
      throw error;
    }
  }
  
  async getCurrentSessionStatus(): Promise<SessionData> {
    try {
      return await this.fetchWithErrorHandling<SessionData>(
        `${OPENF1_BASE_URL}/session_status`,
        "Failed to fetch session status",
        true,
        this.liveCacheTTL
      );
    } catch (error: any) {
      // Handle case when no session is active
      if (error.message && (error.message.includes('422') || error.message.includes('404'))) {
        logger.debug('No active session status available');
        // Return empty session data structure
        return {} as SessionData;
      }
      throw error;
    }
  }

  // Historic Data Methods (using Ergast API as FastF1 alternative)
  async getHistoricRaceResults(year: number, round: number): Promise<any> {
    const data = await this.fetchWithErrorHandling<any>(
      `${FASTF1_BASE_URL}/${year}/${round}/results.json`,
      "Failed to fetch historic race results"
    );
    return data.MRData.RaceTable.Races[0];
  }

  async getDriverStandings(year: number): Promise<any> {
    const data = await this.fetchWithErrorHandling<any>(
      `${FASTF1_BASE_URL}/${year}/driverStandings.json`,
      "Failed to fetch driver standings"
    );
    return data.MRData.StandingsTable.StandingsLists[0];
  }

  async getConstructorStandings(year: number): Promise<any> {
    const data = await this.fetchWithErrorHandling<any>(
      `${FASTF1_BASE_URL}/${year}/constructorStandings.json`,
      "Failed to fetch constructor standings"
    );
    return data.MRData.StandingsTable.StandingsLists[0];
  }

  // Additional methods for specific data needs
  // Note: Uses Ergast API for reliable driver information without session context
  // For OpenF1 session-specific driver data, use getHistoricalSessions + filter by driver
  async getDriverInfo(driverId: string): Promise<any> {
    // Use Ergast API for comprehensive driver information
    try {
      const data = await this.fetchWithErrorHandling<any>(
        `${FASTF1_BASE_URL}/drivers/${driverId}.json`,
        "Failed to fetch driver info"
      );
      
      if (!data?.MRData?.DriverTable?.Drivers?.[0]) {
        logger.info(`No driver found with ID: ${driverId}`);
        return null;
      }
      
      return data.MRData.DriverTable.Drivers[0];
    } catch (error: any) {
      logger.warn('Driver info not found, returning null', { driverId, error: error.message });
      return null;
    }
  }

  async getLapTimes(
    year: number,
    round: number,
    driverId: string
  ): Promise<any> {
    const data = await this.fetchWithErrorHandling<any>(
      `${FASTF1_BASE_URL}/${year}/${round}/drivers/${driverId}/laps.json`,
      "Failed to fetch lap times"
    );
    return data.MRData.RaceTable.Races[0];
  }

  // New OpenF1 API methods

  async getWeatherData(sessionKey?: string): Promise<WeatherData[]> {
    const url = sessionKey
      ? `${OPENF1_BASE_URL}/weather?session_key=${sessionKey}`
      : `${OPENF1_BASE_URL}/weather`;

    try {
      return await this.fetchWithErrorHandling<WeatherData[]>(
        url,
        "Failed to fetch weather data",
        true,
        this.liveCacheTTL
      );
    } catch (error: any) {
      // Return empty array for 422 or 404 (no data available) instead of throwing
      if (error.message && (error.message.includes('422') || error.message.includes('404'))) {
        logger.debug('No weather data available for session');
        return [];
      }
      throw error;
    }
  }

  async getCarData(
    driverNumber: string,
    sessionKey?: string,
    filters?: string
  ): Promise<CarData[]> {
    // Car data requires session_key and additional filters to avoid 422 errors
    if (!sessionKey) {
      logger.warn('getCarData: session_key is required to avoid data overload');
      throw new McpError(
        ErrorCode.InvalidRequest,
        "session_key is required for car telemetry data. Car data is too granular without filtering."
      );
    }

    let url = `${OPENF1_BASE_URL}/car_data?driver_number=${driverNumber}&session_key=${sessionKey}`;

    // Add required filter to avoid 422 error - OpenF1 requires some filtering
    if (!filters) {
      // Default: speed>=0 filter (always matches but satisfies API requirement)
      url += '&speed>=0';
      logger.debug('getCarData: Added default speed>=0 filter to satisfy API requirement');
    } else {
      url += `&${filters}`;
    }

    try {
      return await this.fetchWithErrorHandling<CarData[]>(
        url,
        "Failed to fetch car telemetry data",
        true,
        this.liveCacheTTL
      );
    } catch (error: any) {
      // Handle various error cases
      if (error.message && (error.message.includes('422') || error.message.includes('404') || error.message.includes('Too much data'))) {
        logger.warn('Car data request failed. Try specific filters like speed>=300 or lap_number=1', { url });
        return [];
      }
      throw error;
    }
  }

  async getPitStopData(
    sessionKey?: string,
    driverNumber?: string
  ): Promise<PitData[]> {
    let url = `${OPENF1_BASE_URL}/pit`;

    if (sessionKey) {
      url += `?session_key=${sessionKey}`;

      if (driverNumber) {
        url += `&driver_number=${driverNumber}`;
      }
    } else if (driverNumber) {
      url += `?driver_number=${driverNumber}`;
    }

    try {
      return await this.fetchWithErrorHandling<PitData[]>(
        url,
        "Failed to fetch pit stop data"
      );
    } catch (error: any) {
      // Return empty array for 422 or 404 (no data available) instead of throwing
      if (error.message && (error.message.includes('422') || error.message.includes('404'))) {
        logger.debug('No pit stop data available');
        return [];
      }
      throw error;
    }
  }

  public async getTeamRadio(
    sessionKey: string,
    driverNumber?: string
  ): Promise<TeamRadioData[]> {
    if (!sessionKey) {
      logger.warn('getTeamRadio: session_key is required');
      return [];
    }

    try {
      let url = `https://api.openf1.org/v1/team_radio?session_key=${sessionKey}`;
      
      // Add driver filter if provided
      if (driverNumber) {
        url += `&driver_number=${driverNumber}`;
      }
      
      const response = await axios.get(url);
      
      if (!response.data || response.data.length === 0) {
        logger.info('No team radio data available for this session', { sessionKey, driverNumber });
        return [];
      }
      
      return response.data;
    } catch (error: any) {
      // Gracefully handle all error cases
      if (error.response?.status === 422 || error.response?.status === 404 || error.response?.status === 429) {
        logger.debug('Team radio data not available or rate limited', { 
          sessionKey, 
          driverNumber, 
          status: error.response?.status 
        });
        return [];
      }
      
      // For other errors, log but still return empty to avoid breaking client
      logger.warn('Failed to fetch team radio, returning empty array', { 
        error: error.message,
        sessionKey,
        driverNumber
      });
      return [];
    }
  }

  public async getRaceControlMessages(
    sessionKey: string
  ): Promise<RaceControlData[]> {
    try {
      const response = await axios.get(
        `https://api.openf1.org/v1/race_control?session_key=${sessionKey}`
      );
      return response.data;
    } catch (error: any) {
      // Return empty array for 422 or 404 (no data available) instead of throwing
      if (error.response?.status === 422 || error.response?.status === 404) {
        logger.debug('No race control messages available for session');
        return [];
      }
      logger.error('Failed to fetch race control messages', { error: error.message });
      throw new Error("Failed to fetch race control messages");
    }
  }

  // New Ergast API methods

  async getRaceCalendar(year: number): Promise<any> {
    const data = await this.fetchWithErrorHandling<any>(
      `${FASTF1_BASE_URL}/${year}.json`,
      "Failed to fetch race calendar"
    );
    return data.MRData.RaceTable.Races;
  }

  async getCircuitInfo(circuitId: string): Promise<any> {
    const data = await this.fetchWithErrorHandling<any>(
      `${FASTF1_BASE_URL}/circuits/${circuitId}.json`,
      "Failed to fetch circuit information"
    );
    return data.MRData.CircuitTable.Circuits[0];
  }

  async getSeasonList(limit: number = 100): Promise<any> {
    const data = await this.fetchWithErrorHandling<any>(
      `${FASTF1_BASE_URL}/seasons.json?limit=${limit}`,
      "Failed to fetch season list"
    );
    return data.MRData.SeasonTable.Seasons;
  }

  async getQualifyingResults(year: number, round: number): Promise<any> {
    const data = await this.fetchWithErrorHandling<any>(
      `${FASTF1_BASE_URL}/${year}/${round}/qualifying.json`,
      "Failed to fetch qualifying results"
    );
    return data.MRData.RaceTable.Races[0];
  }

  async getDriverInformation(driverId: string): Promise<any> {
    const data = await this.fetchWithErrorHandling<any>(
      `${FASTF1_BASE_URL}/drivers/${driverId}.json`,
      "Failed to fetch driver information"
    );
    if (!data?.MRData?.DriverTable?.Drivers?.[0]) {
      throw new McpError(
        ErrorCode.InternalError,
        "Driver information not found"
      );
    }
    return data.MRData.DriverTable.Drivers[0];
  }

  async getConstructorInformation(constructorId: string): Promise<any> {
    const data = await this.fetchWithErrorHandling<any>(
      `${FASTF1_BASE_URL}/constructors/${constructorId}.json`,
      "Failed to fetch constructor information"
    );
    return data.MRData.ConstructorTable.Constructors[0];
  }

  // Enhanced telemetry methods
  async getDetailedTelemetry(
    driverNumber: string,
    lap: number,
    sessionKey?: string
  ): Promise<DetailedTelemetryData[]> {
    const url = `${OPENF1_BASE_URL}/telemetry?driver_number=${driverNumber}${
      sessionKey ? `&session_key=${sessionKey}` : ""
    }${lap ? `&lap=${lap}` : ""}`;
    return this.fetchWithErrorHandling<DetailedTelemetryData[]>(
      url,
      "Failed to fetch telemetry data",
      true,
      this.liveCacheTTL
    );
  }

  async getSectorAnalysis(
    sessionKey: string,
    sectorNumber?: number
  ): Promise<SectorAnalysis[]> {
    const url = `${OPENF1_BASE_URL}/sector_times?session_key=${sessionKey}${
      sectorNumber ? `&sector=${sectorNumber}` : ""
    }`;
    return this.fetchWithErrorHandling<SectorAnalysis[]>(
      url,
      "Failed to fetch sector analysis",
      true,
      this.liveCacheTTL
    );
  }

  async getTyreStrategy(
    sessionKey: string,
    driverNumber?: string
  ): Promise<TyreStrategyData[]> {
    const url = `${OPENF1_BASE_URL}/tyre_stints?session_key=${sessionKey}${
      driverNumber ? `&driver_number=${driverNumber}` : ""
    }`;
    return this.fetchWithErrorHandling<TyreStrategyData[]>(
      url,
      "Failed to fetch tyre strategy data",
      true,
      this.defaultCacheTTL
    );
  }

  async getTrackPositions(
    sessionKey: string,
    lap?: number
  ): Promise<TrackPositionData[]> {
    const url = `${OPENF1_BASE_URL}/track_positions?session_key=${sessionKey}${
      lap ? `&lap=${lap}` : ""
    }`;
    return this.fetchWithErrorHandling<TrackPositionData[]>(
      url,
      "Failed to fetch track position data",
      true,
      this.liveCacheTTL
    );
  }

  // Method to clear cache
  clearCache(): void {
    this.cache.clear();
  }
}
