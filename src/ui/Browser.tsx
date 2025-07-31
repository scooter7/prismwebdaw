// src/ui/Browser.tsx

import React, {
  FunctionComponent,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  useCallback,
} from 'react';
import { Icon, Tree, TreeNodeInfo, Spinner } from '@blueprintjs/core';
import { cloneDeep } from 'lodash';
import {
  Duration,
  Location,
  LocationToTime,
  TimeSignature,
} from '../core/Common';
import {
  CLICK_TO_DRAG_TIMEOUT_MS,
  LIBRARY_JSON,
  REGION_PLACEHOLDER_ID,
  REGION_SCROLL_VIEW_ID,
  TIMELINE_FACTOR_PX,
  TRACK_HEIGHT_PX,
} from './Config';
import styles from './Browser.module.css';
import { AudioFile } from '../core/AudioFile';
import { AudioContextContext } from './Context';
import { TrackInterface } from '../core/Track';

export type NodePath = number[];

type NodeData = {
  audioFile?: AudioFile;
  isMidi?: boolean;
  isLoading?: boolean;
} | null;

function canDrag(node: TreeNodeInfo<NodeData>) {
  if (node.nodeData?.isMidi) return true;
  return !!node.nodeData?.audioFile?.ready && !node.nodeData?.isLoading;
}

export type BrowserProps = {
  scale: number;
  timeSignature: TimeSignature;
  converter: LocationToTime;
  end: Location;
  totalWidth: number;
  totalHeight: number;
  tracks: TrackInterface[];
  createNewAudioTrackWithRegion: (
    region: AudioFile,
    location: Location,
    duration: Duration
  ) => void;
  addRegionToTrack: (
    region: AudioFile,
    trackIndex: number,
    location: Location,
    duration: Duration
  ) => void;
  createNewTracksFromMidi: (url: string) => void;
};

type TreeAction =
  | { type: 'DESELECT_ALL' }
  | { type: 'SET_IS_EXPANDED'; payload: { path: NodePath; isExpanded: boolean } }
  | { type: 'SET_IS_SELECTED'; payload: { path: NodePath; isSelected: boolean } }
  | { type: 'RELOAD_TREE_NODES'; payload: { nodes: TreeNodeInfo<NodeData>[] } }
  | { type: 'START_LOAD'; payload: { path: NodePath; audioFile: AudioFile } }
  | { type: 'FINISH_LOAD'; payload: { path: NodePath; success: boolean } };

function forEachNode(
  nodes: TreeNodeInfo<NodeData>[] | undefined,
  fn: (node: TreeNodeInfo<NodeData>) => void
) {
  if (!nodes) return;
  for (const n of nodes) {
    fn(n);
    forEachNode(n.childNodes, fn);
  }
}

function forNodeAtPath(
  nodes: TreeNodeInfo<NodeData>[],
  path: NodePath,
  fn: (node: TreeNodeInfo<NodeData>) => void
) {
  const node = Tree.nodeFromPath(path, nodes);
  if (node) {
    fn(node);
  }
}

function treeReducer(
  state: TreeNodeInfo<NodeData>[],
  action: TreeAction
): TreeNodeInfo<NodeData>[] {
  const newState = cloneDeep(state);
  switch (action.type) {
    case 'DESELECT_ALL':
      forEachNode(newState, (n) => {
        n.isSelected = false;
      });
      return newState;

    case 'SET_IS_EXPANDED':
      forNodeAtPath(newState, action.payload.path, (n) => {
        n.isExpanded = action.payload.isExpanded;
        if (n.childNodes && n.childNodes.length > 0) {
          n.icon = action.payload.isExpanded ? 'folder-open' : 'folder-close';
        }
      });
      return newState;

    case 'SET_IS_SELECTED':
      forNodeAtPath(newState, action.payload.path, (n) => {
        n.isSelected = action.payload.isSelected;
      });
      return newState;

    case 'RELOAD_TREE_NODES':
      return action.payload.nodes;

    case 'START_LOAD':
      forNodeAtPath(newState, action.payload.path, (n) => {
        if (!n.nodeData) n.nodeData = {};
        n.nodeData.audioFile = action.payload.audioFile;
        n.nodeData.isLoading = true;
        n.icon = <Spinner size={16} />;
      });
      return newState;

    case 'FINISH_LOAD':
      forNodeAtPath(newState, action.payload.path, (n) => {
        if (n.nodeData) n.nodeData.isLoading = false;
        n.icon = action.payload.success ? 'music' : 'error';
      });
      return newState;

    default:
      return state;
  }
}

function jsonToTreeNodes(json: any): TreeNodeInfo<NodeData> {
  if (json.children) {
    const isRoot = (json.name || '').toLowerCase() === 'library';
    return {
      id: json.path,
      label: json.name,
      isExpanded: isRoot,
      icon: isRoot ? 'folder-open' : 'folder-close',
      childNodes: json.children.map(jsonToTreeNodes),
      nodeData: null,
    };
  }
  // File node
  const lower = (json.name || '').toLowerCase();
  const isMidi = lower.endsWith('.mid') || lower.endsWith('.midi');
  let urlStr = json.path;
  try {
    urlStr = new URL(json.path, document.baseURI).toString();
  } catch {
    // fallback to raw path
  }
  return {
    id: urlStr,
    label: json.name,
    isExpanded: false,
    icon: isMidi ? 'document' : 'music',
    nodeData: { isMidi, isLoading: false },
  };
}

export const Browser: FunctionComponent<BrowserProps> = (props) => {
  const audioContext = useContext(AudioContextContext)!;
  const [nodes, dispatch] = useReducer(treeReducer, []);

  const treeRef = useRef<Tree<NodeData>>(null);
  const dragLabel = useRef<HTMLDivElement>(null);
  const dragLabelText = useRef<string>('');
  const currentTreeNode = useRef<TreeNodeInfo<NodeData> | null>(null);
  const startDragTimeout = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);

  // ─── Fetch library.json with fallback logic ─────────────────────────────────
  useEffect(() => {
    const candidates = [
      `${process.env.PUBLIC_URL.replace(/\/$/, '')}/${LIBRARY_JSON}`,
      `/${LIBRARY_JSON}`,
    ].filter(Boolean);

    const tryFetchSequentially = async () => {
      for (const candidate of candidates) {
        try {
          console.log('Attempting to fetch library from:', candidate);
          const res = await fetch(candidate);
          console.log(`Response status for ${candidate}:`, res.status);
          if (!res.ok) {
            continue;
          }
          const text = await res.text();
          if (text.trim().toLowerCase().startsWith('<!doctype')) {
            console.warn('Received HTML instead of JSON from', candidate);
            continue;
          }
          const json = JSON.parse(text);
          dispatch({
            type: 'RELOAD_TREE_NODES',
            payload: { nodes: [jsonToTreeNodes(json)] },
          });
          return;
        } catch (e) {
          console.warn('Fetch failed for', candidate, e);
          // try next
        }
      }
      // All failed
      console.error('Failed to load library.json from all candidates');
      dispatch({
        type: 'RELOAD_TREE_NODES',
        payload: {
          nodes: [
            {
              id: 'error',
              label: 'Error loading library',
              isExpanded: false,
              icon: 'error',
              nodeData: null,
            },
          ],
        },
      });
    };

    tryFetchSequentially();
  }, []);

  // ─── Drag logic ─────────────────────────────────────────────────────────────
  const onStartDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      setIsDragging(true);
      e.preventDefault();
      dragStartX.current = e.clientX;
      dragStartY.current = e.clientY;
      (e.target as Element).setPointerCapture(e.pointerId);

      const lbl = dragLabel.current!;
      lbl.style.display = 'block';
      lbl.style.left = `${e.clientX}px`;
      lbl.style.top = `${e.clientY}px`;

      const ph = document.getElementById(REGION_PLACEHOLDER_ID)!;
      if (currentTreeNode.current?.nodeData?.isMidi) {
        ph.style.width = '120px';
      } else if (currentTreeNode.current?.nodeData?.audioFile) {
        const dur = currentTreeNode.current.nodeData.audioFile.buffer.duration;
        ph.style.width = `${dur * props.scale * TIMELINE_FACTOR_PX}px`;
      }
    },
    [props.scale]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (
        !isDragging &&
        currentTreeNode.current &&
        canDrag(currentTreeNode.current)
      ) {
        startDragTimeout.current = window.setTimeout(
          () => onStartDrag(e),
          CLICK_TO_DRAG_TIMEOUT_MS
        );
      }
    },
    [isDragging, onStartDrag]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isDragging) {
        const lbl = dragLabel.current!;
        lbl.style.left = `${e.clientX}px`;
        lbl.style.top = `${e.clientY}px`;

        const regionScrollView = document.getElementById(
          REGION_SCROLL_VIEW_ID
        )!;
        const regionPlaceholder = document.getElementById(
          REGION_PLACEHOLDER_ID
        )!;
        const scrollViewRect = regionScrollView.getBoundingClientRect();
        if (
          e.clientX >= scrollViewRect.left &&
          e.clientX <= scrollViewRect.right &&
          e.clientY >= scrollViewRect.top &&
          e.clientY <= scrollViewRect.bottom
        ) {
          regionPlaceholder.style.display = 'block';
          regionPlaceholder.style.left = `${
            e.clientX -
            scrollViewRect.left +
            regionScrollView.scrollLeft -
            2
          }px`;
          regionPlaceholder.style.top = `${
            e.clientY -
            scrollViewRect.top +
            regionScrollView.scrollTop -
            2
          }px`;
        } else {
          regionPlaceholder.style.display = 'none';
        }
      }
    },
    [isDragging]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (startDragTimeout.current !== null) {
        window.clearTimeout(startDragTimeout.current);
        startDragTimeout.current = null;
      }
      if (isDragging) {
        setIsDragging(false);
        (e.target as Element).releasePointerCapture(e.pointerId);
        dragLabel.current!.style.display = 'none';
        const regionPlaceholder = document.getElementById(
          REGION_PLACEHOLDER_ID
        )!;
        regionPlaceholder.style.display = 'none';

        const regionScrollView = document.getElementById(
          REGION_SCROLL_VIEW_ID
        )!;
        const scrollViewRect = regionScrollView.getBoundingClientRect();
        if (
          e.clientX >= scrollViewRect.left &&
          e.clientX <= scrollViewRect.right &&
          e.clientY >= scrollViewRect.top &&
          e.clientY <= scrollViewRect.bottom &&
          currentTreeNode.current
        ) {
          const isMidi = currentTreeNode.current.nodeData?.isMidi;
          if (isMidi) {
            props.createNewTracksFromMidi(
              currentTreeNode.current.id as string
            );
          } else if (
            currentTreeNode.current.nodeData?.audioFile &&
            props.tracks.length >= 0
          ) {
            const effectiveX =
              e.clientX -
              scrollViewRect.left +
              regionScrollView.scrollLeft;
            const startTime =
              effectiveX / props.scale / TIMELINE_FACTOR_PX;
            const timelineSettings = new ((
              require('./Timeline') as any
            ).TimelineSettings)(props.scale);
            const location = timelineSettings.snap(
              startTime,
              props.end,
              props.timeSignature,
              props.converter
            );
            const effectiveY =
              e.clientY -
              scrollViewRect.top +
              regionScrollView.scrollTop;
            const trackIndex = Math.floor(effectiveY / TRACK_HEIGHT_PX);
            const audioFile =
              currentTreeNode.current.nodeData.audioFile!;
            const audioDuration = audioFile.buffer.duration;
            const endTime = startTime + audioDuration;
            const endLocation = props.converter.convertTime(endTime);
            const duration = location.diff(
              endLocation,
              props.timeSignature
            );

            if (trackIndex >= props.tracks.length) {
              props.createNewAudioTrackWithRegion(
                audioFile,
                location,
                duration
              );
            } else if (props.tracks[trackIndex].type === 'audio') {
              props.addRegionToTrack(
                audioFile,
                trackIndex,
                location,
                duration
              );
            }
          }
        }
      }
    },
    [isDragging, props]
  );

  // ─── Tree event handlers ─────────────────────────────────────────────────
  const handleNodeMouseEnter = useCallback(
    (node: TreeNodeInfo<NodeData>, _path: NodePath) => {
      currentTreeNode.current = node;
      dragLabelText.current = node.label as string;
      if (canDrag(node)) {
        const elm = treeRef.current?.getNodeContentElement(
          node.id as string
        );
        elm?.classList.add(styles.canDrag);
      }
    },
    []
  );

  const handleNodeMouseLeave = useCallback(
    (node: TreeNodeInfo<NodeData>, _path: NodePath) => {
      const elm = treeRef.current?.getNodeContentElement(
        node.id as string
      );
      elm?.classList.remove(styles.canDrag);
      currentTreeNode.current = null;
      if (startDragTimeout.current !== null) {
        window.clearTimeout(startDragTimeout.current);
        startDragTimeout.current = null;
      }
    },
    []
  );

  const handleNodeCollapse = useCallback(
    (_n: TreeNodeInfo<NodeData>, path: NodePath) => {
      dispatch({ type: 'SET_IS_EXPANDED', payload: { path, isExpanded: false } });
    },
    []
  );

  const handleNodeExpand = useCallback(
    (_n: TreeNodeInfo<NodeData>, path: NodePath) => {
      dispatch({ type: 'SET_IS_EXPANDED', payload: { path, isExpanded: true } });
    },
    []
  );

  const handleNodeClick = useCallback(
    (node: TreeNodeInfo<NodeData>, path: NodePath, e: React.MouseEvent<HTMLElement>) => {
      if (!e.shiftKey) dispatch({ type: 'DESELECT_ALL' });
      dispatch({
        type: 'SET_IS_SELECTED',
        payload: { path, isSelected: !node.isSelected },
      });

      if (
        !node.nodeData?.isMidi &&
        node.nodeData &&
        !node.nodeData.isLoading &&
        !node.nodeData.audioFile
      ) {
        const nodeIdStr = String(node.id);
        let audioUrl: URL;
        try {
          audioUrl = new URL(nodeIdStr, document.baseURI);
        } catch {
          audioUrl = new URL(nodeIdStr, window.location.href);
        }
        const file = AudioFile.create(audioUrl);
        dispatch({ type: 'START_LOAD', payload: { path, audioFile: file } });
        file.load(
          audioContext,
          () => dispatch({ type: 'FINISH_LOAD', payload: { path, success: true } }),
          () => dispatch({ type: 'FINISH_LOAD', payload: { path, success: false } })
        );
      }
    },
    [audioContext]
  );

  return (
    <div
      id="browser-drag-div"
      className={styles.browser}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <Tree
        ref={treeRef}
        contents={nodes}
        onNodeClick={handleNodeClick}
        onNodeCollapse={handleNodeCollapse}
        onNodeExpand={handleNodeExpand}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
      />
      <div
        ref={dragLabel}
        className={`${styles.dragLabel} ${styles.noselect}`}
        style={{ top: 0, left: 0, display: 'none' }}
      >
        <Icon icon="music" /> {dragLabelText.current}
      </div>
    </div>
  );
};

export default Browser;
