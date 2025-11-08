import axios from "axios";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

// OpenF1 API base URL
const OPENF1_BASE_URL = "https://api.openf1.org/v1";

// FastF1 API base URL - we'll need to use ergast API as a substitute since FastF1 is Python-only
const FASTF1_BASE_URL = "https://api.jolpi.ca/ergast/f1";

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

  private constructor() {}

  public static getInstance(): F1DataService {
    if (!F1DataService.instance) {
      F1DataService.instance = new F1DataService();
    }
    return F1DataService.instance;
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

    return this.fetchWithErrorHandling<HistoricalSessionData[]>(
      url,
      "Failed to fetch historical sessions",
      true, // Use cache, but maybe with a longer TTL? Default is 5 mins.
      this.defaultCacheTTL
    );
  }

  // OpenF1 API Methods (Live/Recent Data)
  async getLiveTimingData(): Promise<LiveTimingData[]> {
    return this.fetchWithErrorHandling<LiveTimingData[]>(
      `${OPENF1_BASE_URL}/live_timing`,
      "Failed to fetch live timing data",
      true,
      this.liveCacheTTL
    );
  }

  async getCurrentSessionStatus(): Promise<SessionData> {
    return this.fetchWithErrorHandling<SessionData>(
      `${OPENF1_BASE_URL}/session_status`,
      "Failed to fetch session status",
      true,
      this.liveCacheTTL
    );
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
  async getDriverInfo(driverId: string): Promise<any> {
    return this.fetchWithErrorHandling<any>(
      `${OPENF1_BASE_URL}/drivers?driver_number=${driverId}`,
      "Failed to fetch driver info"
    );
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

    return this.fetchWithErrorHandling<WeatherData[]>(
      url,
      "Failed to fetch weather data",
      true,
      this.liveCacheTTL
    );
  }

  async getCarData(
    driverNumber: string,
    sessionKey?: string,
    filters?: string
  ): Promise<CarData[]> {
    let url = `${OPENF1_BASE_URL}/car_data?driver_number=${driverNumber}`;

    if (sessionKey) {
      url += `&session_key=${sessionKey}`;
    }

    if (filters) {
      url += `&${filters}`;
    }

    return this.fetchWithErrorHandling<CarData[]>(
      url,
      "Failed to fetch car telemetry data",
      true,
      this.liveCacheTTL
    );
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

    return this.fetchWithErrorHandling<PitData[]>(
      url,
      "Failed to fetch pit stop data"
    );
  }

  public async getTeamRadio(
    sessionKey: string,
    driverNumber: string
  ): Promise<TeamRadioData[]> {
    try {
      const response = await axios.get(
        `https://api.openf1.org/v1/team_radio?session_key=${sessionKey}&driver_number=${driverNumber}`
      );
      return response.data;
    } catch (error) {
      throw new Error("Failed to fetch team radio messages");
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
    } catch (error) {
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
