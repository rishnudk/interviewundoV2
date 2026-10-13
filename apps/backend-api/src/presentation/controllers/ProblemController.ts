import { Request, Response, NextFunction } from 'express';
import { redis } from '../../config/redis';
import { prisma } from '../../config/database';
import type { GetProblems } from '../../application/use-cases/problem/GetProblems';
import type { GetProblemBySlug } from '../../application/use-cases/problem/GetProblemBySlug';
import type { GetDailyChallenge } from '../../application/use-cases/problem/GetDailyChallenge';
import type { GetHintForProblem } from '../../application/use-cases/problem/GetHintForProblem';
import type { ToggleProblemLike } from '../../application/use-cases/problem/ToggleProblemLike';

export class ProblemController {
  constructor(
    private readonly getProblems: GetProblems,
    private readonly getProblemBySlug: GetProblemBySlug,
    private readonly getDailyChallenge: GetDailyChallenge,
    private readonly getHintForProblem: GetHintForProblem,
    private readonly toggleProblemLike: ToggleProblemLike,
  ) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // The req.query is validated and coerced in the router via validateRequest
      const result = await this.getProblems.execute(req.query as any);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getBySlug = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const slug = req.params.slug as string;
      const problem = await this.getProblemBySlug.execute(slug);

      // Fire-and-forget: track active page views in Redis (does NOT block response)
      // For a true count: use INCR + EXPIRE separately
      const activeKey = `problem:active:count:${slug}`;
      if (redis && typeof redis.incr === 'function') {
        redis
          .incr(activeKey)
          .then(() => redis.expire && redis.expire(activeKey, 300))
          .catch(() => {});
      }

      let isLikedByUser = false;
      if (req.user?.id) {
        const like = await prisma.problemLike.findUnique({
          where: {
            userId_problemId: {
              userId: req.user.id,
              problemId: problem.id,
            },
          },
        });
        isLikedByUser = !!like;
      }

      res.status(200).json({
        success: true,
        data: {
          ...problem,
          isLikedByUser,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getActiveSolvers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const slug = req.params.slug as string;
      const count = await redis.get(`problem:active:count:${slug}`);
      res.status(200).json({
        success: true,
        data: { activeSolversCount: parseInt(count ?? '0', 10) },
      });
    } catch (error) {
      next(error);
    }
  };

  toggleLike = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }
      const slug = req.params.slug as string;
      const result = await this.toggleProblemLike.execute({ userId, slug });

      // Invalidate the cached problem response to update the likesCount
      await redis.del(`problems:slug:${slug}`).catch(() => {});

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getDaily = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const problem = await this.getDailyChallenge.execute();

      res.status(200).json({
        success: true,
        data: problem,
      });
    } catch (error) {
      next(error);
    }
  };

  getHint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const slug = req.params.slug as string;
      const { code } = req.body;

      const result = await this.getHintForProblem.execute({
        userId,
        slug,
        code,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
