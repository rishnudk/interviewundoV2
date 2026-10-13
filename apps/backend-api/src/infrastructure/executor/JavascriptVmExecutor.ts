import vm from 'node:vm';
import { logger } from '../../config/logger';
import { IExecutor, TestCaseInput, TestCaseResult, ExecutionResult } from './IExecutor';

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a === 'number' && typeof b === 'number' && isNaN(a) && isNaN(b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!keysB.includes(key) || !deepEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

export class JavascriptVmExecutor implements IExecutor {
  /**
   * Helper to extract the primary function or class name from starter/user code
   */
  private extractFunctionName(code: string): string | null {
    const functionMatch = code.match(/function\*?\s+([a-zA-Z0-9_]+)\s*\(/);
    if (functionMatch) return functionMatch[1];

    const classMatch = code.match(/class\s+([a-zA-Z0-9_]+)/);
    if (classMatch) return classMatch[1];

    const constMatch = code.match(/(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*/);
    if (constMatch) return constMatch[1];

    return null;
  }

  async execute(
    submissionId: string,
    code: string,
    testCases: TestCaseInput[],
    timeoutMs: number = 3000,
  ): Promise<ExecutionResult> {
    try {
      const functionName = this.extractFunctionName(code);
      if (!functionName) {
        return {
          passed: false,
          passedCases: 0,
          totalCases: testCases.length,
          results: [],
          error: 'Syntax Error: Could not find any declared functions or classes in your code.',
        };
      }

      // Prepare sandbox context
      const sandbox: Record<string, any> = {
        console: {
          log: () => {},
          error: () => {},
          warn: () => {},
          info: () => {},
        },
        JSON,
        Math,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
        Date,
        Set,
        Map,
        BigInt,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
      };

      const context = vm.createContext(sandbox);

      // Evaluate user code in context
      try {
        const userScript = new vm.Script(code, {
          filename: 'solution.js',
        });
        userScript.runInContext(context, { timeout: timeoutMs });
      } catch (compileErr: any) {
        const errMsg = compileErr.message || String(compileErr);
        const isTimeout =
          errMsg.includes('timed out') || compileErr.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT';
        return {
          passed: false,
          passedCases: 0,
          totalCases: testCases.length,
          results: [],
          error: isTimeout
            ? 'Time Limit Exceeded: Code initialization took too long.'
            : `Compilation Error: ${errMsg}`,
        };
      }

      const targetFn = context[functionName];
      if (typeof targetFn !== 'function') {
        return {
          passed: false,
          passedCases: 0,
          totalCases: testCases.length,
          results: [],
          error: `Runtime Error: "${functionName}" was declared but is not a callable function or constructor.`,
        };
      }

      const results: TestCaseResult[] = [];
      let totalRuntime = 0;
      let overallError: string | null = null;

      for (const tc of testCases) {
        let args: any[];
        let expected: any;

        try {
          args = JSON.parse(tc.input);
          if (!Array.isArray(args)) {
            args = [args];
          }
        } catch {
          args = [tc.input];
        }

        try {
          expected = JSON.parse(tc.expectedOutput);
        } catch {
          expected = tc.expectedOutput;
        }

        let actual: any = null;
        let testError: string | null = null;
        let runtimeMs = 0;

        const start = process.hrtime.bigint();
        try {
          // Run test case invocation with timeout
          const testScript = new vm.Script(`__run_test()`, { filename: 'test_runner.js' });
          context.__test_args = args;
          context.__run_test = () => targetFn(...context.__test_args);

          actual = testScript.runInContext(context, { timeout: timeoutMs });
        } catch (execErr: any) {
          const errMsg = execErr.message || String(execErr);
          if (errMsg.includes('timed out') || execErr.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
            testError = 'Time Limit Exceeded';
            overallError = 'Time Limit Exceeded';
          } else {
            testError = `${execErr.name || 'Error'}: ${errMsg}`;
            if (!overallError) overallError = testError;
          }
        }
        const end = process.hrtime.bigint();
        runtimeMs = Number(end - start) / 1e6;
        totalRuntime += runtimeMs;

        const passed = testError === null && deepEqual(actual, expected);

        results.push({
          id: tc.id,
          passed,
          actual: actual !== undefined ? actual : null,
          expected,
          runtime: Number(runtimeMs.toFixed(2)),
          error: testError,
        });

        // If time limit exceeded, break early
        if (testError === 'Time Limit Exceeded') {
          break;
        }
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
      logger.error({ err, submissionId }, 'Unexpected error in JavascriptVmExecutor');
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
