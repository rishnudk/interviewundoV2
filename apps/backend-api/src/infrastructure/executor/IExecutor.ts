export interface TestCaseInput {
  id: string;
  input: string;
  expectedOutput: string;
}

export interface TestCaseResult {
  id: string;
  passed: boolean;
  actual: any;
  expected: any;
  runtime: number;
  error: string | null;
}

export interface ExecutionResult {
  passed: boolean;
  passedCases: number;
  totalCases: number;
  results: TestCaseResult[];
  error?: string;
  runtime?: number;
  memory?: number;
}

export interface IExecutor {
  execute(
    submissionId: string,
    code: string,
    testCases: TestCaseInput[],
    timeoutMs?: number,
    files?: Record<string, string>,
  ): Promise<ExecutionResult>;
}
