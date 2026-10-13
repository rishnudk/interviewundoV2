import type { ExecutionResult } from '../../../infrastructure/executor/IExecutor';
import type {
  PlaygroundResult,
  ExecuteSubmissionInput,
} from '../../../infrastructure/executor/CodeExecutionService';

export interface IExecutionService {
  executePlayground(input: ExecuteSubmissionInput): Promise<PlaygroundResult>;
  executeSubmission(input: ExecuteSubmissionInput): Promise<ExecutionResult>;
}
