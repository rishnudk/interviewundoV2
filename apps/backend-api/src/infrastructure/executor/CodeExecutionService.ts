import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { JavascriptVmExecutor } from './JavascriptVmExecutor';
import { SqlMemoryExecutor } from './SqlMemoryExecutor';
import { IExecutor, ExecutionResult } from './IExecutor';
import type { INotificationService } from '../../domain/ports/services/INotificationService';
import type { IExecutionService } from '../../domain/ports/services/IExecutionService';
import {
  getAcceptedSubmissionStreakUpdate,
  getCurrentStreakState,
} from '@interviewprep/shared-utils';

export interface ExecuteSubmissionInput {
  submissionId: string;
  userId: string;
  problemId: string;
  code: string;
  files?: Record<string, string>;
  language: string;
}

export interface PlaygroundResult {
  runId: string;
  status: string;
  passed: boolean;
  passedCases: number;
  totalCases: number;
  error?: string;
  results: any[];
}

export class CodeExecutionService implements IExecutionService {
  private jsExecutor = new JavascriptVmExecutor();
  private sqlExecutor = new SqlMemoryExecutor();

  constructor(private readonly notificationService: INotificationService) {}

  private getExecutorForCategory(category: string): IExecutor {
    switch (category) {
      case 'JAVASCRIPT':
      case 'NODEJS':
      case 'REACT':
      case 'TYPESCRIPT':
        return this.jsExecutor;
      case 'SQL':
        return this.sqlExecutor;
      default:
        // Default to Javascript VM for general algorithmic code
        return this.jsExecutor;
    }
  }

  /**
   * Run code in playground mode (doesn't create a persistent submission)
   */
  async executePlayground(input: ExecuteSubmissionInput): Promise<PlaygroundResult> {
    const { submissionId, userId, problemId, code } = input;
    logger.info({ submissionId, problemId, userId }, 'Executing playground run');

    // Notify user that execution has started
    this.notificationService.notifyUser(userId, 'submission:status', {
      submissionId,
      status: 'PROCESSING',
    });

    const [problem, testCases] = await Promise.all([
      prisma.problem.findUnique({
        where: { id: problemId },
        select: { category: true, slug: true },
      }),
      prisma.testCase.findMany({
        where: { problemId },
        orderBy: { order: 'asc' },
      }),
    ]);

    if (!problem) {
      throw new Error(`Problem not found for ID: ${problemId}`);
    }

    if (testCases.length === 0) {
      const emptyResult: PlaygroundResult = {
        runId: submissionId,
        status: 'Finished',
        passed: false,
        passedCases: 0,
        totalCases: 0,
        error: 'No test cases found for this problem.',
        results: [],
      };
      this.notificationService.notifyUser(userId, 'submission:status', {
        submissionId,
        status: 'Finished',
        error: emptyResult.error,
        data: emptyResult,
      });
      return emptyResult;
    }

    const formattedTestCases = testCases.map((tc: any) => ({
      id: tc.id,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
    }));

    const executor = this.getExecutorForCategory(problem.category);
    const execResult = await executor.execute(submissionId, code, formattedTestCases);

    const playgroundResult: PlaygroundResult = {
      runId: submissionId,
      status: 'Finished',
      passed: execResult.passed,
      passedCases: execResult.passedCases,
      totalCases: execResult.totalCases,
      error: execResult.error,
      results: execResult.results,
    };

    // Notify user immediately via real-time WebSocket
    this.notificationService.notifyUser(userId, 'submission:status', {
      submissionId,
      status: 'Finished',
      error: execResult.error,
      data: playgroundResult,
    });

    return playgroundResult;
  }

  /**
   * Run official submission and persist results to DB
   */
  async executeSubmission(input: ExecuteSubmissionInput): Promise<ExecutionResult> {
    const { submissionId, userId, problemId, code } = input;
    logger.info({ submissionId, problemId, userId }, 'Executing official solution submission');

    // 1. Notify user: processing
    this.notificationService.notifyUser(userId, 'submission:status', {
      submissionId,
      status: 'PROCESSING',
    });

    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: 'PROCESSING' },
    });

    // 2. Fetch problem details and test cases
    const [problem, testCases] = await Promise.all([
      prisma.problem.findUnique({
        where: { id: problemId },
        select: { category: true, slug: true },
      }),
      prisma.testCase.findMany({
        where: { problemId },
        orderBy: { order: 'asc' },
      }),
    ]);

    if (!problem) {
      throw new Error(`Problem not found for ID: ${problemId}`);
    }

    if (testCases.length === 0) {
      await prisma.submission.update({
        where: { id: submissionId },
        data: { status: 'RUNTIME_ERROR' },
      });
      const emptyResult: ExecutionResult = {
        passed: false,
        passedCases: 0,
        totalCases: 0,
        results: [],
        error: 'No test cases found for this problem.',
      };
      this.notificationService.notifyUser(userId, 'submission:status', {
        userId,
        submissionId,
        status: 'RUNTIME_ERROR',
        error: emptyResult.error,
        data: emptyResult,
      });
      return emptyResult;
    }

    const formattedTestCases = testCases.map((tc: any) => ({
      id: tc.id,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
    }));

    // 3. Execute
    const executor = this.getExecutorForCategory(problem.category);
    const execResult = await executor.execute(submissionId, code, formattedTestCases);

    // 4. Map executor outputs to submission statuses
    let finalStatus = 'ACCEPTED';
    if (execResult.error) {
      if (execResult.error.includes('Time Limit Exceeded')) {
        finalStatus = 'TIME_LIMIT_EXCEEDED';
      } else if (
        execResult.error.includes('SyntaxError') ||
        execResult.error.includes('Compilation Error') ||
        execResult.error.includes('ReferenceError') ||
        execResult.error.includes('TypeError')
      ) {
        finalStatus = 'COMPILATION_ERROR';
      } else {
        finalStatus = 'RUNTIME_ERROR';
      }
    } else if (!execResult.passed) {
      finalStatus = 'WRONG_ANSWER';
    }

    // 5. Persist to database
    await prisma.$transaction(
      [
        prisma.submission.update({
          where: { id: submissionId },
          data: { status: finalStatus as any },
        }),
        prisma.submissionResult.create({
          data: {
            submissionId,
            runtime: execResult.runtime ?? 0,
            memory: execResult.memory ?? 0,
            passedCases: execResult.passedCases,
            totalCases: execResult.totalCases,
            error: execResult.error,
            output: execResult.results
              .map((r) => (r.actual ? JSON.stringify(r.actual) : ''))
              .join('\n'),
          },
        }),
      ],
      {
        maxWait: 15000,
        timeout: 30000,
      },
    );

    // Increment solvedCount if successfully solved
    if (finalStatus === 'ACCEPTED') {
      await prisma.problem.update({
        where: { id: problemId },
        data: { solvedCount: { increment: 1 } },
      });
    }

    // Calculate runtime percentile for ACCEPTED submissions
    let runtimePercentile: number | null = null;
    if (finalStatus === 'ACCEPTED' && execResult.runtime != null) {
      const [totalAccepted, slowerOrEqual] = await Promise.all([
        prisma.submissionResult.count({
          where: { submission: { problemId, status: 'ACCEPTED' } },
        }),
        prisma.submissionResult.count({
          where: {
            submission: { problemId, status: 'ACCEPTED' },
            runtime: { gte: execResult.runtime },
          },
        }),
      ]);
      runtimePercentile =
        totalAccepted > 1 ? Math.round((slowerOrEqual / totalAccepted) * 100) : 90;
    }

    // Calculate and update user streak
    let newStreak = 0;
    let streakMilestone: number | null = null;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { streak: true, lastActiveAt: true },
    });

    if (user) {
      const now = new Date();
      newStreak = getCurrentStreakState(user.streak, user.lastActiveAt, now);

      if (newStreak !== user.streak) {
        await prisma.user.update({
          where: { id: userId },
          data: { streak: newStreak },
        });
      }

      if (finalStatus === 'ACCEPTED') {
        const streakUpdate = getAcceptedSubmissionStreakUpdate(newStreak, user.lastActiveAt, now);
        newStreak = streakUpdate.streak;
        streakMilestone = streakUpdate.milestone;

        await prisma.user.update({
          where: { id: userId },
          data: {
            streak: newStreak,
            lastActiveAt: now,
          },
        });
      }
    }

    // Notify user with final status update
    this.notificationService.notifyUser(userId, 'submission:status', {
      userId,
      submissionId,
      status: finalStatus,
      error: execResult.error,
      userStreak: newStreak,
      streakMilestone,
      runtimePercentile,
      data: {
        runtime: execResult.runtime,
        memory: execResult.memory,
        passedCases: execResult.passedCases,
        totalCases: execResult.totalCases,
        results: execResult.results,
      },
    });

    return execResult;
  }
}
