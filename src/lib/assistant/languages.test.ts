import { describe, expect, it } from 'vitest';

import {
  assistantLanguageInstruction,
  assistantLanguageName,
  DEFAULT_ASSISTANT_LANGUAGE,
  isAssistantLanguage,
} from './languages';

describe('assistant languages', () => {
  it('accepts only the supported text language codes', () => {
    expect(['en', 'ha', 'yo', 'ig'].every(isAssistantLanguage)).toBe(true);
    expect(isAssistantLanguage('fr')).toBe(false);
    expect(isAssistantLanguage(undefined)).toBe(false);
  });

  it('defaults to English and provides consistent natural-language requirements for every choice', () => {
    expect(DEFAULT_ASSISTANT_LANGUAGE).toBe('en');
    expect(assistantLanguageName('ha')).toBe('Hausa');
    for (const [language, name] of [
      ['en', 'English'],
      ['ha', 'Hausa'],
      ['yo', 'Yoruba'],
      ['ig', 'Igbo'],
    ] as const) {
      const instruction = assistantLanguageInstruction(language);
      expect(instruction).toContain(`natural, conversational ${name}`);
      expect(instruction).toContain('Do not silently switch to English');
      expect(instruction).toContain('Do not insert English words or phrases just for convenience');
      expect(instruction).toContain('Preserve every measurement, date, percentage, scientific value, and unit exactly');
      expect(instruction).toContain('Do not invent translations for scientific terms, dataset names, or source names');
      expect(instruction).toContain('ask one concise clarification');
    }
  });
});
