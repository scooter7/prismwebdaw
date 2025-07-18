import { FunctionComponent } from 'react';
import { MidiRegion } from '../core/MidiRegion';
import { LocationToTime, TimeSignature, Location } from '../core/Common';
import { MidiDataType, NoteMidiData } from '../core/MidiData';
import { TIMELINE_FACTOR_PX } from './Config';
import styles from './PianoRoll.module.css';
import { TimelineGenerator, TimelineSettings } from './Timeline';

export interface PianoRollProps {
  region: MidiRegion;
  timeSignature: TimeSignature;
  converter: LocationToTime;
  scale: number;
  end: Location;
}

const NOTE_HEIGHT = 20; // px
const notes = Array.from({ length: 128 }, (_, i) => 127 - i); // MIDI notes from 127 down to 0
const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const isBlackKey = (note: number) => {
  const key = note % 12;
  return key === 1 || key === 3 || key === 6 || key === 8 || key === 10;
};

export const PianoRoll: FunctionComponent<PianoRollProps> = (props) => {
  const scaleFactor = props.scale * TIMELINE_FACTOR_PX;
  const regionStartTime = props.converter.convertLocation(props.region.position);
  const regionDuration = props.converter.convertDurationAtLocation(
    props.region.length,
    props.region.position,
  );
  const gridWidth = regionDuration * scaleFactor;
  const gridHeight = notes.length * NOTE_HEIGHT;

  const settings = new TimelineSettings(props.scale);
  const tickIterator = new TimelineGenerator(
    props.region.position,
    props.region.position.add(props.region.length, props.timeSignature),
    settings.minorStep,
    props.timeSignature,
  );

  return (
    <div className={styles.pianoRoll}>
      <div className={styles.keyboard}>
        {notes.map((note) => (
          <div
            key={note}
            className={`${styles.key} ${isBlackKey(note) ? styles.blackKey : styles.whiteKey}`}
            style={{ height: NOTE_HEIGHT }}
          >
            {noteNames[note % 12]}
            {Math.floor(note / 12) - 1}
          </div>
        ))}
      </div>
      <div className={styles.gridContainer}>
        <div className={styles.grid} style={{ width: gridWidth, height: gridHeight }}>
          {/* Vertical grid lines */}
          {Array.from(tickIterator).map((location) => {
            const time = props.converter.convertLocation(location) - regionStartTime;
            if (time < 0) return null;
            return (
              <div
                key={`v-line-${location.bar}-${location.beat}-${location.tick}`}
                className={styles.gridLineVertical}
                style={{ left: time * scaleFactor, height: gridHeight }}
              />
            );
          })}
          {/* Horizontal grid lines */}
          {notes.map((note, index) => (
            <div
              key={`h-line-${note}`}
              className={
                isBlackKey(note) ? styles.gridLineHorizontalDark : styles.gridLineHorizontal
              }
              style={{ top: index * NOTE_HEIGHT, width: gridWidth }}
            />
          ))}
          {/* Notes */}
          {props.region.midiData.map((noteData, index) => {
            if (noteData.type !== MidiDataType.Note) return null;

            const note = noteData as NoteMidiData;
            const noteStartTime = props.converter.convertLocation(note.start);
            const relativeNoteStartTime = noteStartTime - regionStartTime;
            const noteDuration = props.converter.convertDurationAtLocation(
              note.duration,
              note.start,
            );

            const noteStyle = {
              top: `${(127 - note.note) * NOTE_HEIGHT}px`,
              left: `${relativeNoteStartTime * scaleFactor}px`,
              width: `${noteDuration * scaleFactor}px`,
              height: `${NOTE_HEIGHT - 2}px`, // a bit smaller for border
            };

            return <div key={index} className={styles.note} style={noteStyle} />;
          })}
        </div>
      </div>
    </div>
  );
};