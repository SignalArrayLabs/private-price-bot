import { describe, it, expect } from 'vitest';

describe('Leaderboard Calculations', () => {
  describe('Multiple Calculation', () => {
    it('calculates correct multiple for price increase', () => {
      const callPrice = 100;
      const currentPrice = 250;
      const multiple = currentPrice / callPrice;
      expect(multiple).toBe(2.5);
    });

    it('calculates correct multiple for price decrease', () => {
      const callPrice = 100;
      const currentPrice = 50;
      const multiple = currentPrice / callPrice;
      expect(multiple).toBe(0.5);
    });

    it('calculates correct multiple for no change', () => {
      const callPrice = 100;
      const currentPrice = 100;
      const multiple = currentPrice / callPrice;
      expect(multiple).toBe(1);
    });

    it('handles very small call prices', () => {
      const callPrice = 0.00001;
      const currentPrice = 0.0001;
      const multiple = currentPrice / callPrice;
      expect(multiple).toBe(10);
    });
  });

  describe('Average Multiple Calculation', () => {
    it('calculates average multiple correctly', () => {
      const multiples = [2, 3, 5, 1.5, 0.5];
      const average = multiples.reduce((a, b) => a + b, 0) / multiples.length;
      expect(average).toBe(2.4);
    });

    it('handles single multiple', () => {
      const multiples = [3];
      const average = multiples.reduce((a, b) => a + b, 0) / multiples.length;
      expect(average).toBe(3);
    });

    it('returns 0 for empty array', () => {
      const multiples: number[] = [];
      const average = multiples.length > 0
        ? multiples.reduce((a, b) => a + b, 0) / multiples.length
        : 0;
      expect(average).toBe(0);
    });
  });

  describe('Best Multiple Calculation', () => {
    it('finds the best multiple', () => {
      const multiples = [2, 5, 3, 1.5, 0.5];
      const best = Math.max(...multiples);
      expect(best).toBe(5);
    });

    it('handles negative context (all losses)', () => {
      const multiples = [0.5, 0.3, 0.8, 0.1];
      const best = Math.max(...multiples);
      expect(best).toBe(0.8);
    });
  });

  describe('Win Rate Calculation', () => {
    it('calculates win rate correctly', () => {
      const multiples = [2, 0.5, 3, 0.8, 1.5];
      const wins = multiples.filter(m => m >= 1).length;
      const winRate = wins / multiples.length;
      expect(winRate).toBe(0.6); // 3 wins out of 5
    });

    it('handles all wins', () => {
      const multiples = [2, 3, 1.5, 5];
      const wins = multiples.filter(m => m >= 1).length;
      const winRate = wins / multiples.length;
      expect(winRate).toBe(1);
    });

    it('handles all losses', () => {
      const multiples = [0.5, 0.3, 0.8, 0.1];
      const wins = multiples.filter(m => m >= 1).length;
      const winRate = wins / multiples.length;
      expect(winRate).toBe(0);
    });
  });

  describe('Leaderboard Sorting', () => {
    interface LeaderboardEntry {
      userId: number;
      username: string;
      bestMultiple: number;
      avgMultiple: number;
      totalCalls: number;
    }

    it('sorts by best multiple descending', () => {
      const entries: LeaderboardEntry[] = [
        { userId: 1, username: 'user1', bestMultiple: 3, avgMultiple: 2, totalCalls: 5 },
        { userId: 2, username: 'user2', bestMultiple: 10, avgMultiple: 4, totalCalls: 3 },
        { userId: 3, username: 'user3', bestMultiple: 5, avgMultiple: 3, totalCalls: 8 },
      ];

      entries.sort((a, b) => b.bestMultiple - a.bestMultiple);

      expect(entries[0].username).toBe('user2');
      expect(entries[1].username).toBe('user3');
      expect(entries[2].username).toBe('user1');
    });

    it('limits to top 10 entries', () => {
      const entries = Array.from({ length: 15 }, (_, i) => ({
        userId: i + 1,
        username: `user${i + 1}`,
        bestMultiple: Math.random() * 10,
        avgMultiple: Math.random() * 5,
        totalCalls: Math.floor(Math.random() * 20),
      }));

      entries.sort((a, b) => b.bestMultiple - a.bestMultiple);
      const top10 = entries.slice(0, 10);

      expect(top10.length).toBe(10);
    });
  });
});
