import React, { createContext, useContext, useRef, useEffect } from 'react';
import MIDISounds from 'midi-sounds-react';

type MidiSoundsContextType = {
  midiSounds: any | null;
};

const MidiSoundsContext = createContext<MidiSoundsContextType>({ midiSounds: null });

export const useMidiSounds = () => useContext(MidiSoundsContext);

export const MidiSoundsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const midiSoundsRef = useRef<any>(null);

  // Optionally, you can preload instruments here using useEffect

  return (
    <MidiSoundsContext.Provider value={{ midiSounds: midiSoundsRef.current }}>
      <MIDISounds
        ref={midiSoundsRef}
        appElementName="root"
        instruments={[3, 5, 7, 9, 11, 13, 15, 17, 19, 21]} // preload some instruments
        drums={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]} // preload some drums
        style={{ display: 'none' }} // Hide the UI
      />
      {children}
    </MidiSoundsContext.Provider>
  );
};