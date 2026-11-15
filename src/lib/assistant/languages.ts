export const ASSISTANT_LANGUAGES = [
  { code: 'en', name: 'English', recognitionLocale: 'en-US', speechLocale: 'en-US' },
  { code: 'ha', name: 'Hausa', recognitionLocale: 'ha-NG', speechLocale: 'ha-NG' },
  { code: 'yo', name: 'Yoruba', recognitionLocale: 'yo-NG', speechLocale: 'yo-NG' },
  { code: 'ig', name: 'Igbo', recognitionLocale: 'ig-NG', speechLocale: 'ig-NG' },
] as const;

export type AssistantLanguage = (typeof ASSISTANT_LANGUAGES)[number]['code'];
export const DEFAULT_ASSISTANT_LANGUAGE: AssistantLanguage = 'en';

export function isAssistantLanguage(value: unknown): value is AssistantLanguage {
  return typeof value === 'string'
    && ASSISTANT_LANGUAGES.some((language) => language.code === value);
}

export function assistantLanguageName(language: AssistantLanguage): string {
  return ASSISTANT_LANGUAGES.find((item) => item.code === language)?.name ?? 'English';
}

export function assistantLanguageInstruction(language: AssistantLanguage): string {
  const name = assistantLanguageName(language);
  return [
    `Write the complete answer in natural, conversational ${name} that a farmer can understand; do not translate English sentence-by-sentence.`,
    `Keep ${name} as the response language throughout, including clarifications and follow-up questions. Do not silently switch to English if wording is difficult.`,
    'Do not insert English words or phrases just for convenience. Retain English only for established names or technical terms without a reliable natural equivalent, and briefly explain those terms in the selected language.',
    'Use clear, familiar agricultural vocabulary only when confident. If a scientific or agricultural term has no reliable equivalent, retain its established English term and briefly explain it in simple language in the selected response language.',
    'Do not invent translations for scientific terms, dataset names, or source names. Preserve crop names when translation could change their meaning.',
    'Preserve every measurement, date, percentage, scientific value, and unit exactly; never convert, round, or infer a value unless the user asks.',
    'When you cannot confidently understand the question or express a critical point, say so briefly in the selected language and ask one concise clarification instead of guessing or switching languages.',
    'Answer what the verified observations reasonably establish before asking at most one useful follow-up question. Keep the answer concise and practical.',
  ].join(' ');
}
