import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';

describe('Submission Endpoints Integration', () => {
  const testUser = {
    name: 'Submission Test User',
    email: 'submission-test@example.com',
    password: 'Password123!',
  };

  let accessToken: string;
  let userId: string;
  let problemId: string;
  let submissionId: string;

  beforeAll(async () => {
    // 1. Clean up potential leftover test data
    await prisma.submissionResult.deleteMany({});
    await prisma.submission.deleteMany({});
    await prisma.problem.deleteMany({
      where: { slug: 'test-two-sum' },
    });
    await prisma.user.deleteMany({
      where: { email: testUser.email },
    });

    // 2. Register user to get credentials
    const registerRes = await request(app).post('/api/auth/register').send(testUser);

    expect(registerRes.status).toBe(201);
    accessToken = registerRes.body.data.accessToken;
    userId = registerRes.body.data.user.id;

    // 3. Create a test problem
    const problem = await prisma.problem.create({
      data: {
        title: 'Test Two Sum',
        slug: 'test-two-sum',
        description: 'Solve the two sum problem.',
        difficulty: 'EASY',
        category: 'JAVASCRIPT',
        starterCode: 'function twoSum() {}',
        isPublished: true,
      },
    });
    problemId = problem.id;
  });

  afterAll(async () => {
    // Clean up all test data
    await prisma.submissionResult.deleteMany({});
    await prisma.submission.deleteMany({});
    await prisma.problem.deleteMany({
      where: { id: problemId },
    });
    await prisma.user.deleteMany({
      where: { id: userId },
    });

    // Close connections
    await prisma.$disconnect();
    await redis.quit();
  });

  describe('POST /api/submissions', () => {
    it('should fail if user is not authenticated', async () => {
      const res = await request(app).post('/api/submissions').send({
        problemId,
        code: 'function twoSum(nums, target) { return [0, 1]; }',
        language: 'javascript',
      });

      expect(res.status).toBe(401);
    });

    it('should create a submission successfully when authenticated', async () => {
      const res = await request(app)
        .post('/api/submissions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          problemId,
          code: 'function twoSum(nums, target) { return [0, 1]; }',
          language: 'javascript',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.userId).toBe(userId);
      expect(res.body.data.problemId).toBe(problemId);
      expect(['PENDING', 'RUNTIME_ERROR', 'ACCEPTED', 'WRONG_ANSWER']).toContain(
        res.body.data.status,
      );

      submissionId = res.body.data.id;
    });
  });

  describe('POST /api/submissions/run', () => {
    it('should execute run code in playground mode', async () => {
      const res = await request(app)
        .post('/api/submissions/run')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          problemId,
          code: 'console.log("Hello Playground");',
          language: 'javascript',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('jobId');
      expect(['PENDING', 'Finished']).toContain(res.body.data.status);
    });
  });

  describe('GET /api/submissions', () => {
    it('should retrieve list of user submissions', async () => {
      const res = await request(app)
        .get('/api/submissions')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.data).toBeInstanceOf(Array);
      expect(res.body.data.data.length).toBeGreaterThan(0);
      expect(res.body.data.total).toBeGreaterThan(0);
      expect(res.body.data.page).toBe(1);

      // Verify the submission we created is in the list
      const ids = res.body.data.data.map((sub: any) => sub.id);
      expect(ids).toContain(submissionId);
    });

    it('should respect pagination parameters', async () => {
      const res = await request(app)
        .get('/api/submissions?page=1&limit=1')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.limit).toBe(1);
      expect(res.body.data.data.length).toBe(1);
    });
  });

  describe('GET /api/submissions/:id', () => {
    it('should retrieve a single submission with result structure', async () => {
      // 1. Manually add a submission result so we can test retrieving it (clear any background results first)
      await prisma.submissionResult.deleteMany({
        where: { submissionId },
      });
      await prisma.submissionResult.create({
        data: {
          submissionId,
          runtime: 45,
          memory: 2048576,
          passedCases: 4,
          totalCases: 4,
          output: 'Success',
        },
      });

      // 2. Fetch the submission details
      const res = await request(app)
        .get(`/api/submissions/${submissionId}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(submissionId);
      expect(res.body.data.result).not.toBeNull();
      expect(res.body.data.result.passedCases).toBe(4);
      expect(res.body.data.result.totalCases).toBe(4);
    });

    it('should fail to retrieve a non-existent submission', async () => {
      const res = await request(app)
        .get('/api/submissions/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it("should fail if trying to retrieve another user's submission", async () => {
      // 1. Register a second user
      const otherUser = {
        name: 'Other User',
        email: 'other-user@example.com',
        password: 'Password123!',
      };

      const otherRegisterRes = await request(app).post('/api/auth/register').send(otherUser);

      expect(otherRegisterRes.status).toBe(201);
      const otherAccessToken = otherRegisterRes.body.data.accessToken;
      const otherUserId = otherRegisterRes.body.data.user.id;

      try {
        // 2. Attempt to fetch first user's submission using second user's token
        const res = await request(app)
          .get(`/api/submissions/${submissionId}`)
          .set('Authorization', `Bearer ${otherAccessToken}`);

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('FORBIDDEN');
      } finally {
        // Clean up second user
        await prisma.user.deleteMany({
          where: { id: otherUserId },
        });
      }
    });
  });
});
