/**
 * Market Service
 * Responsible for fetching yield data from "the market".
 * Handles both mock data (for hackathons/testing) and a stub for real data.
 */

interface YieldData {
  apy: number;
  source: string;
}

export class MarketService {
  /**
   * Fetches the current live yield APY.
   * If USE_MOCK_MARKET_DATA is true, returns a random value between 3.5% and 8.5%.
   * Otherwise, returns a static stub value.
   */
  static async getLiveYield(): Promise<YieldData> {
    const useMock = process.env.USE_MOCK_MARKET_DATA === 'TRUE';

    if (useMock) {
      // Return random float between 3.5 and 8.5
      // Formula: Math.random() * (max - min) + min
      const min = 3.5;
      const max = 8.5;
      const randomApy = Math.random() * (max - min) + min;
      
      return {
        apy: parseFloat(randomApy.toFixed(2)), // Keep 2 decimal places
        source: 'MockMarket'
      };
    } else {
      // Stub for real market data fetch
      return {
        apy: 4.5,
        source: 'RealMarketStub'
      };
    }
  }
}
