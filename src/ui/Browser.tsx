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
  return !!node.nodeData?.audioFile?.ready && !node.nodeData.isLoading;
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
  const target = (Tree as any).nodeFromPath(path, nodes) as TreeNodeInfo<NodeData> | undefined;
  if (target) {
    fn(target);
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
        if (n.childNodes?.length) {
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
    const isRoot = String(json.name).toLowerCase() === 'library';
    return {
      id: json.path,
      label: json.name,
      isExpanded: isRoot,
      icon: isRoot ? 'folder-open' : 'folder-close',
      childNodes: json.children.map(jsonToTreeNodes),
      nodeData: null,
    };
  }

  const lower = (json.name || '').toLowerCase();
  const isMidi = lower.endsWith('.mid') || lower.endsWith('.midi');

  // Build URL-safe path for file nodes.
  let urlStr = json.path;
  try {
    // If PUBLIC_URL is set, it may affect resolving in production; use document.baseURI to resolve relative.
    urlStr = new URL(String(json.path), document.baseURI).toString();
  } catch {
    // fallback: leave as-is
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

  const treeRef = useRef<Tree<NodeData> | null>(null);
  const dragLabel = useRef<HTMLDivElement | null>(null);
  const dragLabelText = useRef<string>('');
  const currentTreeNode = useRef<TreeNodeInfo<NodeData> | null>(null);
  const startDragTimeout = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);

  // ─── FETCH library.json with fallback candidates ───────────────────────────────
  useEffect(() => {
    const sanitize = (s: string) => s.replace(/\/+$/g, '');
    const pub = sanitize(process.env.PUBLIC_URL || '');
    const candidates: string[] = [];

    if (pub) {
      candidates.push(`${pub}/${LIBRARY_JSON}`.replace(/\/{2,}/g, '/'));
    }
    candidates.push(`/${LIBRARY_JSON}`);
    candidates.push(LIBRARY_JSON);

    const fetchLibrary = async () => {
      let lastErr: unknown = null;
      for (const candidate of candidates) {
        try {
          console.log('Attempting to fetch library from:', candidate);
          const res = await fetch(candidate);
          console.log(`Response status for ${candidate}:`, res.status);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const text = await res.text();
          if (text.trim().toLowerCase().startsWith('<!doctype')) {
            console.warn(`Received HTML from ${candidate}, trying next candidate.`);
            continue;
          }
          const json = JSON.parse(text);
          dispatch({
            type: 'RELOAD_TREE_NODES',
            payload: { nodes: [jsonToTreeNodes(json)] },
          });
          return;
        } catch (e) {
          console.warn(`Failed to fetch/parse from ${candidate}:`, e);
          lastErr = e;
        }
      }

      console.error('Failed to load library.json from all candidates:', lastErr);
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

    fetchLibrary();
  }, []);

  // ─── DRAG HANDLERS ────────────────────────────────────────────────────────────
  const onStartDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      setIsDragging(true);
      e.preventDefault();
      dragStartX.current = e.clientX;
      dragStartY.current = e.clientY;
      (e.target as Element).setPointerCapture(e.pointerId);

      if (dragLabel.current) {
        dragLabel.current.style.display = 'block';
        dragLabel.current.style.left = `${e.clientX}px`;
        dragLabel.current.style.top = `${e.clientY}px`;
      }

      const ph = document.getElementById(REGION_PLACEHOLDER_ID);
      if (ph && currentTreeNode.current) {
        if (currentTreeNode.current.nodeData?.isMidi) {
          ph.style.width = '120px';
        } else if (currentTreeNode.current.nodeData?.audioFile) {
          const dur = currentTreeNode.current.nodeData.audioFile.buffer.duration;
          ph.style.width = `${dur * props.scale * TIMELINE_FACTOR_PX}px`;
        }
      }
    },
    [props.scale]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging && currentTreeNode.current && canDrag(currentTreeNode.current)) {
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
      if (isDragging && dragLabel.current) {
        dragLabel.current.style.left = `${e.clientX}px`;
        dragLabel.current.style.top = `${e.clientY}px`;

        const regionScrollView = document.getElementById('region-scroll-view');
        const regionPlaceholder = document.getElementById(REGION_PLACEHOLDER_ID);
        if (regionScrollView && regionPlaceholder) {
          const scrollViewRect = regionScrollView.getBoundingClientRect();
          if (
            e.clientX >= scrollViewRect.left &&
            e.clientX <= scrollViewRect.right &&
            e.clientY >= scrollViewRect.top &&
            e.clientY <= scrollViewRect.bottom
          ) {
            regionPlaceholder.style.display = 'block';
            regionPlaceholder.style.left = `${
              e.clientX - scrollViewRect.left + (regionScrollView as any).scrollLeft - 2
            }px`;
            regionPlaceholder.style.top = `${
              e.clientY - scrollViewRect.top + (regionScrollView as any).scrollTop - 2
            }px`;
          } else {
            regionPlaceholder.style.display = 'none';
          }
        }
      }
    },
    [isDragging]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (startDragTimeout.current) {
        window.clearTimeout(startDragTimeout.current);
        startDragTimeout.current = null;
      }
      if (isDragging) {
        setIsDragging(false);
        (e.target as Element).releasePointerCapture(e.pointerId);
        if (dragLabel.current) dragLabel.current.style.display = 'none';
        const ph = document.getElementById(REGION_PLACEHOLDER_ID);
        if (ph) ph.style.display = 'none';
      }
    },
    [isDragging]
  );

  // ─── TREE EVENT HANDLERS ─────────────────────────────────────────────────────
  const handleNodeMouseEnter = useCallback(
    (node: TreeNodeInfo<NodeData>, _path: NodePath) => {
      currentTreeNode.current = node;
      dragLabelText.current = String(node.label);
      if (canDrag(node)) {
        const elm = treeRef.current?.getNodeContentElement(node.id as string);
        elm?.classList.add(styles.canDrag);
      }
    },
    []
  );

  const handleNodeMouseLeave = useCallback(
    (node: TreeNodeInfo<NodeData>, _path: NodePath) => {
      const elm = treeRef.current?.getNodeContentElement(node.id as string);
      elm?.classList.remove(styles.canDrag);
      currentTreeNode.current = null;
      if (startDragTimeout.current) {
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
        // ensure node.id is stringified before passing to URL
        const nodeIdStr = String(node.id);
        const fileUrl = new URL(nodeIdStr, document.baseURI);
        const file = AudioFile.create(fileUrl);
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
        ref={(ref) => {
          // Blueprint's Tree generic typing isn't always inferred; cast for usage
          treeRef.current = ref as unknown as Tree<NodeData>;
        }}
        contents={nodes}
        onNodeClick={handleNodeClick}
        onNodeCollapse={handleNodeCollapse}
        onNodeExpand={handleNodeExpand}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
      />
      <div
        ref={(el) => {
          if (el) dragLabel.current = el;
        }}
        className={`${styles.dragLabel} ${styles.noselect}`}
        style={{ top: 0, left: 0, display: 'none' }}
      >
        <Icon icon="music" /> {dragLabelText.current}
      </div>
    </div>
  );
};

export default Browser;
