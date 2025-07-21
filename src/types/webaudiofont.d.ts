declare module 'webaudiofont' {
  export class WebAudioFontPlayer {
    constructor();
    loader: {
      loadInstrument(
        context: AudioContext,
        instrumentId: string,
        onloaded: (buffer: AudioBuffer) => void,
        onerror?: (error: any) => void
      ): void;
      get(instrumentId: string): any; // This will return the loaded instrument data
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
    // Add other methods/properties you might use from WebAudioFontPlayer if needed
  }
}