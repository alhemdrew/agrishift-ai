import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  matchingSpeechVoice,
  recognitionErrorMessage,
  recognitionLocale,
  speechRecognitionConstructor,
  speechLocale,
  speechTranscript,
  waitForMatchingSpeechVoice,
  type SpeechRecognitionWindow,
} from './speech';

afterEach(() => {
  vi.useRealTimers();
});

describe('assistant speech helpers', () => {
  it('uses explicit locale tags for each language without substituting English', () => {
    expect(['en', 'ha', 'yo', 'ig'].map((language) => recognitionLocale(language as 'en' | 'ha' | 'yo' | 'ig')))
      .toEqual(['en-US', 'ha-NG', 'yo-NG', 'ig-NG']);
    expect(speechLocale('yo')).toBe('yo-NG');
  });

  it('selects only a voice matching the selected language', () => {
    const voices = [
      { name: 'English Voice', lang: 'en-US' },
      { name: 'Yoruba Voice', lang: 'yo-NG' },
    ];
    expect(matchingSpeechVoice(voices, 'yo')).toBe(voices[1]);
    expect(matchingSpeechVoice(voices, 'ha')).toBeUndefined();
  });

  it('uses a matching voice that loads after the initial voice query', async () => {
    const listeners = new Set<EventListener>();
    let voices: Array<{ name: string; lang: string }> = [];
    const provider = {
      getVoices: () => voices,
      addEventListener: (_type: 'voiceschanged', listener: EventListener) => listeners.add(listener),
      removeEventListener: (_type: 'voiceschanged', listener: EventListener) => listeners.delete(listener),
    };
    const pendingVoice = waitForMatchingSpeechVoice(provider, 'yo', 1_000);
    voices = [{ name: 'Yoruba', lang: 'yo-NG' }];
    listeners.forEach((listener) => listener(new Event('voiceschanged')));
    await expect(pendingVoice).resolves.toBe(voices[0]);
    expect(listeners.size).toBe(0);
  });

  it('reports no suitable voice after the bounded discovery wait', async () => {
    vi.useFakeTimers();
    const provider = {
      getVoices: () => [{ name: 'English', lang: 'en-US' }],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const pendingVoice = waitForMatchingSpeechVoice(provider, 'ig', 500);
    await vi.advanceTimersByTimeAsync(500);
    await expect(pendingVoice).resolves.toBeUndefined();
    expect(provider.removeEventListener).toHaveBeenCalledOnce();
  });

  it('builds editable text from final and interim recognition results', () => {
    const event = {
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: ' Rainfall' }], { isFinal: true }),
        Object.assign([{ transcript: ' is moderate' }], { isFinal: false }),
      ],
    };
    expect(speechTranscript(event)).toBe('Rainfall is moderate');
  });

  it('maps browser recognition failures to actionable messages', () => {
    expect(recognitionErrorMessage('not-allowed')).toContain('Microphone access was denied');
    expect(recognitionErrorMessage('language-not-supported')).toContain('type your question');
    expect(recognitionErrorMessage('no-speech')).toContain('No speech was detected');
    expect(recognitionErrorMessage('aborted')).toBe('');
  });

  it('detects prefixed and standard browser recognition implementations', () => {
    class Recognition {}
    expect(speechRecognitionConstructor({ SpeechRecognition: Recognition } as unknown as SpeechRecognitionWindow))
      .toBe(Recognition);
    expect(speechRecognitionConstructor({ webkitSpeechRecognition: Recognition } as unknown as SpeechRecognitionWindow))
      .toBe(Recognition);
    expect(speechRecognitionConstructor({} as SpeechRecognitionWindow)).toBeUndefined();
  });
});
