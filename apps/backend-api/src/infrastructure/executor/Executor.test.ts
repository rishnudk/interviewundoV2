import { describe, it, expect } from 'vitest';
import { JavascriptVmExecutor } from './JavascriptVmExecutor';
import { SqlMemoryExecutor } from './SqlMemoryExecutor';

describe('In-Process Executors (Zero Docker)', () => {
  describe('JavascriptVmExecutor', () => {
    const executor = new JavascriptVmExecutor();

    it('should correctly execute a valid solution and pass test cases', async () => {
      const code = `
        function twoSum(nums, target) {
          const map = new Map();
          for (let i = 0; i < nums.length; i++) {
            const diff = target - nums[i];
            if (map.has(diff)) return [map.get(diff), i];
            map.set(nums[i], i);
          }
          return [];
        }
      `;

      const testCases = [
        { id: '1', input: '[[2, 7, 11, 15], 9]', expectedOutput: '[0, 1]' },
        { id: '2', input: '[[3, 2, 4], 6]', expectedOutput: '[1, 2]' },
      ];

      const result = await executor.execute('test-1', code, testCases);
      expect(result.passed).toBe(true);
      expect(result.passedCases).toBe(2);
      expect(result.totalCases).toBe(2);
      expect(result.results[0].passed).toBe(true);
      expect(result.results[1].passed).toBe(true);
    });

    it('should detect wrong answers', async () => {
      const code = `
        function twoSum(nums, target) {
          return [0, 0];
        }
      `;

      const testCases = [{ id: '1', input: '[[2, 7, 11, 15], 9]', expectedOutput: '[0, 1]' }];

      const result = await executor.execute('test-2', code, testCases);
      expect(result.passed).toBe(false);
      expect(result.passedCases).toBe(0);
      expect(result.results[0].passed).toBe(false);
    });

    it('should handle infinite loops with timeout', async () => {
      const code = `
        function infiniteLoop() {
          while (true) {}
        }
      `;

      const testCases = [{ id: '1', input: '[]', expectedOutput: 'true' }];
      const result = await executor.execute('test-3', code, testCases, 500);
      expect(result.passed).toBe(false);
      expect(result.error).toContain('Time Limit Exceeded');
    });

    it('should handle syntax errors gracefully', async () => {
      const code = `
        function broken( {
      `;

      const testCases = [{ id: '1', input: '[]', expectedOutput: 'true' }];
      const result = await executor.execute('test-4', code, testCases);
      expect(result.passed).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('SqlMemoryExecutor', () => {
    const sqlExecutor = new SqlMemoryExecutor();

    it('should execute SQLite queries in-memory and match results', async () => {
      const setupSql = `
        CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER);
        INSERT INTO users (id, name, age) VALUES (1, 'Alice', 25), (2, 'Bob', 30);
      `;

      const userQuery = 'SELECT name, age FROM users WHERE age > 20 ORDER BY age ASC;';

      const testCases = [
        {
          id: '1',
          input: JSON.stringify(setupSql),
          expectedOutput: JSON.stringify([
            { name: 'Alice', age: 25 },
            { name: 'Bob', age: 30 },
          ]),
        },
      ];

      const result = await sqlExecutor.execute('test-sql-1', userQuery, testCases);
      expect(result.passed).toBe(true);
      expect(result.passedCases).toBe(1);
      expect(result.totalCases).toBe(1);
    });

    it('should catch invalid SQL syntax gracefully', async () => {
      const testCases = [
        {
          id: '1',
          input: 'CREATE TABLE t (id INT);',
          expectedOutput: '[]',
        },
      ];

      const result = await sqlExecutor.execute('test-sql-2', 'SELEC * FROM t', testCases);
      expect(result.passed).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
