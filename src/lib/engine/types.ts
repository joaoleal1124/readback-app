export type Licence = "PPL" | "ATPL";

/**
 * ATC transmits and the pilot reads back. Text may contain {CS} for the callsign.
 * The answer is graded against `readback` (and any `accept` alternative) as a whole:
 * every element, in order, and nothing else. See grade.ts.
 */
export interface TransmissionStep {
  type?: undefined;
  id: string;
  phase: string;
  station: string;
  freq: string;
  context_pt: string;
  atc: string;
  atc_pt: string;
  readback: string;
  readback_pt: string;
  /** Other complete readbacks that are also correct (another valid order or wording). */
  accept?: string[];
  /** Hand-written wrong options for multiple choice. More are generated from the readback. */
  wrong?: string[];
  note_pt: string;
}

/** The pilot speaks first: initial call, request, position report, emergency call. */
export interface CallStep {
  type: "call";
  id: string;
  phase: string;
  /** The station the pilot is calling, and the frequency in use. */
  station: string;
  freq: string;
  context_pt: string;
  /** What the student has to say, element by element, in Portuguese. */
  task_pt: string;
  call: string;
  call_pt: string;
  accept?: string[];
  wrong?: string[];
  note_pt: string;
}

/** A theory question placed between radio exchanges. Always answered by picking an option. */
export interface QuizStep {
  type: "quiz";
  id: string;
  phase: string;
  q_pt: string;
  answer: string;
  /** Three wrong options. */
  wrong: string[];
  note_pt: string;
}

export type Step = TransmissionStep | CallStep | QuizStep;

export interface Simulation {
  id: string;
  level: Licence;
  title: string;
  place: string;
  /** BCP 47 language of the ATC voice, used to pick an accent. */
  accent: string;
  accent_pt: string;
  summary_pt: string;
  steps: Step[];
}

/** Training levels: each unlocks after the previous one is completed. */
export const LEVELS = [
  { n: 1, mode: "choose", name_pt: "Escolha múltipla", name_en: "Multiple choice" },
  { n: 2, mode: "write", name_pt: "Escrita", name_en: "Written" },
  { n: 3, mode: "voice", name_pt: "Voz", name_en: "Voice" },
] as const;

export type LevelNumber = (typeof LEVELS)[number]["n"];
export type AnswerMode = (typeof LEVELS)[number]["mode"];

export const isQuiz = (s: Step): s is QuizStep => s.type === "quiz";
export const isCall = (s: Step): s is CallStep => s.type === "call";
export const isTransmission = (s: Step): s is TransmissionStep => s.type === undefined;
