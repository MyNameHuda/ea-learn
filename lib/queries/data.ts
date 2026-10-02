/**
 * Data access layer — CRUD operations for all entities.
 * Wraps raw SQL with type-safe inputs/outputs.
 */

import { allRows, getRow, runSql, cuid, shareToken, now, type SQLInputValue } from "@/lib/db";
import {
  type UserRow,
  type ChildRow,
  type QuizRow,
  type QuestionRow,
  type AttemptRow,
  type AnswerRow,
  type AgeRange,
  type QuestionType,
  mapUser,
  mapChild,
  mapQuiz,
  mapQuestion,
  mapAttempt,
} from "@/lib/queries";

// =====================================================
// USERS
// =====================================================

export async function getUserById(id: string): Promise<UserRow | null> {
  const row = await getRow<Record<string, unknown>>(`SELECT * FROM users WHERE id = ?`, [id]);
  return row ? mapUser(row) : null;
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const row = await getRow<Record<string, unknown>>(
    `SELECT * FROM users WHERE email = ?`,
    [email.toLowerCase().trim()],
  );
  return row ? mapUser(row) : null;
}

export async function createUser(data: {
  email: string;
  passwordHash: string;
  displayName: string;
  authProvider?: string;
  emailVerified?: boolean;
}): Promise<UserRow> {
  const id = cuid();
  const nowIso = now();
  await runSql(
    `INSERT INTO users (id, email, password_hash, display_name, email_verified, auth_provider, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.email.toLowerCase().trim(),
      data.passwordHash,
      data.displayName,
      data.emailVerified ? 1 : 0,
      data.authProvider ?? "email",
      nowIso,
      nowIso,
    ],
  );
  /* Was `return getUserById(id)!`. The non-null assertion was there because
     the SQLite version was synchronous and could not return a Promise — with
     pg the call is async, and `!` on a Promise is both a lie and the reason
     TypeScript rejects the assignment to a UserRow return type. */
  return (await getUserById(id)) as UserRow;
}

// =====================================================
// CHILDREN
// =====================================================

export async function listChildren(userId: string): Promise<ChildRow[]> {
  const rows = await allRows<Record<string, unknown>>(
    `SELECT * FROM children WHERE user_id = ? ORDER BY created_at ASC`,
    [userId],
  );
  return rows.map(mapChild);
}

// =====================================================
// QUIZZES
// =====================================================

export async function listQuizzes(userId: string): Promise<QuizRow[]> {
  const rows = await allRows<Record<string, unknown>>(
    `SELECT * FROM quizzes WHERE user_id = ? ORDER BY updated_at DESC`,
    [userId],
  );
  return rows.map(mapQuiz);
}

export async function getQuizById(id: string): Promise<QuizRow | null> {
  const row = await getRow<Record<string, unknown>>(
    `SELECT * FROM quizzes WHERE id = ?`,
    [id],
  );
  return row ? mapQuiz(row) : null;
}

export async function getQuizByShareUuid(shareUuid: string): Promise<QuizRow | null> {
  const row = await getRow<Record<string, unknown>>(
    `SELECT * FROM quizzes WHERE share_uuid = ?`,
    [shareUuid],
  );
  return row ? mapQuiz(row) : null;
}

export async function listQuizQuestions(quizId: string): Promise<QuestionRow[]> {
  const rows = await allRows<Record<string, unknown>>(
    `SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_index ASC`,
    [quizId],
  );
  return rows.map(mapQuestion);
}

export async function getQuizStats(
  quizId: string,
): Promise<{ questions: number; attempts: number }> {
  const qRow = await getRow<{ c: number }>(
    `SELECT COUNT(*) as c FROM questions WHERE quiz_id = ?`,
    [quizId],
  );
  const aRow = await getRow<{ c: number }>(
    `SELECT COUNT(*) as c FROM attempts WHERE quiz_id = ?`,
    [quizId],
  );
  return {
    questions: qRow?.c ?? 0,
    attempts: aRow?.c ?? 0,
  };
}

// =====================================================
// ATTEMPTS
// =====================================================

export async function listAttempts(quizId: string): Promise<AttemptRow[]> {
  const rows = await allRows<Record<string, unknown>>(
    // COALESCE so an attempt still in progress (submitted_at NULL) still sorts
    // by when the child started it, instead of collapsing to one arbitrary
    // position at the top or bottom of the timeline.
    `SELECT * FROM attempts
     WHERE quiz_id = ?
     ORDER BY COALESCE(submitted_at, started_at) DESC`,
    [quizId],
  );
  return rows.map(mapAttempt);
}

export async function getAttemptStats(
  quizId: string,
): Promise<{ total: number; avgScore: number | null; maxScore: number }> {
  const totalRow = await getRow<{ c: number }>(
    `SELECT COUNT(*) as c FROM attempts WHERE quiz_id = ?`,
    [quizId],
  );
  const avgRow = await getRow<{ a: number | null }>(
    `SELECT AVG(CAST(total_score AS REAL) / max_score * 100) as a
     FROM attempts WHERE quiz_id = ? AND status = 'graded'`,
    [quizId],
  );
  const maxRow = await getRow<{ s: number | null }>(
    `SELECT SUM(points) as s FROM questions WHERE quiz_id = ?`,
    [quizId],
  );

  return {
    total: totalRow?.c ?? 0,
    avgScore: avgRow?.a != null ? Math.round(avgRow.a) : null,
    maxScore: maxRow?.s ?? 0,
  };
}

/**
 * Per-attempt answer tally for the results timeline.
 *
 * Correctness is read off the grade already stored on each answer rather than
 * re-comparing the selected indices to the correct ones in SQL — JSON arrays
 * are not comparable in SQLite, and the grader has already done the work.
 * `final_score` wins over `auto_score` because a parent may have overridden an
 * essay after auto-grading.
 */
export type AttemptBreakdown = {
  attemptId: string;
  answered: number;
  correct: number;
};

export async function getQuizAttemptBreakdowns(quizId: string): Promise<AttemptBreakdown[]> {
  return (await allRows<Record<string, unknown>>(
    `SELECT a.attempt_id AS attemptId,
            COUNT(*) AS answered,
            SUM(CASE WHEN COALESCE(a.final_score, a.auto_score, 0) > 0
                     THEN 1 ELSE 0 END) AS correct
     FROM answers a
     JOIN attempts t ON t.id = a.attempt_id
     WHERE t.quiz_id = ?
     GROUP BY a.attempt_id`,
    [quizId],
  )).map((r) => ({
    attemptId: r.attemptId as string,
    answered: Number(r.answered ?? 0),
    correct: Number(r.correct ?? 0),
  }));
}

/**
 * How each question fared across every attempt on the quiz.
 *
 * This is the "soal mana yang paling sering dikeluarin" signal — a parent with
 * 2 attempts learns nothing from a score total, but immediately sees that one
 * specific question is the sticking point. Questions never attempted are kept
 * with answered = 0 rather than dropped.
 */
export type QuestionPerformance = {
  questionId: string;
  prompt: string;
  type: string;
  points: number;
  orderIndex: number;
  answered: number;
  correct: number;
};

export async function getQuizQuestionPerformance(quizId: string): Promise<QuestionPerformance[]> {
  return (await allRows<Record<string, unknown>>(
    `SELECT q.id AS questionId,
            q.prompt,
            q.type,
            q.points,
            q.order_index AS orderIndex,
            COUNT(a.question_id) AS answered,
            COALESCE(SUM(CASE WHEN COALESCE(a.final_score, a.auto_score, 0) > 0
                              THEN 1 ELSE 0 END), 0) AS correct
     FROM questions q
     LEFT JOIN (
       SELECT ans.question_id, ans.final_score, ans.auto_score
       FROM answers ans
       JOIN attempts t ON t.id = ans.attempt_id
       WHERE t.quiz_id = ?
     ) a ON a.question_id = q.id
     WHERE q.quiz_id = ?
     GROUP BY q.id
     ORDER BY q.order_index`,
    [quizId, quizId],
  )).map((r) => ({
    questionId: r.questionId as string,
    prompt: r.prompt as string,
    type: r.type as string,
    points: Number(r.points ?? 0),
    orderIndex: Number(r.orderIndex ?? 0),
    answered: Number(r.answered ?? 0),
    correct: Number(r.correct ?? 0),
  }));
}

/**
 * Per-quiz results rollup for the /hasil overview — the page the topbar's
 * "Hasil" item was pointing at. That link used to be `/dashboard#hasil`, an
 * anchor that exists nowhere in the app, so the topbar item led nowhere.
 *
 * One query for the whole list: the overview would otherwise fan out into
 * listAttempts + getAttemptStats per quiz.
 */
export type QuizResultRollup = {
  id: string;
  title: string;
  subject: string | null;
  ageRange: string;
  status: string;
  attempts: number;
  gradedCount: number;
  latestChild: string | null;
  latestPct: number | null;
  latestAt: string | null;
  avgPct: number | null;
  passCount: number;
};

export async function listQuizResultsRollup(userId: string): Promise<QuizResultRollup[]> {
  const rows = await allRows<Record<string, unknown>>(
    `SELECT q.id, q.title, q.subject, q.age_range, q.status,
            (SELECT COUNT(*) FROM attempts a
              WHERE a.quiz_id = q.id AND a.submitted_at IS NOT NULL) AS attempts,
            (SELECT COUNT(*) FROM attempts a
              WHERE a.quiz_id = q.id AND a.status = 'graded') AS gradedCount,
            (SELECT a.child_name FROM attempts a
              WHERE a.quiz_id = q.id AND a.submitted_at IS NOT NULL
              ORDER BY a.submitted_at DESC LIMIT 1) AS latestChild,
            (SELECT a.submitted_at FROM attempts a
              WHERE a.quiz_id = q.id AND a.submitted_at IS NOT NULL
              ORDER BY a.submitted_at DESC LIMIT 1) AS latestAt,
            (SELECT CAST(a.total_score AS REAL) / a.max_score * 100
              FROM attempts a
              WHERE a.quiz_id = q.id AND a.submitted_at IS NOT NULL
              ORDER BY a.submitted_at DESC LIMIT 1) AS latestPct,
            (SELECT AVG(CAST(a.total_score AS REAL) / a.max_score * 100)
              FROM attempts a
              WHERE a.quiz_id = q.id AND a.status = 'graded') AS avgPct,
            (SELECT COUNT(*) FROM attempts a
              WHERE a.quiz_id = q.id AND a.status = 'graded'
                AND CAST(a.total_score AS REAL) / a.max_score * 100 >= 70) AS passCount
     FROM quizzes q
     WHERE q.user_id = ?
     -- Quizzes with a most recent attempt float to the top, the rest keep
     -- their own recency underneath. Spelled with CASE rather than
     -- "NULLS LAST" so the ordering never depends on a null-ordering
     -- default that differs between database engines.
     ORDER BY CASE WHEN (SELECT MAX(a.submitted_at) FROM attempts a
                         WHERE a.quiz_id = q.id) IS NULL THEN 1 ELSE 0 END,
              (SELECT MAX(a.submitted_at) FROM attempts a
               WHERE a.quiz_id = q.id) DESC,
              q.updated_at DESC`,
    [userId],
  );

  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    subject: (r.subject as string) ?? null,
    ageRange: r.age_range as string,
    status: r.status as string,
    attempts: Number(r.attempts ?? 0),
    gradedCount: Number(r.gradedCount ?? 0),
    latestChild: (r.latestChild as string) ?? null,
    latestPct: r.latestPct != null ? Math.round(Number(r.latestPct)) : null,
    latestAt: (r.latestAt as string) ?? null,
    avgPct: r.avgPct != null ? Math.round(Number(r.avgPct)) : null,
    passCount: Number(r.passCount ?? 0),
  }));
}

// =====================================================
// CHILD MANAGEMENT
// =====================================================

export async function createChild(data: {
  userId: string;
  name: string;
  ageRange: AgeRange;
  subjects?: string[];
}): Promise<ChildRow> {
  const id = cuid();
  const subjects = data.subjects ? JSON.stringify(data.subjects) : null;
  await runSql(
    `INSERT INTO children (id, user_id, name, age_range, subjects, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data.userId, data.name, data.ageRange, subjects, now()],
  );
  return getRow<Record<string, unknown>>("SELECT * FROM children WHERE id = ?", [id])! as unknown as ChildRow;
}

// =====================================================
// QUIZ CRUD (full)
// =====================================================

export async function createQuiz(data: {
  userId: string;
  title: string;
  description?: string | null;
  subject?: string | null;
  ageRange: AgeRange;
}): Promise<QuizRow> {
  const id = cuid();
  const shareUuid = shareToken();
  const nowIso = now();
  await runSql(
    `INSERT INTO quizzes (id, user_id, share_uuid, title, description, subject, age_range, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    [
      id,
      data.userId,
      shareUuid,
      data.title,
      data.description ?? null,
      data.subject ?? null,
      data.ageRange,
      nowIso,
      nowIso,
    ],
  );
  return (await getQuizById(id)) as QuizRow;
}

export async function updateQuiz(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    subject?: string | null;
    ageRange?: AgeRange;
  },
) {
  const updates: string[] = [];
  const params: SQLInputValue[] = [];

  if (data.title !== undefined) {
    updates.push("title = ?");
    params.push(data.title);
  }
  if (data.description !== undefined) {
    updates.push("description = ?");
    params.push(data.description);
  }
  if (data.subject !== undefined) {
    updates.push("subject = ?");
    params.push(data.subject);
  }
  if (data.ageRange !== undefined) {
    updates.push("age_range = ?");
    params.push(data.ageRange);
  }

  if (updates.length === 0) return;
  updates.push("updated_at = ?");
  params.push(now());
  params.push(id);

  await runSql(
    `UPDATE quizzes SET ${updates.join(", ")} WHERE id = ?`,
    params,
  );
}

export async function publishQuiz(id: string) {
  await runSql(
    `UPDATE quizzes SET status = 'ready', published_at = ?, updated_at = ? WHERE id = ?`,
    [now(), now(), id],
  );
}

export async function unpublishQuiz(id: string) {
  await runSql(
    `UPDATE quizzes SET status = 'draft', published_at = NULL, updated_at = ? WHERE id = ?`,
    [now(), id],
  );
}

export async function deleteQuiz(id: string) {
  await runSql(`DELETE FROM quizzes WHERE id = ?`, [id]);
}

// =====================================================
// QUESTIONS CRUD
// =====================================================

export async function addQuestion(data: {
  quizId: string;
  type: QuestionType;
  prompt: string;
  options?: string[] | null;
  correctAnswer?: number[] | null;
  keywords?: string[] | null;
  keywordWeights?: number[] | null;
  imageUrl?: string | null;
  points?: number;
}): Promise<QuestionRow> {
  const id = cuid();
  const maxRow = await getRow<{ c: number }>(
    "SELECT COUNT(*) as c FROM questions WHERE quiz_id = ?",
    [data.quizId],
  );
  const orderIndex = (maxRow?.c ?? 0) + 1;

  await runSql(
    `INSERT INTO questions (id, quiz_id, order_index, type, prompt, options, correct_answer, keywords, keyword_weights, image_url, points)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.quizId,
      orderIndex,
      data.type,
      data.prompt,
      data.options ? JSON.stringify(data.options) : null,
      data.correctAnswer ? JSON.stringify(data.correctAnswer) : null,
      data.keywords ? JSON.stringify(data.keywords) : null,
      data.keywordWeights ? JSON.stringify(data.keywordWeights) : null,
      data.imageUrl ?? null,
      data.points ?? 10,
    ],
  );

  // touch updated_at on quiz
  await runSql(`UPDATE quizzes SET updated_at = ? WHERE id = ?`, [now(), data.quizId]);

  return getRow<Record<string, unknown>>(
    "SELECT * FROM questions WHERE id = ?",
    [id],
  ) as unknown as QuestionRow;
}

export async function getQuestionById(id: string): Promise<QuestionRow | null> {
  const row = await getRow<Record<string, unknown>>(
    `SELECT * FROM questions WHERE id = ?`,
    [id],
  );
  return row ? mapQuestion(row) : null;
}

export async function updateQuestion(
  id: string,
  data: {
    type?: QuestionType;
    prompt?: string;
    options?: string[] | null;
    correctAnswer?: number[] | null;
    keywords?: string[] | null;
    keywordWeights?: number[] | null;
    imageUrl?: string | null;
    points?: number;
  },
) {
  const updates: string[] = [];
  const params: SQLInputValue[] = [];
  if (data.type !== undefined) {
    updates.push("type = ?");
    params.push(data.type);
  }
  if (data.prompt !== undefined) {
    updates.push("prompt = ?");
    params.push(data.prompt);
  }
  if (data.options !== undefined) {
    updates.push("options = ?");
    params.push(data.options ? JSON.stringify(data.options) : null);
  }
  if (data.correctAnswer !== undefined) {
    updates.push("correct_answer = ?");
    params.push(data.correctAnswer ? JSON.stringify(data.correctAnswer) : null);
  }
  if (data.keywords !== undefined) {
    updates.push("keywords = ?");
    params.push(data.keywords ? JSON.stringify(data.keywords) : null);
  }
  if (data.keywordWeights !== undefined) {
    updates.push("keyword_weights = ?");
    params.push(data.keywordWeights ? JSON.stringify(data.keywordWeights) : null);
  }
  if (data.imageUrl !== undefined) {
    updates.push("image_url = ?");
    params.push(data.imageUrl || null);
  }
  if (data.points !== undefined) {
    updates.push("points = ?");
    params.push(data.points);
  }
  if (updates.length === 0) return;
  await runSql(`UPDATE questions SET ${updates.join(", ")} WHERE id = ?`, [...params, id]);
  // Touch parent quiz
  await runSql(
    `UPDATE quizzes SET updated_at = ? WHERE id = (SELECT quiz_id FROM questions WHERE id = ?)`,
    [now(), id],
  );
}

export async function deleteQuestion(id: string) {
  const quizId = (await getRow<{ quiz_id: string }>(
    `SELECT quiz_id FROM questions WHERE id = ?`,
    [id],
  ))?.quiz_id;
  await runSql(`DELETE FROM questions WHERE id = ?`, [id]);
  if (quizId) {
    await runSql(`UPDATE quizzes SET updated_at = ? WHERE id = ?`, [now(), quizId]);
  }
}

export async function countQuestionsByQuiz(quizId: string): Promise<number> {
  return (
    (await getRow<{ c: number }>(
      "SELECT COUNT(*) as c FROM questions WHERE quiz_id = ?",
      [quizId],
    ))?.c ?? 0
  );
}

export async function sumQuestionPoints(quizId: string): Promise<number> {
  return (
    (await getRow<{ s: number | null }>(
      "SELECT SUM(points) as s FROM questions WHERE quiz_id = ?",
      [quizId],
    ))?.s ?? 0
  );
}

// =====================================================
// ATTEMPTS
// =====================================================

export async function createAttempt(data: {
  quizId: string;
  childName: string;
}): Promise<AttemptRow> {
  const id = cuid();
  const maxScore = await sumQuestionPoints(data.quizId);
  await runSql(
    `INSERT INTO attempts (id, quiz_id, child_name, max_score, status, started_at)
     VALUES (?, ?, ?, ?, 'in_progress', ?)`,
    [id, data.quizId, data.childName, maxScore, now()],
  );
  return (await getAttemptById(id)) as AttemptRow;
}

export async function getAttemptById(id: string): Promise<AttemptRow | null> {
  const row = await getRow<Record<string, unknown>>(
    `SELECT * FROM attempts WHERE id = ?`,
    [id],
  );
  return row ? mapAttempt(row) : null;
}

export async function submitAttempt(id: string, totalScore: number) {
  await runSql(
    `UPDATE attempts
     SET status = 'submitted', total_score = ?, submitted_at = ?
     WHERE id = ?`,
    [totalScore, now(), id],
  );
}

export async function gradeAttempt(id: string, totalScore: number) {
  await runSql(
    `UPDATE attempts
     SET status = 'graded', total_score = ?, graded_at = ?
     WHERE id = ?`,
    [totalScore, now(), id],
  );
}

// =====================================================
// ANSWERS (with grading helpers)
// =====================================================

export type AnswerResult = Record<string, unknown> & {
  id: string;
  attempt_id: string;
  question_id: string;
  response: string;
  auto_score: number | null;
  final_score: number | null;
  parent_comment: string | null;
  created_at: string;
};

export async function saveAnswer(data: {
  attemptId: string;
  questionId: string;
  response: string;
}): Promise<AnswerResult> {
  const id = cuid();
  // UPSERT: if exists, update; else insert
  const existing = await getRow<{ id: string }>(
    `SELECT id FROM answers WHERE attempt_id = ? AND question_id = ?`,
    [data.attemptId, data.questionId],
  );
  if (existing) {
    await runSql(
      `UPDATE answers SET response = ? WHERE id = ?`,
      [data.response, existing.id],
    );
    return (await getRow<AnswerResult>(
      `SELECT * FROM answers WHERE id = ?`,
      [existing.id],
    )) as AnswerResult;
  }
  await runSql(
    `INSERT INTO answers (id, attempt_id, question_id, response, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, data.attemptId, data.questionId, data.response, now()],
  );
  return (await getRow<AnswerResult>(
    `SELECT * FROM answers WHERE id = ?`,
    [id],
  )) as AnswerResult;
}

export async function getAnswersForAttempt(attemptId: string): Promise<AnswerResult[]> {
  return allRows<AnswerResult>(
    `SELECT * FROM answers WHERE attempt_id = ?`,
    [attemptId],
  );
}

export async function getAnswersWithQuestionsForAttempt(
  attemptId: string,
): Promise<Array<{ answer: AnswerResult; question: QuestionRow }>> {
  const rows = await allRows<Record<string, unknown>>(
    `SELECT a.id AS answer_id, a.response, a.auto_score, a.final_score,
            a.parent_comment, a.created_at,
            q.*
     FROM answers a
     JOIN questions q ON q.id = a.question_id
     WHERE a.attempt_id = ?
     ORDER BY q.order_index ASC`,
    [attemptId],
  );
  return rows.map((r) => {
    const answer = {
      id: r.answer_id as string,
      attempt_id: r.attempt_id as string,
      question_id: r.question_id as string,
      response: r.response as string,
      auto_score: r.auto_score as number | null,
      final_score: r.final_score as number | null,
      parent_comment: r.parent_comment as string | null,
      created_at: r.created_at as string,
    } as AnswerResult;
    // Built with mapQuestion rather than a hand-written field list.
    //
    // The list that was here spelled out every column by hand, and it silently
    // omitted image_url — so the review screen showed a question with a figure
    // and no figure. Nothing warned about it: `as unknown as QuestionRow` makes
    // any shape legal. Reusing the shared mapper means a column added to the
    // questions table reaches this path without anyone remembering to edit a
    // second list.
    const question = mapQuestion(r);
    return { answer, question };
  });
}

export async function setAnswerAutoScore(answerId: string, score: number) {
  await runSql(
    `UPDATE answers SET auto_score = ?, final_score = ? WHERE id = ?`,
    [score, score, answerId],
  );
}

export async function setAnswerParentReview(
  answerId: string,
  finalScore: number,
  parentComment: string | null,
) {
  await runSql(
    `UPDATE answers SET final_score = ?, parent_comment = ? WHERE id = ?`,
    [finalScore, parentComment, answerId],
  );
}

export async function getAnswerByQ(attemptId: string, questionId: string): Promise<string | null> {
  const row = await getRow<{ response: string }>(
    `SELECT response FROM answers WHERE attempt_id = ? AND question_id = ?`,
    [attemptId, questionId],
  );
  return row?.response ?? null;
}

export async function finalizeAttemptScore(attemptId: string, totalScore: number) {
  // `submitted_at` is recorded here and NOT in submitAttempt(), which nothing
  // ever called — so every attempt in the DB had submitted_at = NULL. That is
  // why the results page showed no timestamps and no completion time, and why
  // `ORDER BY submitted_at DESC` (listAttempts) had nothing to sort by.
  //
  // COALESCE matters: finalizeAttemptScore is called twice per attempt —
  // once on the child's submit (autoGradeAttempt) and again whenever a parent
  // reviews an essay later (reviewEssayAnswer). A plain assignment would let
  // that later review overwrite the real submit time, and the duration would
  // silently grow every time a parent saved a comment.
  await runSql(
    `UPDATE attempts
     SET total_score = ?, status = 'graded', graded_at = ?,
         submitted_at = COALESCE(submitted_at, ?)
     WHERE id = ?`,
    [totalScore, now(), now(), attemptId],
  );
}


// =====================================================
// PASSWORD
// =====================================================

export async function updateUserPassword(userId: string, passwordHash: string) {
  await runSql(
    `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`,
    [passwordHash, now(), userId],
  );
}

/**
 * Invalidate every session issued before this call.
 *
 * The session is a JWT, so changing password_hash does nothing to cookies that
 * are already in the wild — they keep working until they expire, 30 days
 * later. Bumping token_version makes the mismatch detectable: a token minted
 * with the old number no longer matches the row, and lib/auth.ts treats the
 * session as signed out.
 *
 * This is the "I think someone has my password" button actually working. With
 * the bump removed, a parent could reset a leaked password and the thief would
 * walk straight back in.
 */
export async function bumpTokenVersion(userId: string): Promise<number> {
  const row = await getRow<{ token_version: number }>(
    `UPDATE users SET token_version = token_version + 1, updated_at = ?
     WHERE id = ?
     RETURNING token_version`,
    [now(), userId],
  );
  return Number(row?.token_version ?? 0);
}

// =====================================================
// USER SETTINGS (notification + privacy preferences)
// =====================================================

export type UserSettings = {
  notifyEmail: boolean;
  notifyWhatsapp: boolean;
  notifyInapp: boolean;
  notifyAttempt: boolean;
  anonymousShare: boolean;
  allowAnalytics: boolean;
  allowMarketing: boolean;
};

/** The values a user gets before they have ever touched a toggle. Kept in one
 *  place so the DB defaults, this fallback and the UI copy cannot drift. */
export const SETTINGS_DEFAULTS: UserSettings = {
  notifyEmail: true,
  notifyWhatsapp: true,
  notifyInapp: true,
  notifyAttempt: true,
  anonymousShare: false,
  allowAnalytics: true,
  allowMarketing: false,
};

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const row = await getRow<Record<string, unknown>>(
    `SELECT * FROM user_settings WHERE user_id = ?`,
    [userId],
  );
  if (!row) return { ...SETTINGS_DEFAULTS };
  const b = (v: unknown) => Boolean(v);
  return {
    notifyEmail: b(row.notify_email),
    notifyWhatsapp: b(row.notify_whatsapp),
    notifyInapp: b(row.notify_inapp),
    notifyAttempt: b(row.notify_attempt),
    anonymousShare: b(row.anonymous_share),
    allowAnalytics: b(row.allow_analytics),
    allowMarketing: b(row.allow_marketing),
  };
}

const SETTING_COLUMNS = {
  notifyEmail: "notify_email",
  notifyWhatsapp: "notify_whatsapp",
  notifyInapp: "notify_inapp",
  notifyAttempt: "notify_attempt",
  anonymousShare: "anonymous_share",
  allowAnalytics: "allow_analytics",
  allowMarketing: "allow_marketing",
} as const;

export type SettingKey = keyof typeof SETTING_COLUMNS;

export async function updateUserSettings(
  userId: string,
  patch: Partial<Record<SettingKey, boolean>>,
) {
  const entries = (Object.keys(patch) as SettingKey[]).filter(
    (k) => typeof patch[k] === "boolean",
  );
  if (entries.length === 0) return;

  // Upsert: the row is created on the first toggle the user flips, so a brand
  // new account never has to seed settings up front.
  const cols = entries.map((k) => SETTING_COLUMNS[k]);
  const values = entries.map((k) => (patch[k] ? 1 : 0));
  await runSql(
    `INSERT INTO user_settings (user_id, ${cols.join(", ")}, updated_at)
     VALUES (?, ${cols.map(() => "?").join(", ")}, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       ${cols.map((c) => `${c} = excluded.${c}`).join(", ")},
       updated_at = excluded.updated_at`,
    [userId, ...values, now()],
  );
}