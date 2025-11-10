import mqtt from 'mqtt';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { openf1Auth } from './openf1-auth.service.js';

/**
 * MQTT topic subscriptions for OpenF1 live data
 */
export enum OpenF1Topic {
  CAR_DATA = 'cardata.z',
  POSITION = 'position.z',
  RACE_CONTROL = 'race_control_messages',
  TEAM_RADIO = 'team_radio',
  TIMING_DATA = 'timing_data.z',
  TIMING_APP_DATA = 'timing_app_data.z',
  WEATHER_DATA = 'weather_data.z',
  SESSION_INFO = 'session_info',
}

/**
 * Live data event handler callback
 */
export type LiveDataHandler = (topic: string, data: any) => void;

/**
 * OpenF1 Streaming Service
 * Manages MQTT WebSocket connection for real-time F1 data
 * Handles authentication, subscriptions, and message processing
 */
export class OpenF1StreamService {
  private static instance: OpenF1StreamService;
  private mqttClient: mqtt.MqttClient | null = null;
  private isConnecting: boolean = false;
  private isConnected: boolean = false;
  private subscribedTopics: Set<string> = new Set();
  private dataHandlers: Map<string, Set<LiveDataHandler>> = new Map();
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  
  private constructor() {}
  
  /**
   * Get singleton instance
   */
  public static getInstance(): OpenF1StreamService {
    if (!OpenF1StreamService.instance) {
      OpenF1StreamService.instance = new OpenF1StreamService();
    }
    return OpenF1StreamService.instance;
  }
  
  /**
   * Connect to OpenF1 MQTT broker
   */
  public async connect(): Promise<void> {
    // Check if streaming is enabled
    if (!config.mqttEnabled || !config.openf1StreamingEnabled) {
      throw new Error('MQTT streaming not enabled. Set MQTT_ENABLED=true and OPENF1_STREAMING_ENABLED=true');
    }
    
    // Already connected
    if (this.isConnected) {
      logger.debug('Already connected to OpenF1 MQTT broker');
      return;
    }
    
    // Connection in progress
    if (this.isConnecting) {
      logger.debug('Connection to OpenF1 MQTT broker already in progress');
      return;
    }
    
    this.isConnecting = true;
    
    try {
      // Get access token for authentication
      const accessToken = await openf1Auth.getAccessToken();
      
      logger.info('Connecting to OpenF1 MQTT broker', { url: config.mqttUrl });
      
      // Create MQTT client with authentication
      this.mqttClient = mqtt.connect(config.mqttUrl, {
        username: 'openf1',
        password: accessToken,
        protocolVersion: 5, // MQTT 5.0
        reconnectPeriod: 5000, // Auto-reconnect every 5 seconds
        connectTimeout: 30000, // 30 second timeout
        clean: true,
        clientId: `f1-mcp-${Date.now()}`,
      });
      
      // Setup event handlers
      this.setupEventHandlers();
      
      // Wait for connection
      await this.waitForConnection();
      
      logger.info('Successfully connected to OpenF1 MQTT broker');
      this.isConnected = true;
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      
    } catch (error) {
      this.isConnecting = false;
      this.isConnected = false;
      logger.error('Failed to connect to OpenF1 MQTT broker', { error });
      throw error;
    }
  }
  
  /**
   * Wait for MQTT connection to establish
   */
  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.mqttClient) {
        return reject(new Error('MQTT client not initialized'));
      }
      
      const timeout = setTimeout(() => {
        reject(new Error('MQTT connection timeout'));
      }, 30000);
      
      this.mqttClient.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      this.mqttClient.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
  
  /**
   * Setup MQTT event handlers
   */
  private setupEventHandlers(): void {
    if (!this.mqttClient) return;
    
    // Connection established
    this.mqttClient.on('connect', () => {
      logger.info('MQTT connection established');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Re-subscribe to topics after reconnection
      if (this.subscribedTopics.size > 0) {
        this.resubscribeToTopics();
      }
    });
    
    // Message received
    this.mqttClient.on('message', (topic: string, payload: Buffer) => {
      this.handleMessage(topic, payload);
    });
    
    // Connection error
    this.mqttClient.on('error', (error) => {
      logger.error('MQTT connection error', { error });
      
      // Check if authentication error (401)
      if (error.message.includes('401') || error.message.includes('unauthorized')) {
        logger.warn('MQTT authentication failed - invalidating token');
        openf1Auth.invalidateToken();
      }
    });
    
    // Connection closed
    this.mqttClient.on('close', () => {
      logger.info('MQTT connection closed');
      this.isConnected = false;
    });
    
    // Reconnecting
    this.mqttClient.on('reconnect', () => {
      this.reconnectAttempts++;
      logger.info(`MQTT reconnecting (attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);
      
      if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
        logger.error('Max reconnection attempts reached');
        this.disconnect();
      }
    });
    
    // Offline
    this.mqttClient.on('offline', () => {
      logger.warn('MQTT client offline');
      this.isConnected = false;
    });
  }
  
  /**
   * Handle incoming MQTT message
   */
  private handleMessage(topic: string, payload: Buffer): void {
    try {
      // Parse JSON payload (OpenF1 sends JSON)
      const data = JSON.parse(payload.toString());
      
      logger.debug('Received MQTT message', { topic, dataSize: payload.length });
      
      // Call registered handlers for this topic
      const handlers = this.dataHandlers.get(topic);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(topic, data);
          } catch (error) {
            logger.error('Error in data handler', { topic, error });
          }
        });
      }
      
      // Also call wildcard handlers (registered with '*')
      const wildcardHandlers = this.dataHandlers.get('*');
      if (wildcardHandlers) {
        wildcardHandlers.forEach(handler => {
          try {
            handler(topic, data);
          } catch (error) {
            logger.error('Error in wildcard handler', { topic, error });
          }
        });
      }
      
    } catch (error) {
      logger.error('Failed to parse MQTT message', { topic, error });
    }
  }
  
  /**
   * Subscribe to MQTT topic
   */
  public async subscribe(topic: OpenF1Topic | string, handler?: LiveDataHandler): Promise<void> {
    if (!this.isConnected || !this.mqttClient) {
      throw new Error('Not connected to MQTT broker. Call connect() first.');
    }
    
    return new Promise((resolve, reject) => {
      this.mqttClient!.subscribe(topic, { qos: 1 }, (error) => {
        if (error) {
          logger.error('Failed to subscribe to topic', { topic, error });
          reject(error);
        } else {
          logger.info('Subscribed to MQTT topic', { topic });
          this.subscribedTopics.add(topic);
          
          // Register handler if provided
          if (handler) {
            this.addHandler(topic, handler);
          }
          
          resolve();
        }
      });
    });
  }
  
  /**
   * Unsubscribe from MQTT topic
   */
  public async unsubscribe(topic: OpenF1Topic | string): Promise<void> {
    if (!this.mqttClient) {
      throw new Error('MQTT client not initialized');
    }
    
    return new Promise((resolve, reject) => {
      this.mqttClient!.unsubscribe(topic, (error) => {
        if (error) {
          logger.error('Failed to unsubscribe from topic', { topic, error });
          reject(error);
        } else {
          logger.info('Unsubscribed from MQTT topic', { topic });
          this.subscribedTopics.delete(topic);
          this.dataHandlers.delete(topic);
          resolve();
        }
      });
    });
  }
  
  /**
   * Re-subscribe to all topics after reconnection
   */
  private resubscribeToTopics(): void {
    logger.info(`Re-subscribing to ${this.subscribedTopics.size} topics`);
    
    this.subscribedTopics.forEach(topic => {
      this.mqttClient!.subscribe(topic, { qos: 1 }, (error) => {
        if (error) {
          logger.error('Failed to re-subscribe to topic', { topic, error });
        } else {
          logger.debug('Re-subscribed to topic', { topic });
        }
      });
    });
  }
  
  /**
   * Add data handler for topic
   */
  public addHandler(topic: string, handler: LiveDataHandler): void {
    if (!this.dataHandlers.has(topic)) {
      this.dataHandlers.set(topic, new Set());
    }
    this.dataHandlers.get(topic)!.add(handler);
    logger.debug('Added handler for topic', { topic });
  }
  
  /**
   * Remove data handler for topic
   */
  public removeHandler(topic: string, handler: LiveDataHandler): void {
    const handlers = this.dataHandlers.get(topic);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.dataHandlers.delete(topic);
      }
    }
  }
  
  /**
   * Disconnect from MQTT broker
   */
  public async disconnect(): Promise<void> {
    if (!this.mqttClient) {
      logger.debug('No MQTT client to disconnect');
      return;
    }
    
    logger.info('Disconnecting from OpenF1 MQTT broker');
    
    return new Promise((resolve) => {
      this.mqttClient!.end(false, {}, () => {
        logger.info('Disconnected from OpenF1 MQTT broker');
        this.isConnected = false;
        this.mqttClient = null;
        this.subscribedTopics.clear();
        this.dataHandlers.clear();
        resolve();
      });
    });
  }
  
  /**
   * Get connection status
   */
  public getStatus(): {
    connected: boolean;
    connecting: boolean;
    subscribedTopics: string[];
    reconnectAttempts: number;
  } {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      subscribedTopics: Array.from(this.subscribedTopics),
      reconnectAttempts: this.reconnectAttempts,
    };
  }
  
  /**
   * Check if connected
   */
  public isActive(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
export const openf1Stream = OpenF1StreamService.getInstance();
