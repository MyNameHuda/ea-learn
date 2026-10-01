/**
 * Type definitions for our PostgreSQL data model.
 * Columns are snake_case in SQL; the TypeScript types are camelCase.
 */

/**
 * Free text, not a fixed union.
 *
 * This was `"5-8" | "9-12" | "13-17"`, which forced three buttons in the
 * create form and a dropdown in the editor. A parent making a worksheet for
 * one child has no use for a fixed scale: "4 tahun", "TK B", "8-9", "SMA
 * kelas 11" are all real answers that the union rejected.
 *
 * The column has always been TEXT with no CHECK constraint, so widening the
 * type is backward compatible — existing rows keep their values untouched.
 */
export type AgeRange = string;

export type QuizStatus = "draft" | "ready" | "archived";

export type QuestionType = "multiple_choice" | "essay";

export type AttemptStatus = "in_progress" | "submitted" | "graded";

export type UserRow = {
  id: string;
  email: string;
  passwordHash: string | null;
  displayName: string;
  /** Vestigial. The column still exists but nothing in the app reads it any
   *  more: signup no longer sends a verification code, so there is no state
   *  for it to represent. Kept only because scripts/db-inspect.ts prints it. */
  emailVerified: boolean;
  /** Also vestigial, same reason. Every account is now "email". */
  authProvider: string;
  createdAt: string;
  updatedAt: string;
};

export type ChildRow = {
  id: string;
  userId: string;
  name: string;
  ageRange: AgeRange;
  subjects: string | null;
  createdAt: string;
};

export type QuizRow = {
  id: string;
  userId: string;
  shareUuid: string;
  title: string;
  description: string | null;
  subject: string | null;
  ageRange: AgeRange;
  status: QuizStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type QuestionRow = {
  id: string;
  quizId: string;
  orderIndex: number;
  type: QuestionType;
  prompt: string;
  options: string[] | null;
  correctAnswer: number[] | null;
  keywords: string[] | null;
  keywordWeights: number[] | null;
  /** Optional figure or diagram shown with the question, e.g. "/uploads/questions/x.png". */
  imageUrl: string | null;
  points: number;
};

export type AttemptRow = {
  id: string;
  quizId: string;
  childName: string;
  totalScore: number | null;
  maxScore: number;
  status: AttemptStatus;
  submittedAt: string | null;
  gradedAt: string | null;
  startedAt: string;
};

export type AnswerRow = {
  id: string;
  attemptId: string;
  questionId: string;
  response: string;
  autoScore: number | null;
  finalScore: number | null;
  parentComment: string | null;
  createdAt: string;
};

// Helper for snake_case DB row → camelCase TS type
export function mapUser(r: Record<string, unknown>): UserRow {
  return {
    id: r.id as string,
    email: r.email as string,
    passwordHash: (r.password_hash as string) ?? null,
    displayName: r.display_name as string,
    emailVerified: Boolean(r.email_verified),
    authProvider: r.auth_provider as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function mapChild(r: Record<string, unknown>): ChildRow {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    name: r.name as string,
    ageRange: r.age_range as AgeRange,
    subjects: (r.subjects as string) ?? null,
    createdAt: r.created_at as string,
  };
}

export function mapQuiz(r: Record<string, unknown>): QuizRow {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    shareUuid: r.share_uuid as string,
    title: r.title as string,
    description: (r.description as string) ?? null,
    subject: (r.subject as string) ?? null,
    ageRange: r.age_range as AgeRange,
    status: r.status as QuizStatus,
    publishedAt: (r.published_at as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function mapQuestion(
  r: Record<string, unknown>,
): QuestionRow & { options: string[] | null } {
  return {
    id: r.id as string,
    quizId: r.quiz_id as string,
    orderIndex: r.order_index as number,
    type: r.type as QuestionType,
    prompt: r.prompt as string,
    options: r.options ? JSON.parse(r.options as string) : null,
    correctAnswer: r.correct_answer ? JSON.parse(r.correct_answer as string) : null,
    keywords: r.keywords ? JSON.parse(r.keywords as string) : null,
    keywordWeights: r.keyword_weights
      ? JSON.parse(r.keyword_weights as string)
      : null,
    imageUrl: (r.image_url as string) ?? null,
    points: r.points as number,
  };
}

export function mapAttempt(r: Record<string, unknown>): AttemptRow {
  return {
    id: r.id as string,
    quizId: r.quiz_id as string,
    childName: r.child_name as string,
    totalScore: r.total_score != null ? Number(r.total_score) : null,
    maxScore: Number(r.max_score),
    status: r.status as AttemptStatus,
    submittedAt: (r.submitted_at as string) ?? null,
    gradedAt: (r.graded_at as string) ?? null,
    startedAt: r.started_at as string,
  };
}
