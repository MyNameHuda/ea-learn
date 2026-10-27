/**
 * Auto-grade engine for EaLearn.
 * Handles PG and Essay hybrid grading (keyword-based suggestion).
 */

import {
  getAttemptById,
  getAnswersForAttempt,
  listQuizQuestions,
  setAnswerAutoScore,
  finalizeAttemptScore,
  setAnswerParentReview,
  getAnswersWithQuestionsForAttempt,
  type ChildAnswerRow,
} from "@/lib/queries/data";
import type { QuestionType } from "@/lib/queries";

export type GradeSummary = {
  totalScore: number;
  maxScore: number;
  mcScore: number;
  mcMax: number;
  essayAutoScore: number;
  essayMax: number;
  essayPendingCount: number;
};

/**
 * Case-insensitive whole-word match for essay keywords.
 * Returns the weight if matched, 0 otherwise.
 */
function matchKeyword(text: string, keyword: string): boolean {
  if (!keyword.trim()) return false;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(^|\\s|[.,!?;:])${escaped}($|\\s|[.,!?;:])`, "i");
  return regex.test(text);
}

function gradeEssayAnswer(
  response: string,
  keywords: string[],
  weights: number[],
  maxPoints: number,
): number {
  if (!response || !keywords || keywords.length === 0) {
    return 0;
  }
  let matchedWeight = 0;
  let totalWeight = 0;
  for (let i = 0; i < keywords.length; i++) {
    const kw = keywords[i];
    const weight = weights[i] ?? 1;
    totalWeight += weight;
    if (matchKeyword(response, kw)) {
      matchedWeight += weight;
    }
  }
  if (totalWeight === 0) return 0;
  return Math.round((matchedWeight / totalWeight) * maxPoints);
}

function gradeMultipleChoiceAnswer(
  responseIndices: number[],
  correctIndices: number[],
  maxPoints: number,
): number {
  // Strict equality: must match exactly
  const sortedResp = [...responseIndices].sort();
  const sortedCorrect = [...correctIndices].sort();
  const isCorrect =
    sortedResp.length === sortedCorrect.length &&
    sortedResp.every((v, i) => v === sortedCorrect[i]);
  return isCorrect ? maxPoints : 0;
}

/**
 * Auto-grade an entire attempt. Updates all answers + total score in DB.
 * Essay scores are "suggested" — they need parent review to be finalized.
 */
export async function autoGradeAttempt(
  attemptId: string,
): Promise<GradeSummary> {
  const attempt = await getAttemptById(attemptId);
  if (!attempt) throw new Error("Attempt not found");

  const questions = await listQuizQuestions(attempt.quizId);
  const answers = await getAnswersForAttempt(attemptId);
  const answerMap = new Map(answers.map((a) => [a.question_id, a]));

  let totalScore = 0;
  let maxScore = 0;
  let mcScore = 0;
  let mcMax = 0;
  let essayAutoScore = 0;
  let essayMax = 0;
  let essayPendingCount = 0;

  for (const q of questions) {
    maxScore += q.points;
    const ans = answerMap.get(q.id);
    if (!ans) continue;

    if (q.type === "multiple_choice") {
      mcMax += q.points;
      let indices: number[] = [];
      try {
        indices = JSON.parse(ans.response);
        if (!Array.isArray(indices)) indices = [];
      } catch {
        indices = [];
      }
      const correct =
        q.correctAnswer && q.correctAnswer.length > 0 ? q.correctAnswer : [];
      const score = gradeMultipleChoiceAnswer(indices, correct, q.points);
      await setAnswerAutoScore(ans.id, score);
      totalScore += score;
      mcScore += score;
    } else {
      // Essay
      essayMax += q.points;
      const keywords = q.keywords ?? [];
      const weights = q.keywordWeights ?? [];
      const score = gradeEssayAnswer(ans.response, keywords, weights, q.points);
      await setAnswerAutoScore(ans.id, score);
      // Don't add to total yet — essay needs parent review to be finalized
      essayAutoScore += score;
      essayPendingCount++;
    }
  }

  // For MVP, include essay auto-score in total immediately.
  // Parent can still override via the essay review page.
  totalScore += essayAutoScore;
  await finalizeAttemptScore(attemptId, totalScore);

  return {
    totalScore,
    maxScore,
    mcScore,
    mcMax,
    essayAutoScore,
    essayMax,
    essayPendingCount,
  };
}

/**
 * Parent submits final review for a single essay answer.
 * Updates final_score on the answer and recomputes attempt total.
 */
export async function reviewEssayAnswer(
  answerId: string,
  finalScore: number,
  parentComment: string | null,
  attemptId: string,
): Promise<{
  totalScore: number;
  maxScore: number;
}> {
  await setAnswerParentReview(answerId, finalScore, parentComment);

  // Recompute attempt total from all answers
  const combined = await getAnswersWithQuestionsForAttempt(attemptId);
  let total = 0;
  let maxScore = 0;
  for (const { question, answer } of combined) {
    maxScore += question.points;
    total += answer.final_score ?? answer.auto_score ?? 0;
  }
  await finalizeAttemptScore(attemptId, total);

  const attempt = await getAttemptById(attemptId);
  return { totalScore: total, maxScore: attempt?.maxScore ?? maxScore };
}

// =====================================================
// RINGKASAN HASIL UNTUK ANAK
// =====================================================

export type ChildAnswerStatus = "correct" | "wrong" | "partial" | "pending";

export type ChildAnswerSummary = {
  /** Nomor soal, sesuai urutan di kuis. */
  index: number;
  prompt: string;
  type: QuestionType;
  points: number;
  /** Teks jawaban anak. null kalau tidak dijawab. */
  given: string | null;
  status: ChildAnswerStatus;
  /** "15/20" untuk essay yang sudah direview; null untuk PG. */
  scoreLabel: string | null;
};

export type ChildSummaryTally = {
  correct: number;
  wrong: number;
  partial: number;
  pending: number;
  total: number;
};

/**
 * Teks jawaban anak, apa adanya.
 *
 * Untuk PG, response adalah array indeks dalam JSON, jadi diterjemahkan jadi
 * teks opsinya supaya anak melihat kalimat yang dia pilih, bukan angka.
 * Kalau ada indeks yang di luar jangkauan, teksnya dibuat tetap masuk akal
 * ("Opsi 3") alih-alih "undefined".
 */
function describeGiven(row: ChildAnswerRow): string | null {
  if (row.response === null || row.response === undefined) return null;

  if (row.type === "multiple_choice") {
    let indices: number[] = [];
    try {
      const parsed = JSON.parse(row.response);
      if (Array.isArray(parsed)) indices = parsed.filter((n) => typeof n === "number");
    } catch {
      indices = [];
    }
    if (indices.length === 0) return null;
    const labels = indices.map((i) => {
      const opt = row.options?.[i];
      return opt && opt.trim() ? opt.trim() : `Opsi ${i + 1}`;
    });
    return labels.join(", ");
  }

  const text = (row.response ?? "").trim();
  return text.length > 0 ? text : null;
}

/**
 * Ringkasan jawaban untuk halaman hasil anak.
 *
 * Yang ditampilkan: soal, jawaban anak sendiri, dan apakah itu benar.
 *
 * Yang SENGAJA tidak ditampilkan: jawaban yang benar. Kalau jawaban anak
 * salah, halaman ini hanya mengatakan nomornya salah. Kuncinya sendiri tidak
 * pernah masuk ke jalur ini — getAttemptSummaryForChild() tidak mengambil
 * kolom correct_answer dari database — jadi tidak ada yang bisa bocor karena
 * "lupa dihapus" di suatu tempat.
 *
 * Status per soal:
 *   - PG dinilai lenient: benar kalau dapat poin penuh, salah kalau nol.
 *   - Essay belum direview orang tua: "menunggu review", bukan "salah" —
 *     belum ada yang menilai, jadi menyebutnya salah akan bohong.
 *   - Essay sudah direview: benar / sebagian benar / salah sesuai nilainya,
 *     karena essay punya skor parsial dan tidak bisa disebut benar-salah.
 */
export function buildChildSummary(rows: ChildAnswerRow[]): ChildAnswerSummary[] {
  return rows.map((row) => {
    const given = describeGiven(row);

    if (row.type === "multiple_choice") {
      const score = row.autoScore;
      const status: ChildAnswerStatus =
        score === null
          ? "pending"
          : score >= row.points
            ? "correct"
            : score > 0
              ? "partial"
              : "wrong";
      return {
        index: row.orderIndex,
        prompt: row.prompt,
        type: row.type,
        points: row.points,
        given,
        status,
        scoreLabel: null,
      };
    }

    // Essay: nilai final baru ada setelah orang tua mereview.
    const final = row.finalScore;
    const status: ChildAnswerStatus =
      final === null
        ? "pending"
        : final >= row.points
          ? "correct"
          : final > 0
            ? "partial"
            : "wrong";
    return {
      index: row.orderIndex,
      prompt: row.prompt,
      type: row.type,
      points: row.points,
      given,
      status,
      scoreLabel: final === null ? null : `${final}/${row.points}`,
    };
  });
}

/** Rekap jumlah benar / salah / menunggu review. */
export function tallyChildSummary(list: ChildAnswerSummary[]): ChildSummaryTally {
  const t: ChildSummaryTally = { correct: 0, wrong: 0, partial: 0, pending: 0, total: list.length };
  for (const a of list) {
    if (a.status === "correct") t.correct++;
    else if (a.status === "wrong") t.wrong++;
    else if (a.status === "partial") t.partial++;
    else t.pending++;
  }
  return t;
}
