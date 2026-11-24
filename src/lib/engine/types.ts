export type Licence = "PPL" | "ATPL";

/** A radio exchange: ATC transmits, the pilot reads back. Text may contain {CS} for the callsign. */
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
  /** Elements a correct answer must contain. "a|b" accepts either alternative. */
  keys: string[];
  /** Wrong options for multiple choice. */
  wrong: string[];
  note_pt: string;
}

/** A theory question placed between radio exchanges. */
export interface QuizStep {
  type: "quiz";
  id: string;
  phase: string;
  q_pt: string;
  answer: string;
  keys: string[];
  wrong: string[];
  note_pt: string;
}

export type Step = TransmissionStep | QuizStep;

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
