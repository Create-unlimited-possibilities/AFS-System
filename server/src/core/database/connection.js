/**
 * MongoDB Connection Configuration
 * Provides enhanced connection handling with retry logic, proper error handling,
 * and connection monitoring for MongoDB 7.0.14
 *
 * @author AFS Team
 * @version 1.0.0
 */

import mongoose from 'mongoose';
import logger from '../utils/logger.js';

class MongoDBConnection {
  constructor() {
    this.isConnected = false;
    this.retryAttempts = 0;
    this.maxRetries = parseInt(process.env.MONGO_MAX_RETRIES || '5', 10);
    this.retryDelay = parseInt(process.env.MONGO_RETRY_DELAY || '5000', 10);
    this.connectionPromise = null;
  }

  /**
   * Get MongoDB connection URI from environment
   * @returns {string} MongoDB connection URI
   */
  getUri() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      throw new Error('MONGO_URI environment variable is not set');
    }
    return uri;
  }

  /**
   * Get MongoDB connection options
   * @returns {Object} Mongoose connection options
   */
  getOptions() {
    return {
      // Server settings
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,

      // Retry settings
      retryWrites: true,
      retryReads: true,

      // Pool settings
      maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '10', 10),
      minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE || '2', 10),
      maxIdleTimeMS: 30000,

      // MongoDB 7.0.14 compatibility
      appName: 'AFS-System',

      // Disable deprecated features
      autoIndex: process.env.NODE_ENV !== 'production',
    };
  }

  /**
   * Connect to MongoDB with retry logic
   * @returns {Promise<mongoose.Connection>} Mongoose connection
   */
  async connect() {
    // Return existing connection if already connecting/connected
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // Check if already connected
    if (this.isConnected && mongoose.connection.readyState === 1) {
      return mongoose.connection;
    }

    this.connectionPromise = this._connectWithRetry();

    try {
      await this.connectionPromise;
      return mongoose.connection;
    } finally {
      this.connectionPromise = null;
    }
  }

  /**
   * Internal connection method with retry logic
   * @private
   */
  async _connectWithRetry() {
    const uri = this.getUri();
    const options = this.getOptions();

    logger.info('Attempting MongoDB connection...', {
      uri: uri.replace(/:.*@/, ':****@'),
      attempt: this.retryAttempts + 1,
      maxRetries: this.maxRetries
    });

    while (this.retryAttempts < this.maxRetries) {
      try {
        await mongoose.connect(uri, options);
        this.isConnected = true;
        this.retryAttempts = 0;

        logger.info('MongoDB connected successfully', {
          database: mongoose.connection.name,
          host: mongoose.connection.host,
          port: mongoose.connection.port
        });

        return;
      } catch (error) {
        this.retryAttempts++;

        if (this.retryAttempts >= this.maxRetries) {
          logger.error('MongoDB connection failed after maximum retries', {
            error: error.message,
            retries: this.retryAttempts
          });
          throw new Error(`Failed to connect to MongoDB after ${this.maxRetries} attempts: ${error.message}`);
        }

        const delay = this.retryDelay * this.retryAttempts; // Exponential backoff
        logger.warn(`MongoDB connection failed, retrying in ${delay}ms...`, {
          error: error.message,
          attempt: this.retryAttempts,
          nextRetryIn: `${delay}ms`
        });

        await this._sleep(delay);
      }
    }
  }

  /**
   * Disconnect from MongoDB
   * @returns {Promise<void>}
   */
  async disconnect() {
    try {
      await mongoose.connection.close();
      this.isConnected = false;
      logger.info('MongoDB disconnected');
    } catch (error) {
      logger.error('Error during MongoDB disconnect', { error: error.message });
      throw error;
    }
  }

  /**
   * Setup connection event handlers
   */
  setupEventHandlers() {
    // Connection established
    mongoose.connection.on('connected', () => {
      this.isConnected = true;
      logger.info('MongoDB connection established', {
        database: mongoose.connection.name,
        readyState: mongoose.connection.readyState
      });
    });

    // Connection error
    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error', {
        error: error.message,
        code: error.code
      });
      this.isConnected = false;
    });

    // Connection disconnected
    mongoose.connection.on('disconnected', () => {
      this.isConnected = false;
      logger.warn('MongoDB disconnected', {
        readyState: mongoose.connection.readyState
      });
    });

    // Reconnected
    mongoose.connection.on('reconnected', () => {
      this.isConnected = true;
      this.retryAttempts = 0;
      logger.info('MongoDB reconnected');
    });

    // Connection close
    mongoose.connection.on('close', () => {
      this.isConnected = false;
      logger.info('MongoDB connection closed');
    });

    // Sigterm handling
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, closing MongoDB connection');
      await this.disconnect();
      process.exit(0);
    });

    // Sigint handling
    process.on('SIGINT', async () => {
      logger.info('SIGINT received, closing MongoDB connection');
      await this.disconnect();
      process.exit(0);
    });
  }

  /**
   * Get connection status
   * @returns {Object} Connection status information
   */
  getStatus() {
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];

    return {
      readyState: mongoose.connection.readyState,
      state: states[mongoose.connection.readyState],
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name,
      isAuthenticated: mongoose.connection.readyState === 1
    };
  }

  /**
   * Health check for MongoDB connection
   * @returns {Promise<boolean>} True if connection is healthy
   */
  async healthCheck() {
    try {
      if (mongoose.connection.readyState !== 1) {
        return false;
      }

      // Ping the database
      await mongoose.connection.db.admin().ping();
      return true;
    } catch (error) {
      logger.error('MongoDB health check failed', { error: error.message });
      return false;
    }
  }

  /**
   * Execute database operation with automatic retry
   * @param {Function} operation - Database operation function
   * @param {Object} options - Options for retry behavior
   * @returns {Promise<any>} Result of the operation
   */
  async withRetry(operation, options = {}) {
    const { maxRetries = 3, operationName = 'database operation' } = options;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry validation errors or duplicate key errors
        if (error.name === 'ValidationError' || error.code === 11000) {
          throw error;
        }

        // Retry on network errors
        if (attempt < maxRetries) {
          const delay = this.retryDelay * attempt;
          logger.warn(`${operationName} failed, retrying...`, {
            attempt,
            maxRetries,
            delay: `${delay}ms`,
            error: error.message
          });
          await this._sleep(delay);
        }
      }
    }

    logger.error(`${operationName} failed after ${maxRetries} attempts`, {
      error: lastError.message
    });
    throw lastError;
  }

  /**
   * Sleep utility
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
const mongoDBConnection = new MongoDBConnection();
mongoDBConnection.setupEventHandlers();

export default mongoDBConnection;
