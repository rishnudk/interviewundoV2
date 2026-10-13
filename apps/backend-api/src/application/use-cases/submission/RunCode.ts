import crypto from 'crypto';
import type { IUseCase } from '../../interfaces/IUseCase';
import type { IProblemRepository } from '../../../domain/ports/repositories/IProblemRepository';
import type { IExecutionService } from '../../../domain/ports/services/IExecutionService';
import type { RunCodeDTO } from '@interviewprep/shared-types';
import { NotFoundError } from '../../../domain/errors';

export interface RunCodeInput extends RunCodeDTO {
  userId: string;
}

export interface RunCodeOutput {
  jobId: string;
  status: string;
  passed?: boolean;
  passedCases?: number;
  totalCases?: number;
  error?: string;
  results?: any[];
}

export class RunCode implements IUseCase<RunCodeInput, RunCodeOutput> {
  constructor(
    private readonly problemRepository: IProblemRepository,
    private readonly executionService: IExecutionService,
  ) {}

  async execute(input: RunCodeInput): Promise<RunCodeOutput> {
    // 1. Verify problem exists
    const problem = await this.problemRepository.findById(input.problemId);
    if (!problem) {
      throw new NotFoundError('Problem', input.problemId);
    }

    // 2. Generate a temporary execution job ID
    const jobId = `run-${crypto.randomUUID()}`;

    // 3. Execute directly in-process
    const execResult = await this.executionService.executePlayground({
      submissionId: jobId,
      userId: input.userId,
      problemId: input.problemId,
      code: input.code,
      files: input.files,
      language: input.language,
    });

    return {
      jobId,
      status: execResult.status,
      passed: execResult.passed,
      passedCases: execResult.passedCases,
      totalCases: execResult.totalCases,
      error: execResult.error,
      results: execResult.results,
    };
  }
}
