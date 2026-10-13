import type { IUseCase } from '../../interfaces/IUseCase';
import type { ISubmissionRepository } from '../../../domain/ports/repositories/ISubmissionRepository';
import type { IExecutionService } from '../../../domain/ports/services/IExecutionService';
import type { INotificationService } from '../../../domain/ports/services/INotificationService';
import type { IProblemRepository } from '../../../domain/ports/repositories/IProblemRepository';
import type { SubmitSolutionDTO, Submission } from '@interviewprep/shared-types';
import { NotFoundError } from '../../../domain/errors';

// ============================================================
// SubmitSolution Use Case
// Stores submission, executes directly in-process, notifies user
// ============================================================

interface SubmitSolutionInput extends SubmitSolutionDTO {
  userId: string;
}

export class SubmitSolution implements IUseCase<SubmitSolutionInput, Submission> {
  constructor(
    private readonly submissionRepository: ISubmissionRepository,
    private readonly problemRepository: IProblemRepository,
    private readonly executionService: IExecutionService,
    private readonly notificationService: INotificationService,
  ) {}

  async execute(input: SubmitSolutionInput): Promise<Submission> {
    // 1. Verify problem exists
    const problem = await this.problemRepository.findById(input.problemId);
    if (!problem) {
      throw new NotFoundError('Problem', input.problemId);
    }

    // 2. Create submission record in PENDING status
    const submission = await this.submissionRepository.create({
      userId: input.userId,
      problemId: input.problemId,
      code: input.code,
      language: input.language,
      status: 'PENDING',
    });

    // 3. Increment attempt count
    await this.problemRepository.incrementAttemptCount(input.problemId);

    // 4. Notify user that submission is pending
    this.notificationService.notifyUser(input.userId, 'submission:status', {
      submissionId: submission.id,
      status: 'PENDING',
    });

    // 5. Execute solution directly in-process
    await this.executionService.executeSubmission({
      submissionId: submission.id,
      userId: input.userId,
      problemId: input.problemId,
      code: input.code,
      files: input.files,
      language: input.language,
    });

    // 6. Fetch and return updated submission record
    const updated = await this.submissionRepository.findById(submission.id);
    return updated || submission;
  }
}
