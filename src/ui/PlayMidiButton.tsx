import React from 'react';
import { useMidiSounds } from '../integrations/midi/MidiSoundsProvider';

export const PlayMidiButton: React.FC = () => {
  const { midiSounds } = useMidiSounds();

  const playChord = () => {
    if (midiSounds) {
      // Instrument 3 is Acoustic Grand Piano, notes 60, 64, 67 = C major chord
      midiSounds.playChordNow(3, [60, 64, 67], 2);
    }
  };

  return (
    <button onClick={playChord}>
      Play C Major Chord
    </button>
  );
};