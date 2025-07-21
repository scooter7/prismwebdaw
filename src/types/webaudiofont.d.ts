// This file declares the WebAudioFontPlayer class in the global scope
// for TypeScript, as it's loaded via a script tag.

declare class WebAudioFontPlayer {
  constructor();
  loader: {
    loadInstrument(
      context: AudioContext,
      instrumentId: string,
      onloaded: (buffer: AudioBuffer) => void,
      onerror?: (error: any) => void
    ): void;
    get(instrumentId: string): any;
  };
  audioContext: AudioContext;
  queueWaveTable(
    context: AudioContext,
    destination: AudioNode,
    instrument: any,
    startTime: number,
    midiNote: number,
    duration: number,
    velocity: number,
    bend?: number,
    filter?: any,
    attack?: number,
    release?: number
  ): void;
}