import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunCode } from './RunCode';
import { NotFoundError } from '../../../domain/errors';
import type { IProblemRepository } from '../../../domain/ports/repositories/IProblemRepository';
import type { IExecutionService } from '../../../domain/ports/services/IExecutionService';
import type { Problem, Difficulty } from '@interviewprep/shared-types';

describe('RunCode Use Case', () => {
  let problemRepository: IProblemRepository;
  let executionService: IExecutionService;
  let useCase: RunCode;

  const mockProblem: Problem = {
    id: 'problem-123',
    title: 'Two Sum',
    slug: 'two-sum',
    description: 'Find two numbers that add up to a target.',
    difficulty: 'EASY' as Difficulty,
    category: 'JAVASCRIPT' as any,
    starterCode: 'function twoSum() {}',
    createdAt: new Date(),
    updatedAt: new Date(),
    order: 0,
    isPublished: true,
    solvedCount: 0,
    attemptCount: 0,
    tags: [],
  };

  beforeEach(() => {
    problemRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      incrementSolvedCount: vi.fn(),
      incrementAttemptCount: vi.fn(),
    };

    executionService = {
      executePlayground: vi.fn().mockResolvedValue({
        runId: 'run-123',
        status: 'Finished',
        passed: true,
        passedCases: 1,
        totalCases: 1,
        results: [],
      }),
      executeSubmission: vi.fn(),
    };

    useCase = new RunCode(problemRepository, executionService);
  });

  it('should run code successfully in playground mode', async () => {
    const input = {
      problemId: 'problem-123',
      code: 'console.log("hello world");',
      language: 'javascript',
      userId: 'user-456',
    };

    vi.mocked(problemRepository.findById).mockResolvedValue(mockProblem);

    const result = await useCase.execute(input);

    expect(problemRepository.findById).toHaveBeenCalledWith(input.problemId);
    expect(executionService.executePlayground).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: input.userId,
        problemId: input.problemId,
        code: input.code,
        language: input.language,
      }),
    );

    // jobId should start with "run-"
    expect(result.jobId).toMatch(/^run-/);
    expect(result.status).toBe('Finished');
    expect(result.passed).toBe(true);
  });

  it('should throw NotFoundError if problem is not found', async () => {
    const input = {
      problemId: 'non-existent-problem',
      code: 'console.log("hello world");',
      language: 'javascript',
      userId: 'user-456',
    };

    vi.mocked(problemRepository.findById).mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
    await expect(useCase.execute(input)).rejects.toThrow(
      'Problem with identifier "non-existent-problem" was not found',
    );

    expect(problemRepository.findById).toHaveBeenCalledWith(input.problemId);
    expect(executionService.executePlayground).not.toHaveBeenCalled();
  });
});
