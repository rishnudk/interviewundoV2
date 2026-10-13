// ============================================================
// Dependency Injection Container
// Wires infrastructure implementations to domain ports
// All use cases are instantiated here and exported
// ============================================================

// --- Infrastructure (implementations) ---
import { PrismaUserRepository } from '../infrastructure/database/repositories/PrismaUserRepository';
import { PrismaProblemRepository } from '../infrastructure/database/repositories/PrismaProblemRepository';
import { PrismaSubmissionRepository } from '../infrastructure/database/repositories/PrismaSubmissionRepository';
import { PrismaTestCaseRepository } from '../infrastructure/database/repositories/PrismaTestCaseRepository';
import { PrismaHintUsageRepository } from '../infrastructure/database/repositories/PrismaHintUsageRepository';
import { PrismaFeatureRequestRepository } from '../infrastructure/database/repositories/PrismaFeatureRequestRepository';
import { GrokHintService } from '../infrastructure/ai/GrokHintService';
import { JoseAuthTokenService } from '../infrastructure/auth/JoseAuthTokenService';
import { Argon2PasswordService } from '../infrastructure/auth/Argon2PasswordService';
import { RedisCacheService } from '../infrastructure/cache/RedisCacheService';
import { socketIOService } from '../infrastructure/notification/SocketIOService';
import { CodeExecutionService } from '../infrastructure/executor/CodeExecutionService';

// --- Use Cases ---
import { RegisterUser } from '../application/use-cases/auth/RegisterUser';
import { LoginUser } from '../application/use-cases/auth/LoginUser';
import { RefreshToken } from '../application/use-cases/auth/RefreshToken';
import { AuthenticateGithubUser } from '../application/use-cases/auth/AuthenticateGithubUser';
import { AuthenticateGoogleUser } from '../application/use-cases/auth/AuthenticateGoogleUser';
import { GetProblems } from '../application/use-cases/problem/GetProblems';
import { GetProblemBySlug } from '../application/use-cases/problem/GetProblemBySlug';
import { GetDailyChallenge } from '../application/use-cases/problem/GetDailyChallenge';
import { GetHintForProblem } from '../application/use-cases/problem/GetHintForProblem';
import { SubmitSolution } from '../application/use-cases/submission/SubmitSolution';
import { RunCode } from '../application/use-cases/submission/RunCode';
import { GetSubmissions } from '../application/use-cases/submission/GetSubmissions';
import { GetSubmissionResult } from '../application/use-cases/submission/GetSubmissionResult';
import { GetUserStats } from '../application/use-cases/dashboard/GetUserStats';
import { GetCategoryProgress } from '../application/use-cases/dashboard/GetCategoryProgress';
import { GetActivityHeatmap } from '../application/use-cases/dashboard/GetActivityHeatmap';
import { GetRecentActivity } from '../application/use-cases/dashboard/GetRecentActivity';

// Admin & Test Cases & Feature Request Use Cases
import { GetAdminStats } from '../application/use-cases/admin/GetAdminStats';
import { GetAdminProblems } from '../application/use-cases/admin/GetAdminProblems';
import { CreateProblem } from '../application/use-cases/problem/CreateProblem';
import { UpdateProblem } from '../application/use-cases/problem/UpdateProblem';
import { DeleteProblem } from '../application/use-cases/problem/DeleteProblem';
import { ToggleProblemLike } from '../application/use-cases/problem/ToggleProblemLike';
import { CreateTestCase } from '../application/use-cases/testcase/CreateTestCase';
import { UpdateTestCase } from '../application/use-cases/testcase/UpdateTestCase';
import { DeleteTestCase } from '../application/use-cases/testcase/DeleteTestCase';
import { GetTestCasesByProblemId } from '../application/use-cases/testcase/GetTestCasesByProblemId';
import { CreateFeatureRequest } from '../application/use-cases/requests/CreateFeatureRequest';
import { GetFeatureRequests } from '../application/use-cases/requests/GetFeatureRequests';
import { UpvoteFeatureRequest } from '../application/use-cases/requests/UpvoteFeatureRequest';

// --- Controllers ---
import { AuthController } from '../presentation/controllers/AuthController';
import { ProblemController } from '../presentation/controllers/ProblemController';
import { SubmissionController } from '../presentation/controllers/SubmissionController';
import { DashboardController } from '../presentation/controllers/DashboardController';
import { AdminController } from '../presentation/controllers/AdminController';
import { FeatureRequestController } from '../presentation/controllers/FeatureRequestController';

// ============================================================
// Wire Dependencies
// ============================================================

import { PrismaTestimonialRepository } from '../infrastructure/database/repositories/PrismaTestimonialRepository';
import { CreateTestimonial } from '../application/use-cases/testimonial/CreateTestimonial';
import { GetTestimonialsByUserId } from '../application/use-cases/testimonial/GetTestimonialsByUserId';
import { GetPublicTestimonials } from '../application/use-cases/testimonial/GetPublicTestimonials';
import { DeleteTestimonial } from '../application/use-cases/testimonial/DeleteTestimonial';
import { CheckTestimonialEligibility } from '../application/use-cases/testimonial/CheckTestimonialEligibility';
import { TestimonialController } from '../presentation/controllers/TestimonialController';

// Step 1: Instantiate infrastructure
const userRepository = new PrismaUserRepository();
const problemRepository = new PrismaProblemRepository();
const submissionRepository = new PrismaSubmissionRepository();
const testCaseRepository = new PrismaTestCaseRepository();
const featureRequestRepository = new PrismaFeatureRequestRepository();
const testimonialRepository = new PrismaTestimonialRepository();
const authTokenService = new JoseAuthTokenService();
const passwordService = new Argon2PasswordService();
const cacheService = new RedisCacheService();
const hintUsageRepository = new PrismaHintUsageRepository();
const hintService = new GrokHintService();

// Use real SocketIOService as the notification service
const notificationService = socketIOService;
const executionService = new CodeExecutionService(notificationService);

// Step 2: Instantiate use cases with injected dependencies
const registerUser = new RegisterUser(userRepository, passwordService, authTokenService);
const loginUser = new LoginUser(userRepository, passwordService, authTokenService);
const refreshToken = new RefreshToken(userRepository, authTokenService);
const authenticateGithubUser = new AuthenticateGithubUser(userRepository, authTokenService);
const authenticateGoogleUser = new AuthenticateGoogleUser(userRepository, authTokenService);
const getProblems = new GetProblems(problemRepository, cacheService);
const getProblemBySlug = new GetProblemBySlug(problemRepository, cacheService);
const getDailyChallenge = new GetDailyChallenge(problemRepository, cacheService);
const getHintForProblem = new GetHintForProblem(
  problemRepository,
  hintUsageRepository,
  hintService,
);
const toggleProblemLike = new ToggleProblemLike();
const submitSolution = new SubmitSolution(
  submissionRepository,
  problemRepository,
  executionService,
  notificationService,
);
const runCode = new RunCode(problemRepository, executionService);
const getSubmissions = new GetSubmissions(submissionRepository);
const getSubmissionResult = new GetSubmissionResult(submissionRepository);
const getUserStats = new GetUserStats(submissionRepository, problemRepository, userRepository);
const getCategoryProgress = new GetCategoryProgress(submissionRepository, problemRepository);
const getActivityHeatmap = new GetActivityHeatmap(submissionRepository);
const getRecentActivity = new GetRecentActivity(submissionRepository);

// Admin & Test Cases & Feature Requests
const getAdminStats = new GetAdminStats(userRepository, submissionRepository, problemRepository);
const getAdminProblems = new GetAdminProblems(problemRepository);
const createProblem = new CreateProblem(problemRepository);
const updateProblem = new UpdateProblem(problemRepository);
const deleteProblem = new DeleteProblem(problemRepository);
const createTestCase = new CreateTestCase(testCaseRepository, problemRepository);
const updateTestCase = new UpdateTestCase(testCaseRepository);
const deleteTestCase = new DeleteTestCase(testCaseRepository);
const getTestCasesByProblemId = new GetTestCasesByProblemId(testCaseRepository);
const createFeatureRequest = new CreateFeatureRequest(featureRequestRepository);
const getFeatureRequests = new GetFeatureRequests(featureRequestRepository);
const upvoteFeatureRequest = new UpvoteFeatureRequest(featureRequestRepository);

// Testimonials
const createTestimonial = new CreateTestimonial(testimonialRepository);
const getTestimonialsByUserId = new GetTestimonialsByUserId(testimonialRepository);
const getPublicTestimonials = new GetPublicTestimonials(testimonialRepository);
const deleteTestimonial = new DeleteTestimonial(testimonialRepository);
const checkTestimonialEligibility = new CheckTestimonialEligibility(
  testimonialRepository,
  submissionRepository,
);

// Step 3: Instantiate controllers
const authController = new AuthController(
  registerUser,
  loginUser,
  refreshToken,
  authenticateGithubUser,
  authenticateGoogleUser,
);
const problemController = new ProblemController(
  getProblems,
  getProblemBySlug,
  getDailyChallenge,
  getHintForProblem,
  toggleProblemLike,
);
const submissionController = new SubmissionController(
  submitSolution,
  runCode,
  getSubmissions,
  getSubmissionResult,
);
const dashboardController = new DashboardController(
  getUserStats,
  getCategoryProgress,
  getActivityHeatmap,
  getRecentActivity,
);
const adminController = new AdminController(
  getAdminStats,
  getAdminProblems,
  createProblem,
  updateProblem,
  deleteProblem,
  createTestCase,
  updateTestCase,
  deleteTestCase,
  getTestCasesByProblemId,
);
const featureRequestController = new FeatureRequestController(
  createFeatureRequest,
  getFeatureRequests,
  upvoteFeatureRequest,
);
const testimonialController = new TestimonialController(
  createTestimonial,
  getTestimonialsByUserId,
  getPublicTestimonials,
  deleteTestimonial,
  checkTestimonialEligibility,
);

// Step 4: Export container
export const container = {
  repositories: {
    userRepository,
    problemRepository,
    submissionRepository,
    testCaseRepository,
    hintUsageRepository,
    featureRequestRepository,
    testimonialRepository,
  },
  services: {
    authTokenService,
    passwordService,
    cacheService,
  },
  useCases: {
    registerUser,
    loginUser,
    refreshToken,
    authenticateGithubUser,
    authenticateGoogleUser,
    getProblems,
    getProblemBySlug,
    getDailyChallenge,
    getHintForProblem,
    submitSolution,
    runCode,
    getSubmissions,
    getSubmissionResult,
    getUserStats,
    getCategoryProgress,
    getActivityHeatmap,
    getRecentActivity,
    getAdminStats,
    getAdminProblems,
    createProblem,
    updateProblem,
    deleteProblem,
    createTestCase,
    updateTestCase,
    deleteTestCase,
    getTestCasesByProblemId,
    createFeatureRequest,
    getFeatureRequests,
    upvoteFeatureRequest,
    createTestimonial,
    getTestimonialsByUserId,
    getPublicTestimonials,
    deleteTestimonial,
    checkTestimonialEligibility,
  },
  controllers: {
    authController,
    problemController,
    submissionController,
    dashboardController,
    adminController,
    featureRequestController,
    testimonialController,
  },
};
