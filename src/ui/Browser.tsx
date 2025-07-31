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
  const node = (Tree as any).nodeFromPath(path, nodes) as TreeNodeInfo<NodeData> | null; // blueprint's internal
  if (node) fn(node);
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
        n.nodeData = n.nodeData || {};
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
    const isRoot = typeof json.name === 'string' && json.name.toLowerCase() === 'library';
    return {
      id: json.path,
      label: json.name,
      isExpanded: isRoot,
      icon: isRoot ? 'folder-open' : 'folder-close',
      childNodes: json.children.map(jsonToTreeNodes),
      nodeData: null,
    };
  }

  // file node
  const lower = (json.name || '').toLowerCase();
  const isMidi = lower.endsWith('.mid') || lower.endsWith('.midi');

  let urlStr = json.path;
  try {
    // try to resolve to absolute if needed
    urlStr = new URL(json.path, document.baseURI).toString();
  } catch {
    // fallback, leave as-is
  }

  return {
    id: urlStr,
    label: json.name,
    isExpanded: false,
    icon: isMidi ? 'document' : 'music',
    nodeData: { isMidi, isLoading: false },
  };
}

function makeAbsoluteUrl(id: string): URL {
  try {
    return new URL(id);
  } catch {
    return new URL(id, document.baseURI);
  }
}

function buildLibraryUrlCandidates(): string[] {
  const set = new Set<string>();
  // relative via base URI (covers both / and any subpath)
  set.add(new URL(LIBRARY_JSON, document.baseURI).toString());

  if (process.env.PUBLIC_URL) {
    let pub = process.env.PUBLIC_URL;
    if (!pub.endsWith('/')) pub += '/';
    try {
      set.add(new URL(LIBRARY_JSON, `${window.location.origin}${pub}`).toString());
    } catch {}
  }

  // absolute fallback
  set.add(`${window.location.origin}/${LIBRARY_JSON}`);

  return Array.from(set);
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

  // ─── LIBRARY.JSON FETCH WITH FALLBACKS AND HTML DETECTION ───────────────────
  useEffect(() => {
    const candidates = buildLibraryUrlCandidates();
    let didSucceed = false;

    const tryFetch = async () => {
      for (const url of candidates) {
        try {
          console.log('Attempting to fetch library.json from:', url);
          const res = await fetch(url, { cache: 'no-cache' });
          if (!res.ok) {
            console.warn('Non-ok response for', url, res.status);
            continue;
          }

          const contentType = res.headers.get('content-type') || '';
          const text = await res.text();

          // Heuristic: if we got HTML (index fallback), skip and try next
          const trimmed = text.trim();
          if (
            trimmed.startsWith('<!doctype') ||
            trimmed.startsWith('<!DOCTYPE') ||
            contentType.includes('text/html')
          ) {
            console.warn('Received HTML instead of JSON from', url);
            continue;
          }

          const json = JSON.parse(text);
          dispatch({
            type: 'RELOAD_TREE_NODES',
            payload: { nodes: [jsonToTreeNodes(json)] },
          });
          didSucceed = true;
          return;
        } catch (e) {
          console.warn('Failed to fetch/parse from', url, e);
          // try next
        }
      }

      if (!didSucceed) {
        console.error('All attempts to load library.json failed');
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
      }
    };

    tryFetch();
  }, []);

  // ─── DRAG HANDLERS ─────────────────────────────────────────────────────────
  const onStartDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      setIsDragging(true);
      e.preventDefault();
      dragStartX.current = e.clientX;
      dragStartY.current = e.clientY;
      (e.target as Element).setPointerCapture(e.pointerId);

      if (dragLabel.current) {
        const lbl = dragLabel.current;
        lbl.style.display = 'block';
        lbl.style.left = `${e.clientX}px`;
        lbl.style.top = `${e.clientY}px`;
      }

      const placeholder = document.getElementById(REGION_PLACEHOLDER_ID)!;
      if (currentTreeNode.current?.nodeData?.isMidi) {
        placeholder.style.width = '120px';
      } else if (currentTreeNode.current?.nodeData?.audioFile) {
        const dur = currentTreeNode.current.nodeData.audioFile!.buffer.duration;
        placeholder.style.width = `${dur * props.scale * TIMELINE_FACTOR_PX}px`;
      }
    },
    [props.scale]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (
        !isDragging &&
        currentTreeNode.current !== null &&
        canDrag(currentTreeNode.current)
      ) {
        if (startDragTimeout.current !== null) {
          window.clearTimeout(startDragTimeout.current);
        }
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
        const lbl = dragLabel.current;
        lbl.style.left = `${e.clientX}px`;
        lbl.style.top = `${e.clientY}px`;

        const regionScrollView = document.getElementById(REGION_SCROLL_VIEW_ID);
        const regionPlaceholder = document.getElementById(REGION_PLACEHOLDER_ID);
        if (!regionScrollView || !regionPlaceholder) return;
        const scrollViewRect = regionScrollView.getBoundingClientRect();

        if (
          e.clientX >= scrollViewRect.left &&
          e.clientX <= scrollViewRect.right &&
          e.clientY >= scrollViewRect.top &&
          e.clientY <= scrollViewRect.bottom
        ) {
          regionPlaceholder.style.display = 'block';
          regionPlaceholder.style.left = `${
            e.clientX - scrollViewRect.left + regionScrollView.scrollLeft - 2
          }px`;
          regionPlaceholder.style.top = `${
            e.clientY - scrollViewRect.top + regionScrollView.scrollTop - 2
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
        if (dragLabel.current) dragLabel.current.style.display = 'none';
        const regionPlaceholder = document.getElementById(REGION_PLACEHOLDER_ID);
        if (regionPlaceholder) regionPlaceholder.style.display = 'none';
      }
    },
    [isDragging]
  );

  // ─── TREE EVENT HANDLERS ───────────────────────────────────────────────────
  const handleNodeMouseEnter = useCallback(
    (node: TreeNodeInfo<NodeData>, _path: NodePath) => {
      currentTreeNode.current = node;
      dragLabelText.current = node.label as string;
      if (canDrag(node) && treeRef.current) {
        const elm = treeRef.current.getNodeContentElement(node.id as string);
        elm?.classList.add(styles.canDrag);
      }
    },
    []
  );

  const handleNodeMouseLeave = useCallback(
    (node: TreeNodeInfo<NodeData>, _path: NodePath) => {
      if (treeRef.current) {
        const elm = treeRef.current.getNodeContentElement(node.id as string);
        elm?.classList.remove(styles.canDrag);
      }
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
      dispatch({ type: 'SET_IS_SELECTED', payload: { path, isSelected: !node.isSelected } });

      if (
        !node.nodeData?.isMidi &&
        node.nodeData &&
        !node.nodeData.isLoading &&
        !node.nodeData.audioFile
      ) {
        const url = makeAbsoluteUrl(node.id as string);
        const file = AudioFile.create(url);
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
        ref={(r) => {
          // blueprint's Tree typing is a bit weird; cast to any for set/get
          (treeRef as any).current = r;
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
