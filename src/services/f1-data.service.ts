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

// New interfaces for enhanced telemetry and analysis
export interface DetailedTelemetryData extends CarData {
  tyre_compound: string;
  tyre_life: number;
  ers_deployed: number;
  ers_harvested: number;
  fuel_remaining: number;
  track_position: number;
  distance: number;
}

export interface TelemetryDetail {
  lap_times: number[];
  sector_times: number[][];
  speed_trap: number[];
  tire_data: TireData;
  speed?: number;
  tyre_compound?: string;
}

export interface TireData {
  compound: string;
  age: number;
  wear: number;
}

export interface SprintResult {
  position: string;
  Driver: {
    driverId: string;
    code: string;
  };
  Time?: {
    millis: string;
    time: string;
  };
}

export interface TelemetryData {
  driver1_telemetry: TelemetryDetail;
  driver2_telemetry: TelemetryDetail;
  gap_history: number[];
  drs_detection: boolean;
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

export interface LapAnalysisData {
  driver_number: string;
  lap_number: number;
  lap_time: number;
  sector_times: number[];
  speed_trap: number;
  is_personal_best: boolean;
  is_session_best: boolean;
  tyre_compound: string;
  weather_conditions: WeatherData;
  valid_lap: boolean;
}

export interface RaceSimulationData {
  driver_number: string;
  predicted_lap_time: number;
  fuel_corrected_time: number;
  tyre_life_impact: number;
  optimal_pit_window: {
    start_lap: number;
    end_lap: number;
  };
}

export interface DriverPerformanceData {
  driver_number: string;
  sector_performance: {
    sector: number;
    average_time: number;
    best_time: number;
    consistency: number;
  }[];
  tyre_management: {
    compound: string;
    degradation_rate: number;
    average_life: number;
  }[];
  fuel_efficiency: number;
  ers_usage_efficiency: number;
}

export interface BattleAnalysisData {
  driver1: string;
  driver2: string;
  lap_number: number;
  time_delta: number;
  speed_delta: number;
  tyre_age_delta: number;
  drs_advantage: boolean;
  overtake_probability: number;
}

// Additional interfaces for new endpoints
export interface QualifyingData {
  session_type: string;
  track_evolution: number;
  sector_improvements: {
    sector: number;
    time_delta: number;
    driver_number: string;
  }[];
  track_position_impact: number;
}

export interface SprintData {
  MRData: {
    RaceTable: {
      Races: {
        season: string;
        round: string;
        Sprint: {
          SprintResults: SprintResult[];
        };
      }[];
    };
  };
}

export interface DriverCareerData {
  driver_id: string;
  total_races: number;
  wins: number;
  podiums: number;
  poles: number;
  fastest_laps: number;
  championships: number;
  first_race: string;
  last_race: string;
  teams: string[];
}

export interface CircuitRecordData {
  circuit_id: string;
  lap_record: {
    time: string;
    driver: string;
    year: number;
  };
  qualifying_record: {
    time: string;
    driver: string;
    year: number;
  };
  most_wins: {
    driver: string;
    wins: number;
  };
}

export interface RaceStartData {
  driver_number: string;
  grid_position: number;
  reaction_time: number;
  positions_gained: number;
  first_corner_position: number;
}

export interface TyrePerformanceData {
  compound: string;
  optimal_window: {
    min_temp: number;
    max_temp: number;
  };
  current_performance: number;
  wear_rate: number;
  expected_life: number;
  grip_level: number;
}

export interface DRSZoneData {
  zone_number: number;
  detection_point: number;
  activation_point: number;
  deactivation_point: number;
  is_active: boolean;
  drivers_within_detection: string[];
}

export interface ERSDeploymentData {
  driver_number: string;
  lap_number: number;
  total_energy: number;
  deployed_energy: number;
  harvested_energy: number;
  deployment_mode: string;
  battery_charge: number;
  optimal_deployment_points: {
    track_position: number;
    recommended_mode: string;
  }[];
}

export interface CornerAnalysisData {
  corner_number: number;
  entry_speed: number;
  apex_speed: number;
  exit_speed: number;
  entry_throttle: number;
  apex_throttle: number;
  exit_throttle: number;
  brake_pressure: number;
  steering_angle: number;
  gear: number;
  ideal_line: {
    x: number;
    y: number;
  }[];
  driver_line: {
    x: number;
    y: number;
  }[];
  time_loss: number;
  suggestions: string[];
}

export interface TeamRadioAnalysis {
  message_id: string;
  timestamp: string;
  driver_number: string;
  speaker_role: "driver" | "engineer" | "other";
  transcription: string;
  sentiment: "positive" | "neutral" | "negative";
  keywords: string[];
  strategy_implications: string[];
  related_incidents: string[];
}

export interface BattlePredictionData {
  driver1: string;
  driver2: string;
  current_gap: number;
  predicted_gap_next_lap: number;
  overtake_probability_next_lap: number;
  key_factors: {
    factor: string;
    impact: number;
  }[];
  recommended_defense_strategy?: string;
  recommended_attack_strategy?: string;
  drs_opportunity: boolean;
  tire_advantage: number;
}

export interface TirePredictionData {
  driver_number: string;
  compound: string;
  current_lap: number;
  laps_on_tire: number;
  predicted_drop_off: {
    lap_number: number;
    predicted_time_loss: number;
    confidence: number;
  }[];
  optimal_pit_window: {
    earliest_lap: number;
    ideal_lap: number;
    latest_lap: number;
  };
  risk_factors: {
    factor: string;
    severity: "low" | "medium" | "high";
  }[];
}

export interface TeamRadioMessage {
  timestamp: string;
  driver_number: string;
  message: string;
  recording_url: string;
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

  public async getDriverComparison(
    sessionKey: string,
    driver1: string,
    driver2: string,
    lap: number
  ): Promise<TelemetryData> {
    try {
      const response = await axios.get(
        `https://api.openf1.org/v1/driver_comparison?session_key=${sessionKey}&driver1=${driver1}&driver2=${driver2}&lap=${lap}`
      );
      return response.data;
    } catch (error) {
      throw new Error("Failed to fetch driver comparison data");
    }
  }

  // Add new analysis methods
  async getLapAnalysis(
    sessionKey: string,
    driverNumber: string,
    lapNumber: number
  ): Promise<LapAnalysisData> {
    const [lapTiming, weather, telemetry] = await Promise.all([
      this.getLiveTimingData(),
      this.getWeatherData(sessionKey),
      this.getDetailedTelemetry(driverNumber, lapNumber, sessionKey),
    ]);

    // Process and combine the data
    // This is a simplified example - in reality, you'd want to do more sophisticated analysis
    const lapData = lapTiming.find(
      (lt) => lt.driver_number === driverNumber && lt.lap_number === lapNumber
    );

    if (!lapData) {
      throw new McpError(ErrorCode.InternalError, "Lap data not found");
    }

    return {
      driver_number: driverNumber,
      lap_number: lapNumber,
      lap_time: lapData.lap_time,
      sector_times: [
        lapData.sector_1_time || 0,
        lapData.sector_2_time || 0,
        lapData.sector_3_time || 0,
      ],
      speed_trap: Math.max(...telemetry.map((t) => t.speed)),
      is_personal_best: false, // Would need historical data to determine
      is_session_best: false, // Would need comparison with other drivers
      tyre_compound: telemetry[0]?.tyre_compound || "unknown",
      weather_conditions: weather[0],
      valid_lap: true, // Would need additional validation logic
    };
  }

  async getRaceSimulation(
    sessionKey: string,
    driverNumber: string
  ): Promise<RaceSimulationData> {
    const [telemetry, tyreData] = await Promise.all([
      this.getDetailedTelemetry(driverNumber, 0, sessionKey),
      this.getTyreStrategy(sessionKey, driverNumber),
    ]);

    // This would involve complex calculations in reality
    return {
      driver_number: driverNumber,
      predicted_lap_time: 0, // Would need machine learning model
      fuel_corrected_time: 0, // Would need fuel load data
      tyre_life_impact: 0, // Would need historical tyre degradation data
      optimal_pit_window: {
        start_lap: 0,
        end_lap: 0,
      },
    };
  }

  async getDriverPerformance(
    sessionKey: string,
    driverNumber: string
  ): Promise<DriverPerformanceData> {
    const [sectorData, tyreData, telemetry] = await Promise.all([
      this.getSectorAnalysis(sessionKey),
      this.getTyreStrategy(sessionKey, driverNumber),
      this.getDetailedTelemetry(driverNumber, 0, sessionKey),
    ]);

    // This would involve statistical analysis in reality
    return {
      driver_number: driverNumber,
      sector_performance: [1, 2, 3].map((sector) => ({
        sector,
        average_time: 0, // Would need statistical analysis
        best_time: 0,
        consistency: 0,
      })),
      tyre_management: tyreData.map((td) => ({
        compound: td.compound,
        degradation_rate: td.degradation,
        average_life: td.laps_on_tyre,
      })),
      fuel_efficiency: 0, // Would need detailed fuel consumption data
      ers_usage_efficiency: 0, // Would need detailed ERS deployment/harvest data
    };
  }

  async getBattleAnalysis(
    sessionKey: string,
    driver1: string,
    driver2: string,
    lapNumber: number
  ): Promise<BattleAnalysisData> {
    const [positions, telemetry1, telemetry2] = await Promise.all([
      this.getTrackPositions(sessionKey, lapNumber),
      this.getDetailedTelemetry(driver1, lapNumber, sessionKey),
      this.getDetailedTelemetry(driver2, lapNumber, sessionKey),
    ]);

    // This would involve complex battle analytics in reality
    return {
      driver1,
      driver2,
      lap_number: lapNumber,
      time_delta: 0, // Would need precise timing data
      speed_delta: 0, // Would need speed comparison
      tyre_age_delta: 0, // Would need tyre age comparison
      drs_advantage: false, // Would need DRS detection
      overtake_probability: 0, // Would need machine learning prediction
    };
  }

  public async getQualifyingAnalysis(
    sessionKey: string
  ): Promise<QualifyingData> {
    try {
      const response = await axios.get(
        `https://api.openf1.org/v1/qualifying_analysis?session_key=${sessionKey}`
      );
      return response.data;
    } catch (error) {
      throw new Error("Failed to fetch qualifying analysis");
    }
  }

  async getSprintSessionData(
    sessionKey: string,
    driverNumber?: string
  ): Promise<SprintData[]> {
    const url = `${OPENF1_BASE_URL}/sprint${
      sessionKey ? `?session_key=${sessionKey}` : ""
    }${driverNumber ? `&driver_number=${driverNumber}` : ""}`;
    return this.fetchWithErrorHandling<SprintData[]>(
      url,
      "Failed to fetch sprint session data",
      true,
      this.liveCacheTTL
    );
  }

  async getDriverCareerStats(driverId: string): Promise<DriverCareerData> {
    const [driverInfo, raceResults, championshipResults] = await Promise.all([
      this.getDriverInformation(driverId),
      this.fetchWithErrorHandling<any>(
        `${FASTF1_BASE_URL}/drivers/${driverId}/results.json?limit=1000`,
        "Failed to fetch driver race results"
      ),
      this.fetchWithErrorHandling<any>(
        `${FASTF1_BASE_URL}/drivers/${driverId}/driverStandings.json`,
        "Failed to fetch driver championships"
      ),
    ]);

    if (!raceResults?.MRData?.RaceTable?.Races) {
      throw new McpError(ErrorCode.InternalError, "Race results not found");
    }

    const races = raceResults.MRData.RaceTable.Races as RaceResult[];
    const championships = (championshipResults?.MRData?.StandingsTable
      ?.StandingsLists || []) as ChampionshipStanding[];

    // Calculate statistics
    const wins = races.filter(
      (race) => race.Results?.[0]?.position === "1"
    ).length;
    const podiums = races.filter((race) => {
      const position = parseInt(race.Results?.[0]?.position || "0");
      return position >= 1 && position <= 3;
    }).length;
    const poles = races.filter(
      (race) => race.Qualifying?.[0]?.position === "1"
    ).length;
    const fastestLaps = races.filter(
      (race) => race.Results?.[0]?.FastestLap?.rank === "1"
    ).length;
    const championshipWins = championships.filter(
      (standing) => standing.DriverStandings?.[0]?.position === "1"
    ).length;

    // Get unique teams
    const teams = [
      ...new Set(
        races
          .map((race) => race.Results?.[0]?.Constructor?.name)
          .filter((name): name is string => name !== undefined)
      ),
    ];

    return {
      driver_id: driverId,
      total_races: parseInt(raceResults.MRData.total) || 0,
      wins,
      podiums,
      poles,
      fastest_laps: fastestLaps,
      championships: championshipWins,
      first_race: races[0]?.date || "",
      last_race: races[races.length - 1]?.date || "",
      teams,
    };
  }

  async getCircuitRecords(circuitId: string): Promise<CircuitRecordData> {
    const [circuitInfo, raceResults] = await Promise.all([
      this.getCircuitInfo(circuitId),
      this.fetchWithErrorHandling<any>(
        `${FASTF1_BASE_URL}/circuits/${circuitId}/results.json?limit=100`,
        "Failed to fetch circuit results"
      ),
    ]);

    if (!circuitInfo || !raceResults?.MRData?.RaceTable?.Races) {
      throw new McpError(ErrorCode.InternalError, "Circuit data not found");
    }

    const races = raceResults.MRData.RaceTable.Races as CircuitRaceResult[];

    // Find lap record
    let lapRecord = {
      time: "",
      driver: "",
      year: 0,
    };

    // Find qualifying record
    let qualifyingRecord = {
      time: "",
      driver: "",
      year: 0,
    };

    // Find driver with most wins
    const winsByDriver = new Map<string, number>();
    races.forEach((race: CircuitRaceResult) => {
      if (race.Results?.[0]?.Driver) {
        const winner = race.Results[0].Driver.familyName;
        winsByDriver.set(winner, (winsByDriver.get(winner) || 0) + 1);
      }

      // Check for fastest lap
      if (race.Results) {
        race.Results.forEach((result) => {
          if (result.FastestLap?.rank === "1" && result.FastestLap.Time) {
            const lapTime = result.FastestLap.Time.time;
            if (!lapRecord.time || lapTime < lapRecord.time) {
              lapRecord = {
                time: lapTime,
                driver: result.Driver.familyName,
                year: parseInt(race.season),
              };
            }
          }
        });
      }

      // Check for qualifying record
      if (race.QualifyingResults) {
        const poleTime = race.QualifyingResults[0]?.Q3;
        if (
          poleTime &&
          (!qualifyingRecord.time || poleTime < qualifyingRecord.time)
        ) {
          qualifyingRecord = {
            time: poleTime,
            driver: race.QualifyingResults[0].Driver.familyName,
            year: parseInt(race.season),
          };
        }
      }
    });

    let mostWins = {
      driver: "",
      wins: 0,
    };

    winsByDriver.forEach((wins, driver) => {
      if (wins > mostWins.wins) {
        mostWins = { driver, wins };
      }
    });

    return {
      circuit_id: circuitId,
      lap_record: lapRecord,
      qualifying_record: qualifyingRecord,
      most_wins: mostWins,
    };
  }

  async getRaceStartAnalysis(
    sessionKey: string,
    driverNumber?: string
  ): Promise<RaceStartData[]> {
    const url = `${OPENF1_BASE_URL}/race_start${
      sessionKey ? `?session_key=${sessionKey}` : ""
    }${driverNumber ? `&driver_number=${driverNumber}` : ""}`;

    const response = await this.fetchWithErrorHandling<RaceStartData[]>(
      url,
      "Failed to fetch race start analysis",
      true,
      this.liveCacheTTL
    );

    if (!Array.isArray(response)) {
      throw new McpError(
        ErrorCode.InternalError,
        "Invalid race start data format"
      );
    }

    return response.map((data) => ({
      driver_number: data.driver_number || "",
      grid_position: data.grid_position || 0,
      reaction_time: data.reaction_time || 0,
      positions_gained: data.positions_gained || 0,
      first_corner_position: data.first_corner_position || 0,
    }));
  }

  async getTyrePerformance(
    sessionKey: string,
    driverNumber: string,
    compound: string
  ): Promise<TyrePerformanceData> {
    const [tyreData, telemetry] = await Promise.all([
      this.getTyreStrategy(sessionKey, driverNumber),
      this.getDetailedTelemetry(driverNumber, 0, sessionKey),
    ]);

    if (!Array.isArray(tyreData) || tyreData.length === 0) {
      throw new McpError(ErrorCode.InternalError, "No tyre data available");
    }

    // Find data for the specific compound
    const compoundData = tyreData.find(
      (td) => td.compound.toUpperCase() === compound.toUpperCase()
    );
    if (!compoundData) {
      throw new McpError(
        ErrorCode.InternalError,
        `No data available for compound ${compound}`
      );
    }

    // Calculate optimal temperature window based on compound
    const optimalWindow = {
      min_temp:
        compound.toUpperCase() === "SOFT"
          ? 85
          : compound.toUpperCase() === "MEDIUM"
          ? 90
          : 95,
      max_temp:
        compound.toUpperCase() === "SOFT"
          ? 110
          : compound.toUpperCase() === "MEDIUM"
          ? 115
          : 120,
    };

    // Calculate current performance metrics
    const currentPerformance = compoundData.average_time
      ? (1 -
          (compoundData.average_time -
            Math.min(...tyreData.map((td) => td.average_time))) /
            5000) *
        100
      : 0;

    const wearRate = compoundData.degradation || 0;
    const expectedLife = compoundData.laps_on_tyre || 0;
    const gripLevel = currentPerformance * (1 - wearRate / 100);

    return {
      compound,
      optimal_window: optimalWindow,
      current_performance: currentPerformance,
      wear_rate: wearRate,
      expected_life: expectedLife,
      grip_level: gripLevel,
    };
  }

  async getSeasonComparison(
    year1: number,
    year2: number,
    driverId?: string
  ): Promise<{ year1: SeasonRaceResult[]; year2: SeasonRaceResult[] }> {
    const [season1, season2] = await Promise.all([
      this.fetchWithErrorHandling<SeasonData>(
        `${FASTF1_BASE_URL}/${year1}/results.json${
          driverId ? `?driver=${driverId}` : ""
        }`,
        `Failed to fetch ${year1} season data`
      ),
      this.fetchWithErrorHandling<SeasonData>(
        `${FASTF1_BASE_URL}/${year2}/results.json${
          driverId ? `?driver=${driverId}` : ""
        }`,
        `Failed to fetch ${year2} season data`
      ),
    ]);

    if (
      !season1?.MRData?.RaceTable?.Races ||
      !season2?.MRData?.RaceTable?.Races
    ) {
      throw new McpError(ErrorCode.InternalError, "Season data not found");
    }

    return {
      year1: season1.MRData.RaceTable.Races,
      year2: season2.MRData.RaceTable.Races,
    };
  }

  async getDRSZones(sessionKey: string): Promise<DRSZoneData[]> {
    const url = `${OPENF1_BASE_URL}/drs_zones?session_key=${sessionKey}`;
    return this.fetchWithErrorHandling<DRSZoneData[]>(
      url,
      "Failed to fetch DRS zone data"
    );
  }

  async getERSDeployment(
    sessionKey: string,
    driverNumber: string,
    lapNumber?: number
  ): Promise<ERSDeploymentData> {
    let url = `${OPENF1_BASE_URL}/car_data?driver_number=${driverNumber}&type=ers`;

    if (sessionKey) {
      url += `&session_key=${sessionKey}`;
    }

    if (lapNumber) {
      url += `&lap=${lapNumber}`;
    }

    const data = await this.fetchWithErrorHandling<ERSDeploymentData>(
      url,
      "Failed to fetch ERS deployment data",
      true,
      this.liveCacheTTL
    );

    return {
      ...data,
      driver_number: driverNumber,
    };
  }

  async getCornerAnalysis(
    sessionKey: string,
    driverNumber: string,
    cornerNumber: number,
    lapNumber: number
  ): Promise<CornerAnalysisData> {
    let url = `${OPENF1_BASE_URL}/car_data?driver_number=${driverNumber}&corner=${cornerNumber}&lap=${lapNumber}`;

    if (sessionKey) {
      url += `&session_key=${sessionKey}`;
    }

    const data = await this.fetchWithErrorHandling<CornerAnalysisData>(
      url,
      "Failed to fetch corner analysis data",
      true,
      this.liveCacheTTL
    );

    return {
      ...data,
      corner_number: cornerNumber,
    };
  }

  async getTeamRadioAnalysis(
    sessionKey: string,
    driverNumber?: string,
    startTime?: string,
    endTime?: string
  ): Promise<TeamRadioAnalysis[]> {
    let url = `${OPENF1_BASE_URL}/team_radio_analysis?session_key=${sessionKey}`;
    if (driverNumber) url += `&driver_number=${driverNumber}`;
    if (startTime) url += `&start_time=${startTime}`;
    if (endTime) url += `&end_time=${endTime}`;

    return this.fetchWithErrorHandling<TeamRadioAnalysis[]>(
      url,
      "Failed to fetch team radio analysis"
    );
  }

  async getBattlePrediction(
    sessionKey: string,
    driver1: string,
    driver2: string
  ): Promise<BattlePredictionData> {
    let url = `${OPENF1_BASE_URL}/car_data?driver_number=${driver1},${driver2}`;

    if (sessionKey) {
      url += `&session_key=${sessionKey}`;
    }

    const data = await this.fetchWithErrorHandling<BattlePredictionData>(
      url,
      "Failed to fetch battle prediction data",
      true,
      this.liveCacheTTL
    );

    return {
      ...data,
      overtake_probability_next_lap: data.overtake_probability_next_lap || 0,
    };
  }

  async getTirePredictions(
    sessionKey: string,
    driverNumber: string
  ): Promise<TirePredictionData> {
    let url = `${OPENF1_BASE_URL}/car_data?driver_number=${driverNumber}&type=tyres`;

    if (sessionKey) {
      url += `&session_key=${sessionKey}`;
    }

    const data = await this.fetchWithErrorHandling<TirePredictionData>(
      url,
      "Failed to fetch tire prediction data",
      true,
      this.liveCacheTTL
    );

    return {
      ...data,
      predicted_drop_off: data.predicted_drop_off || [],
    };
  }

  // Method to clear cache
  clearCache(): void {
    this.cache.clear();
  }

  public async getSprintResults(
    year: number,
    round: number
  ): Promise<SprintData> {
    try {
      const response = await axios.get(
        `http://ergast.com/api/f1/${year}/${round}/sprint.json`
      );
      return response.data;
    } catch (error) {
      throw new Error("Failed to fetch sprint results");
    }
  }
}
