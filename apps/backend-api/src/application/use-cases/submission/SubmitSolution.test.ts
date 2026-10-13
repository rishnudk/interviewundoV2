import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubmitSolution } from './SubmitSolution';
import { NotFoundError } from '../../../domain/errors';
import type { ISubmissionRepository } from '../../../domain/ports/repositories/ISubmissionRepository';
import type { IProblemRepository } from '../../../domain/ports/repositories/IProblemRepository';
import type { IExecutionService } from '../../../domain/ports/services/IExecutionService';
import type { INotificationService } from '../../../domain/ports/services/INotificationService';
import type {
  Problem,
  Submission,
  Difficulty,
  SubmissionStatus,
} from '@interviewprep/shared-types';

describe('SubmitSolution Use Case', () => {
  let submissionRepository: ISubmissionRepository;
  let problemRepository: IProblemRepository;
  let executionService: IExecutionService;
  let notificationService: INotificationService;
  let useCase: SubmitSolution;

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

  const mockSubmission: Submission = {
    id: 'submission-789',
    userId: 'user-456',
    problemId: 'problem-123',
    code: 'console.log("hello world");',
    language: 'javascript',
    status: 'PENDING' as SubmissionStatus,
    createdAt: new Date(),
  };

  const mockFinishedSubmission: Submission = {
    ...mockSubmission,
    status: 'ACCEPTED' as SubmissionStatus,
  };

  beforeEach(() => {
    submissionRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByUser: vi.fn(),
      findByUserAndProblem: vi.fn(),
      updateStatus: vi.fn(),
      createResult: vi.fn(),
      countByUser: vi.fn(),
      countSolvedByUser: vi.fn(),
      countAcceptedByUser: vi.fn(),
      getSolvedProblemsDifficultyByUser: vi.fn(),
      getSolvedProblemsCategoryByUser: vi.fn(),
      getRecentActivityByUser: vi.fn(),
      getActivityByUser: vi.fn(),
    };

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
      executeSubmission: vi.fn().mockResolvedValue({
        passed: true,
        passedCases: 1,
        totalCases: 1,
        results: [],
      }),
      executePlayground: vi.fn(),
    };

    notificationService = {
      notifyUser: vi.fn(),
      notifyAll: vi.fn(),
    };

    useCase = new SubmitSolution(
      submissionRepository,
      problemRepository,
      executionService,
      notificationService,
    );
  });

  it('should submit and execute a solution in-process', async () => {
    const input = {
      problemId: 'problem-123',
      code: 'console.log("hello world");',
      language: 'javascript',
      userId: 'user-456',
    };

    vi.mocked(problemRepository.findById).mockResolvedValue(mockProblem);
    vi.mocked(submissionRepository.create).mockResolvedValue(mockSubmission);
    vi.mocked(submissionRepository.findById).mockResolvedValue(mockFinishedSubmission);

    const result = await useCase.execute(input);

    expect(problemRepository.findById).toHaveBeenCalledWith(input.problemId);
    expect(submissionRepository.create).toHaveBeenCalledWith({
      userId: input.userId,
      problemId: input.problemId,
      code: input.code,
      language: input.language,
      status: 'PENDING',
    });
    expect(problemRepository.incrementAttemptCount).toHaveBeenCalledWith(input.problemId);
    expect(executionService.executeSubmission).toHaveBeenCalledWith({
      submissionId: mockSubmission.id,
      userId: input.userId,
      problemId: input.problemId,
      code: input.code,
      files: undefined,
      language: input.language,
    });
    expect(notificationService.notifyUser).toHaveBeenCalledWith(input.userId, 'submission:status', {
      submissionId: mockSubmission.id,
      status: 'PENDING',
    });

    expect(result).toEqual(mockFinishedSubmission);
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
    expect(submissionRepository.create).not.toHaveBeenCalled();
    expect(problemRepository.incrementAttemptCount).not.toHaveBeenCalled();
    expect(executionService.executeSubmission).not.toHaveBeenCalled();
    expect(notificationService.notifyUser).not.toHaveBeenCalled();
  });
});
