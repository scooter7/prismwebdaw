import { FunctionComponent, useState, useRef } from 'react';
import { MidiRegion } from '../core/MidiRegion';
import { LocationToTime, TimeSignature, Location } from '../core/Common';
import { MidiDataType, NoteMidiData } from '../core/MidiData';
import { TIMELINE_FACTOR_PX } from './Config';
import styles from './PianoRoll.module.css';
import { TimelineGenerator, TimelineSettings } from './Timeline';
import { cloneDeep } from 'lodash';

export interface PianoRollProps {
  region: MidiRegion;
  timeSignature: TimeSignature;
  converter: LocationToTime;
  scale: number;
  end: Location;
  onUpdateRegion: (region: MidiRegion) => void;
}

const NOTE_HEIGHT = 20; // px
const notes = Array.from({ length: 128 }, (_, i) => 127 - i); // MIDI notes from 127 down to 0
const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const isBlackKey = (note: number) => {
  const key = note % 12;
  return key === 1 || key === 3 || key === 6 || key === 8 || key === 10;
};

interface DragState {
  isDragging: boolean;
  noteIndex: number;
  startX: number;
  startY: number;
  originalNote: NoteMidiData | null;
  tempLeft?: number;
  tempTop?: number;
}

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

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    noteIndex: -1,
    startX: 0,
    startY: 0,
    originalNote: null,
  });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, noteIndex: number) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const originalNote = props.region.midiData[noteIndex] as NoteMidiData;
    setDragState({
      isDragging: true,
      noteIndex,
      startX: e.clientX,
      startY: e.clientY,
      originalNote,
    });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.isDragging || !dragState.originalNote) return;

    const deltaX = e.clientX - dragState.startX;
    const deltaY = e.clientY - dragState.startY;

    const originalNoteTop = (127 - dragState.originalNote.note) * NOTE_HEIGHT;
    const originalNoteLeft =
      (props.converter.convertLocation(dragState.originalNote.start) - regionStartTime) *
      scaleFactor;

    setDragState((prev) => ({
      ...prev,
      tempTop: originalNoteTop + deltaY,
      tempLeft: originalNoteLeft + deltaX,
    }));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragState.isDragging || !dragState.originalNote) return;

    e.currentTarget.releasePointerCapture(e.pointerId);

    const deltaX = e.clientX - dragState.startX;
    const deltaY = e.clientY - dragState.startY;

    // Calculate new pitch
    const pitchChange = -Math.round(deltaY / NOTE_HEIGHT);
    const newNoteNumber = Math.max(0, Math.min(127, dragState.originalNote.note + pitchChange));

    // Calculate new time
    const timeChange = deltaX / scaleFactor;
    const originalNoteTime = props.converter.convertLocation(dragState.originalNote.start);
    const newNoteTime = originalNoteTime + timeChange;

    // Snap to grid
    const snappedLocation = settings.snap(
      newNoteTime,
      props.end,
      props.timeSignature,
      props.converter,
    );

    // Update region data
    const newRegion = cloneDeep(props.region);
    const updatedNote = newRegion.midiData[dragState.noteIndex] as NoteMidiData;
    updatedNote.note = newNoteNumber;
    updatedNote.start = snappedLocation;

    props.onUpdateRegion(newRegion);

    setDragState({ isDragging: false, noteIndex: -1, startX: 0, startY: 0, originalNote: null });
  };

  return (
    <div className={styles.pianoRoll} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
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
          {Array.from(tickIterator).map((location: Location) => {
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

            const isDraggingThisNote = dragState.isDragging && dragState.noteIndex === index;

            const noteStyle = {
              top:
                isDraggingThisNote && dragState.tempTop !== undefined
                  ? `${dragState.tempTop}px`
                  : `${(127 - note.note) * NOTE_HEIGHT}px`,
              left:
                isDraggingThisNote && dragState.tempLeft !== undefined
                  ? `${dragState.tempLeft}px`
                  : `${relativeNoteStartTime * scaleFactor}px`,
              width: `${noteDuration * scaleFactor}px`,
              height: `${NOTE_HEIGHT - 2}px`, // a bit smaller for border
              zIndex: isDraggingThisNote ? 10 : 2,
            };

            return (
              <div
                key={index}
                className={styles.note}
                style={noteStyle}
                onPointerDown={(e) => onPointerDown(e, index)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};