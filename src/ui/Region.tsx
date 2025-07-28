import { FunctionComponent, useEffect, useRef, useState } from 'react';

import styles from './Region.module.css';
import { RegionDataType, RegionInterface } from '../core/Region';
import { Duration, Location, LocationToTime, TimeSignature } from '../core/Common';
import {
  REGION_HEIGHT_PX,
  REGION_RENDERING_HEIGHT_PX,
  TIMELINE_FACTOR_PX,
  TRACK_HEIGHT_PX,
} from './Config';
import { AudioRegion } from '../core/AudioRegion';
import { EditableText } from '@blueprintjs/core';
import { TimelineSettings } from './Timeline';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

export interface RegionProps {
  region: RegionInterface;
  trackIndex: number;
  regionIndex: number;
  scale: number;
  converter: LocationToTime;
  onMove: (trackIndex: number, regionIndex: number, newPosition: Location) => void;
  onResize: (trackIndex: number, regionIndex: number, newLength: Duration) => void;
  onDoubleClick: (trackIndex: number, regionIndex: number) => void;
  onSplit: (trackIndex: number, regionIndex: number, splitLocation: Location, converter: LocationToTime) => void;
  onDuplicate: (trackIndex: number, regionIndex: number, targetLocation: Location, converter: LocationToTime) => void;
  onDelete: (trackIndex: number, regionIndex: number) => void; // New prop for deleting regions
  timeSignature: TimeSignature;
  end: Location;
  currentPlaybackLocation: Location; // Added to determine split point
}

function audioToImage(audioBuffer: AudioBuffer, width: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = REGION_RENDERING_HEIGHT_PX;
  drawAudioBuffer(audioBuffer, canvas);
  return canvas.toDataURL();
}

function drawAudioBuffer(audioBuffer: AudioBuffer, canvas: HTMLCanvasElement) {
  // ensure that the bufer is not empty
  if (!audioBuffer.length || !audioBuffer.duration) {
    return;
  }

  const duration = audioBuffer.duration;
  const context = canvas.getContext('2d')!;
  const data = audioBuffer.getChannelData(0);
  const bufferScale = audioBuffer.length / audioBuffer.duration;
  const endOffset = Math.min(duration * bufferScale, audioBuffer.length);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineWidth = 2;
  context.strokeStyle = 'white';
  context.beginPath();
  const sliceWidth = canvas.width / (duration * bufferScale);
  let x = 0;
  for (let i = 0; i < endOffset; i++) {
    const v = data[i] / 2.0 + 0.5;
    const y = v * canvas.height;
    if (i === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
    x += sliceWidth;
  }
  context.stroke();
}

/**
 * The state of the drag operation.
 */
enum DragState {
  None,
  Left,
  Right,
  Region,
  Loop,
}

export const Region: FunctionComponent<RegionProps> = (props: RegionProps) => {
  const [selected, setSelected] = useState(false);
  const [name, setName] = useState(props.region.name);
  const [tempStyle, setTempStyle] = useState<{ left?: number; width?: number } | null>(null);

  const scaleFactor = props.scale * TIMELINE_FACTOR_PX;
  const initialLeft = props.converter.convertLocation(props.region.position) * scaleFactor;
  const initialDuration = props.converter.convertDurationAtLocation(
    props.region.length,
    props.region.position,
  );
  const initialWidth = initialDuration * scaleFactor;

  var audioImageOffset = 0;
  var audioImageWidth = 0;

  if (props.region.data.type === RegionDataType.Audio) {
    const audioRegion = props.region as AudioRegion;
    audioImageWidth = scaleFactor * audioRegion.audioFile.buffer.duration;
    audioImageOffset =
      scaleFactor *
      props.converter.convertDurationAtLocation(audioRegion.trim, audioRegion.position);
  }

  const style = {
    backgroundColor: props.region.color,
    borderColor: selected ? 'hsl(var(--accent))' : props.region.color,
    width: tempStyle?.width !== undefined ? `${tempStyle.width}px` : `${initialWidth}px`,
    height: `${REGION_HEIGHT_PX}px`,
    left: tempStyle?.left !== undefined ? `${tempStyle.left}px` : `${initialLeft}px`,
    top: `${props.trackIndex * TRACK_HEIGHT_PX}px`,
  };

  /**
   * Retrieve the image for the region at the given scale factor.
   *
   * @param scaleFactor conversion factor from seconds to pixels
   * @returns an image URL representing the region at the requested scale
   */
  function retrieveImage(scaleFactor: number): string {
    const cacheKey = scaleFactor;
    const cachedItem = props.region.cache[cacheKey];

    if (cachedItem) {
      return cachedItem;
    } else if (props.region.data.type === RegionDataType.Audio) {
      const audioBuffer = props.region.data.audioBuffer;
      const image = audioToImage(audioBuffer, scaleFactor * audioBuffer.duration);
      props.region.cache[cacheKey] = image;
      return image;
    } else {
      return '';
    }
  }

  const renderData = useRef<string>('');
  if (renderData.current === '' && props.region.data.type === RegionDataType.Audio) {
    renderData.current = retrieveImage(scaleFactor);
  }

  useEffect(() => {
    if (props.region.data.type === RegionDataType.Audio) {
      renderData.current = retrieveImage(scaleFactor);
    }
  }, [initialDuration, props.scale, props.region.length]);

  function toggleSelection() {
    setSelected(!selected);
  }

  function changeName(name: string) {
    setName(name);
    props.region.name = name;
  }

  // Internal state variable to track the drag state.
  const dragState = useRef<DragState>(DragState.None);
  const dragStartX = useRef<number>(0);
  const dragStartRegionPosition = useRef<Location>(new Location());

  function onDragLeftStart(event: React.PointerEvent<HTMLDivElement>) {
    if (dragState.current === DragState.None) {
      event.currentTarget.setPointerCapture(event.pointerId);
      dragState.current = DragState.Left;
      dragStartX.current = event.clientX;
    }
  }

  function onDragLeftMove(event: React.PointerEvent<HTMLDivElement>) {
    // Not implemented yet
  }

  function onDragLeftEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (dragState.current === DragState.Left) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      dragState.current = DragState.None;
    }
  }

  function onDragRightStart(event: React.PointerEvent<HTMLDivElement>) {
    if (dragState.current === DragState.None) {
      event.currentTarget.setPointerCapture(event.pointerId);
      dragState.current = DragState.Right;
      dragStartX.current = event.clientX;
    }
  }

  function onDragRightMove(event: React.PointerEvent<HTMLDivElement>) {
    if (dragState.current === DragState.Right) {
      const deltaX = event.clientX - dragStartX.current;
      const newWidth = Math.max(initialWidth + deltaX, 10); // min width 10px
      setTempStyle({ width: newWidth });
    }
  }

  function onDragRightEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (dragState.current === DragState.Right) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      dragState.current = DragState.None;
      setTempStyle(null);

      const deltaX = event.clientX - dragStartX.current;
      const newWidth = Math.max(initialWidth + deltaX, 10);
      const newDurationSeconds = newWidth / scaleFactor;

      const settings = new TimelineSettings(props.scale);
      const startInSeconds = props.converter.convertLocation(props.region.position);
      const newEndInSeconds = startInSeconds + newDurationSeconds;

      const snappedEndLocation = settings.snap(
        newEndInSeconds,
        props.end,
        props.timeSignature,
        props.converter,
      );
      const newLength = props.region.position.diff(snappedEndLocation, props.timeSignature);

      props.onResize(props.trackIndex, props.regionIndex, newLength);
    }
  }

  function onDragRegionStart(event: React.PointerEvent<HTMLDivElement>) {
    if (dragState.current === DragState.None) {
      event.currentTarget.setPointerCapture(event.pointerId);
      dragState.current = DragState.Region;
      dragStartX.current = event.clientX;
      dragStartRegionPosition.current = props.region.position;
    }
  }

  function onDragRegionMove(event: React.PointerEvent<HTMLDivElement>) {
    if (dragState.current === DragState.Region) {
      const deltaX = event.clientX - dragStartX.current;
      const newLeft = initialLeft + deltaX;
      setTempStyle({ left: newLeft });
    }
  }

  function onDragRegionEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (dragState.current === DragState.Region) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      dragState.current = DragState.None;
      setTempStyle(null);

      const deltaX = event.clientX - dragStartX.current;
      const deltaTime = deltaX / scaleFactor;
      const initialTime = props.converter.convertLocation(dragStartRegionPosition.current);
      const newTime = initialTime + deltaTime;

      const settings = new TimelineSettings(props.scale);
      const newPosition = settings.snap(newTime, props.end, props.timeSignature, props.converter);

      props.onMove(props.trackIndex, props.regionIndex, newPosition);
    }
  }

  function onDragLoopStart(event: React.PointerEvent<HTMLDivElement>) {
    if (dragState.current === DragState.None) {
      event.currentTarget.setPointerCapture(event.pointerId);
      dragState.current = DragState.Loop;
      dragStartX.current = event.clientX;
    }
  }

  function onDragLoopMove(event: React.PointerEvent<HTMLDivElement>) {
    // Not implemented yet
  }

  function onDragLoopEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (dragState.current === DragState.Loop) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      dragState.current = DragState.None;
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent default browser context menu
    // The DropdownMenuTrigger will handle opening the menu
  };

  const handleSplit = () => {
    const regionStartTime = props.converter.convertLocation(props.region.position);
    const regionEndTime = props.converter.convertLocation(props.region.position.add(props.region.length, props.timeSignature));
    const currentPlaybackTime = props.converter.convertLocation(props.currentPlaybackLocation);

    // Check if playback head is within the region
    if (currentPlaybackTime > regionStartTime && currentPlaybackTime < regionEndTime) {
      props.onSplit(props.trackIndex, props.regionIndex, props.currentPlaybackLocation, props.converter);
    } else {
      // Optionally, provide feedback to the user that split is only at playback head
      console.warn("Cannot split: Playback head is not within the region.");
    }
  };

  const handleDuplicate = () => {
    const targetLocation = props.region.position.add(props.region.length, props.timeSignature);
    props.onDuplicate(props.trackIndex, props.regionIndex, targetLocation, props.converter);
  };

  const handleDelete = () => {
    props.onDelete(props.trackIndex, props.regionIndex);
  };

  const regionStartTime = props.converter.convertLocation(props.region.position);
  const regionEndTime = props.converter.convertLocation(props.region.position.add(props.region.length, props.timeSignature));
  const currentPlaybackTime = props.converter.convertLocation(props.currentPlaybackLocation);
  const canSplit = currentPlaybackTime > regionStartTime && currentPlaybackTime < regionEndTime;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div
          className={styles.region}
          style={style}
          onClick={toggleSelection}
          onDoubleClick={() => props.onDoubleClick(props.trackIndex, props.regionIndex)}
          onContextMenu={handleContextMenu}
        >
          <div className={styles.handles}>
            <div
              className={styles.leftHandle}
              onPointerDown={onDragLeftStart}
              onPointerMove={onDragLeftMove}
              onPointerUp={onDragLeftEnd}
            />
            <div
              className={styles.centerHandle}
              onPointerDown={onDragRegionStart}
              onPointerMove={onDragRegionMove}
              onPointerUp={onDragRegionEnd}
            />
            <div
              className={styles.rightHandle}
              onPointerDown={onDragRightStart}
              onPointerMove={onDragRightMove}
              onPointerUp={onDragRightEnd}
            />
            <div
              className={styles.loopHandle}
              onPointerDown={onDragLoopStart}
              onPointerMove={onDragLoopMove}
              onPointerUp={onDragLoopEnd}
            />
          </div>
          <div className="p-1 truncate">
            <EditableText
              alwaysRenderInput={true}
              value={props.region.name}
              onChange={(value: string) => {
                changeName(value);
              }}
            />
          </div>
          {props.region.data.type === RegionDataType.Audio && (
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: `${REGION_RENDERING_HEIGHT_PX}px`,
                overflowX: 'hidden',
              }}
            >
              <img
                alt={props.region.name}
                height={REGION_RENDERING_HEIGHT_PX}
                width={audioImageWidth}
                src={renderData.current}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: `${-audioImageOffset}px`,
                }}
              />
            </div>
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={handleSplit} disabled={!canSplit}>
          Split Region
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDuplicate}>
          Duplicate Region
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDelete}>
          Delete Region
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};