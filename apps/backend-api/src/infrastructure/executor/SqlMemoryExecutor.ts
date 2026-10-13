import initSqlJs, { type Database } from 'sql.js';
import { logger } from '../../config/logger';
import { IExecutor, TestCaseInput, TestCaseResult, ExecutionResult } from './IExecutor';

const FLOAT_TOLERANCE = 1e-6;

function smartCompare(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (actual == null && expected == null) return true;
  if (actual == null || expected == null) return false;

  if (typeof actual === 'number' && typeof expected === 'number') {
    return Math.abs(actual - expected) < FLOAT_TOLERANCE;
  }

  // Handle case where one is number as string or similar
  if (typeof actual === 'number' && typeof expected === 'string') {
    const parsed = Number(expected);
    if (!isNaN(parsed)) return Math.abs(actual - parsed) < FLOAT_TOLERANCE;
  }
  if (typeof actual === 'string' && typeof expected === 'number') {
    const parsed = Number(actual);
    if (!isNaN(parsed)) return Math.abs(parsed - expected) < FLOAT_TOLERANCE;
  }

  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) return false;
    return actual.every((item, i) => smartCompare(item, expected[i]));
  }

  if (
    typeof actual === 'object' &&
    typeof expected === 'object' &&
    !Array.isArray(actual) &&
    !Array.isArray(expected)
  ) {
    const aKeys = Object.keys(actual as object).sort();
    const eKeys = Object.keys(expected as object).sort();
    if (aKeys.length !== eKeys.length) return false;
    return aKeys.every((k) =>
      smartCompare(
        (actual as Record<string, unknown>)[k],
        (expected as Record<string, unknown>)[k],
      ),
    );
  }

  return false;
}

function sqlResultToObjects(
  results: { columns: string[]; values: unknown[][] }[],
): Record<string, unknown>[] {
  if (results.length === 0) return [];
  const { columns, values } = results[0];
  return values.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      // Normalize column names to lowercase for comparison leniency
      obj[col.toLowerCase()] = row[i];
    });
    return obj;
  });
}

function normalizeExpected(expected: unknown): Record<string, unknown>[] {
  if (Array.isArray(expected)) {
    return expected.map((row) => {
      if (typeof row === 'object' && row !== null) {
        const normalized: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(row)) {
          normalized[k.toLowerCase()] = v;
        }
        return normalized;
      }
      return row;
    });
  }
  return [];
}

export class SqlMemoryExecutor implements IExecutor {
  private sqlInstance: any = null;

  private async getSql() {
    if (!this.sqlInstance) {
      this.sqlInstance = await initSqlJs();
    }
    return this.sqlInstance;
  }

  async execute(
    submissionId: string,
    code: string,
    testCases: TestCaseInput[],
    _timeoutMs: number = 5000,
  ): Promise<ExecutionResult> {
    try {
      const SQL = await this.getSql();
      const results: TestCaseResult[] = [];
      let totalRuntime = 0;
      let overallError: string | null = null;

      const userQuery = code.trim();
      if (!userQuery) {
        return {
          passed: false,
          passedCases: 0,
          totalCases: testCases.length,
          results: [],
          error: 'Syntax Error: Query is empty.',
        };
      }

      for (const tc of testCases) {
        let setupSql = tc.input;
        try {
          const parsed = JSON.parse(tc.input);
          if (typeof parsed === 'string') {
            setupSql = parsed;
          } else if (Array.isArray(parsed)) {
            setupSql = parsed.join('\n');
          }
        } catch {
          // Keep raw string
        }

        let expected: any;
        try {
          expected = JSON.parse(tc.expectedOutput);
        } catch {
          expected = tc.expectedOutput;
        }

        let actual: any = null;
        let testError: string | null = null;
        let runtimeMs = 0;

        const start = process.hrtime.bigint();
        let db: Database | null = null;
        try {
          const activeDb = new SQL.Database();
          db = activeDb;
          // 1. Run schema and seed
          activeDb.run(setupSql);
          // 2. Run user query
          const execRes = activeDb.exec(userQuery);
          actual = sqlResultToObjects(execRes);
        } catch (queryErr: any) {
          testError = queryErr.message || String(queryErr);
          if (!overallError) overallError = testError;
        } finally {
          if (db) {
            try {
              db.close();
            } catch {}
          }
        }
        const end = process.hrtime.bigint();
        runtimeMs = Number(end - start) / 1e6;
        totalRuntime += runtimeMs;

        const normExpected = normalizeExpected(expected);
        const passed = testError === null && smartCompare(actual, normExpected);

        results.push({
          id: tc.id,
          passed,
          actual: actual !== null ? actual : null,
          expected,
          runtime: Number(runtimeMs.toFixed(2)),
          error: testError,
        });
      }

      const passedCases = results.filter((r) => r.passed).length;
      const allPassed = passedCases === testCases.length;

      return {
        passed: allPassed,
        passedCases,
        totalCases: testCases.length,
        results,
        runtime: Number(totalRuntime.toFixed(2)),
        error: overallError ?? (allPassed ? undefined : 'Wrong Answer'),
      };
    } catch (err: any) {
      logger.error({ err, submissionId }, 'Unexpected error in SqlMemoryExecutor');
      return {
        passed: false,
        passedCases: 0,
        totalCases: testCases.length,
        results: [],
        error: `Execution Error: ${err.message || String(err)}`,
      };
    }
  }
}
