import {
  ASSISTANT_LANGUAGES,
  type AssistantLanguage,
} from './languages';

export interface SpeechVoice {
  lang: string;
  name: string;
}

export interface SpeechVoiceProvider<T extends SpeechVoice = SpeechVoice> {
  getVoices(): readonly T[];
  addEventListener?(type: 'voiceschanged', listener: EventListener): void;
  removeEventListener?(type: 'voiceschanged', listener: EventListener): void;
}

export function recognitionLocale(language: AssistantLanguage): string {
  return ASSISTANT_LANGUAGES.find((item) => item.code === language)?.recognitionLocale ?? 'en-US';
}

export function speechLocale(language: AssistantLanguage): string {
  return ASSISTANT_LANGUAGES.find((item) => item.code === language)?.speechLocale ?? 'en-US';
}

export function matchingSpeechVoice<T extends SpeechVoice>(
  voices: readonly T[],
  language: AssistantLanguage,
): T | undefined {
  const locale = speechLocale(language).toLowerCase();
  const languageCode = language.toLowerCase();
  return voices.find((voice) => voice.lang.toLowerCase() === locale)
    ?? voices.find((voice) => voice.lang.toLowerCase().split('-')[0] === languageCode);
}

export function waitForMatchingSpeechVoice<T extends SpeechVoice>(
  provider: SpeechVoiceProvider<T>,
  language: AssistantLanguage,
  timeoutMs = 1_500,
): Promise<T | undefined> {
  const matchingVoice = () => matchingSpeechVoice(provider.getVoices(), language);
  const availableVoice = matchingVoice();
  if (availableVoice) return Promise.resolve(availableVoice);
  const addEventListener = provider.addEventListener;
  if (!addEventListener || timeoutMs <= 0) return Promise.resolve(undefined);

  return new Promise((resolve) => {
    let settled = false;
    const timeout: { current?: ReturnType<typeof setTimeout> } = {};
    const finish = (voice?: T) => {
      if (settled) return;
      settled = true;
      if (timeout.current) clearTimeout(timeout.current);
      provider.removeEventListener?.('voiceschanged', onVoicesChanged);
      resolve(voice);
    };
    const onVoicesChanged: EventListener = () => {
      const voice = matchingVoice();
      if (voice) finish(voice);
    };
    timeout.current = setTimeout(() => finish(), timeoutMs);
    addEventListener.call(provider, 'voiceschanged', onVoicesChanged);

    // Voice lists may load between the initial read and listener registration.
    const voice = matchingVoice();
    if (voice) finish(voice);
  });
}

export function recognitionErrorMessage(error: string): string {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was denied. Allow microphone access in your browser settings, then try again.';
    case 'language-not-supported':
      return 'This browser speech service does not support recognition in the selected language. You can still type your question.';
    case 'audio-capture':
      return 'No microphone was found. Connect a microphone or continue with text.';
    case 'network':
      return 'The browser speech service could not be reached. Check your connection or continue with text.';
    case 'no-speech':
      return 'No speech was detected. Try again or type your question.';
    case 'aborted':
      return '';
    default:
      return 'Speech recognition failed. You can still type your question.';
  }
}

export interface SpeechRecognitionResultLike {
  readonly length: number;
  readonly isFinal: boolean;
  readonly [index: number]: { readonly transcript: string };
}

export interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}

export function speechTranscript(event: SpeechRecognitionEventLike): string {
  let finalText = '';
  let interimText = '';
  for (let index = 0; index < event.results.length; index += 1) {
    const result = event.results[index];
    if (!result?.[0]) continue;
    if (result.isFinal) finalText += result[0].transcript;
    else interimText += result[0].transcript;
  }
  return `${finalText}${interimText}`.trimStart().slice(0, 1_000);
}

export interface SpeechRecognitionErrorLike {
  readonly error: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

export interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

export function speechRecognitionConstructor(
  browserWindow: SpeechRecognitionWindow,
): (new () => SpeechRecognitionLike) | undefined {
  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
}
