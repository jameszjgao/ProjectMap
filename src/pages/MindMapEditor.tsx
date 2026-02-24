/**
 * MindMapEditor
 * - depth0=根(文件名) / depth1=清单 / depth2+=任务（@成员 #截止时间）
 * - 拖拽父节点时子节点跟随移动
 * - @ / # 下拉使用 Portal 挂到 document.body，避免 React Flow 堆叠上下文裁剪
 */
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow, MiniMap, BaseEdge,
  Handle, Position, useNodesState, useEdgesState, useViewport, useReactFlow, useStore,
  type Node, type Edge, type NodeProps, type NodeTypes, type EdgeProps, type EdgeTypes,
  type OnNodesChange, type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowLeft, Plus, Search, Download,
  Maximize2, Minimize2, Keyboard, X,
  LayoutGrid, Move,
} from 'lucide-react';
import {
  getMindMapById, getSpaceMembers,
  type MindMap, type SpaceMember,
} from '../lib/workmap';
import { getCurrentSpaceInfo } from '../lib/auth-helper';
import './MindMapEditor.css';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────
export type LayoutDir = 'LR' | 'TB' | 'RL' | 'Text';
interface MindTreeNode { id: string; label: string; parentId: string | null; collapsed: boolean; }

// ─────────────────────────────────────────────────────────────────
// Tree helpers
// ─────────────────────────────────────────────────────────────────
const childIds = (tree: MindTreeNode[], pid: string | null) =>
  tree.filter(n => n.parentId === pid).map(n => n.id);

function descendants(tree: MindTreeNode[], id: string): string[] {
  const kids = childIds(tree, id);
  return [...kids, ...kids.flatMap(k => descendants(tree, k))];
}
const orderedSiblings = (tree: MindTreeNode[], id: string) => {
  const node = tree.find(n => n.id === id);
  return node ? tree.filter(n => n.parentId === node.parentId).map(n => n.id) : [];
};
function getDepth(tree: MindTreeNode[], id: string): number {
  const node = tree.find(n => n.id === id);
  if (!node || node.parentId === null) return 0;
  return 1 + getDepth(tree, node.parentId);
}

// 将树结构转换为文本（Text 模式）
// depth 0（根）不缩进，depth 1（清单）缩进 1 级，depth 2+（任务）缩进 2+ 级
function treeToText(tree: MindTreeNode[]): string {
  const root = tree.find(n => !n.parentId);
  if (!root) return '';
  
  function buildText(id: string, indent: number): string[] {
    const node = tree.find(n => n.id === id);
    if (!node) return [];
    
    const lines: string[] = [];
    const indentStr = '  '.repeat(indent); // 每级 2 个空格
    lines.push(indentStr + node.label);
    
    const children = tree.filter(n => n.parentId === id);
    for (const child of children) {
      lines.push(...buildText(child.id, indent + 1));
    }
    
    return lines;
  }
  
  const children = tree.filter(n => n.parentId === root.id);
  const lines: string[] = [];
  // 始终包含根节点行，即使 label 为空（depth 0，不缩进）
  lines.push(root.label || '');
  // 清单节点（depth 1）应该缩进 1 级（2 个空格）
  for (const child of children) {
    lines.push(...buildText(child.id, 1));
  }
  
  return lines.join('\n');
}

// 将文本解析为树结构（Text 模式）
// 确保根节点始终存在且唯一（parentId 为 null）
function textToTree(text: string, rootId: string): MindTreeNode[] {
  const lines = text.split(/\r?\n/);
  
  const nodes: MindTreeNode[] = [];
  // 始终创建根节点，即使文本为空
  const rootLabel = lines.length > 0 && lines[0] ? lines[0].trim() : '';
  nodes.push({ id: rootId, label: rootLabel, parentId: null, collapsed: false });
  
  // 如果没有其他行，直接返回只有根节点的树
  if (lines.length <= 1) return nodes;
  
  // 解析缩进层级（每 2 个空格算一级）
  const parseIndent = (line: string): number => {
    let indent = 0;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === ' ') indent++;
      else if (line[i] === '\t') indent += 2;
      else break;
    }
    return Math.floor(indent / 2);
  };
  
  // stack 中存储的是 { id, indentLevel }
  // indentLevel: 0 = 根节点（depth 0），1 = 清单（depth 1），2 = 任务（depth 2），...
  const stack: Array<{ id: string; indentLevel: number }> = [{ id: rootId, indentLevel: -1 }]; // 根节点 indentLevel 设为 -1，确保所有子节点都能找到它
  let nextId = 1000;
  
  // 从第二行开始解析（第一行是根节点）
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const indent = parseIndent(line); // 缩进级别（0 = 无缩进，1 = 2个空格，2 = 4个空格...）
    const label = line.trim();
    
    // 跳过完全空白的行（除非有缩进，表示是子节点）
    if (!label && indent === 0) continue;
    
    // 找到合适的父节点：找到 stack 中 indentLevel < 当前 indent 的最后一个节点
    while (stack.length > 1 && stack[stack.length - 1].indentLevel >= indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    if (!parent) {
      // 如果没有父节点，将其作为根节点的子节点
      const id = `n${nextId++}`;
      nodes.push({ id, label, parentId: rootId, collapsed: false });
      stack.push({ id, indentLevel: indent });
      continue;
    }
    
    const id = `n${nextId++}`;
    nodes.push({ id, label, parentId: parent.id, collapsed: false });
    stack.push({ id, indentLevel: indent });
  }
  
  return nodes;
}
let _seq = 100;
const uid = () => `n${++_seq}`;

function addSibling(tree: MindTreeNode[], selId: string): [MindTreeNode[], string] {
  const sel = tree.find(n => n.id === selId);
  if (!sel || sel.parentId === null) return addChild(tree, selId);
  const id  = uid();
  const idx = tree.findIndex(n => n.id === selId);
  return [[...tree.slice(0, idx + 1), { id, label: '', parentId: sel.parentId, collapsed: false }, ...tree.slice(idx + 1)], id];
}
function addChild(tree: MindTreeNode[], parentId: string): [MindTreeNode[], string] {
  const id     = uid();
  const descs  = descendants(tree, parentId);
  const pIdx   = tree.findIndex(n => n.id === parentId);
  const lastIdx = descs.length ? Math.max(...descs.map(d => tree.findIndex(n => n.id === d))) : pIdx;
  return [[...tree.slice(0, lastIdx + 1), { id, label: '', parentId, collapsed: false }, ...tree.slice(lastIdx + 1)], id];
}
function removeNode(tree: MindTreeNode[], id: string): [MindTreeNode[], string | null] {
  const node = tree.find(n => n.id === id);
  if (!node || node.parentId === null) return [tree, null];
  const remove = new Set([id, ...descendants(tree, id)]);
  return [tree.filter(n => !remove.has(n.id)), node.parentId];
}
const setLabel      = (tree: MindTreeNode[], id: string, label: string) => tree.map(n => n.id === id ? { ...n, label } : n);
const toggleCollapse= (tree: MindTreeNode[], id: string) => tree.map(n => n.id === id ? { ...n, collapsed: !n.collapsed } : n);

/**
 * 根据拖拽位置在已排序的 slotPositions（升序）中确定插入索引。
 * 使用相邻槽位中点作为分界：越过中点才换槽，避免在槽边界抖动。
 */
function calcInsertIdx(slotPositions: number[], dragPos: number): number {
  // 以每个兄弟节点自身的中心位置为热区边界：
  // 拖移中心超过兄弟中心才触发换位，避免等间距时 1px 即触发的过灵敏问题
  if (slotPositions.length === 0) return 0;
  for (let i = 0; i < slotPositions.length; i++) {
    if (dragPos < slotPositions[i]) return i;
  }
  return slotPositions.length;
}

/** 对 parentId 的直接子节点按 newOrder 重排（保持在数组中的相对位置段） */
function reorderSiblings(tree: MindTreeNode[], parentId: string, newOrder: string[]): MindTreeNode[] {
  const siblings  = tree.filter(n => n.parentId === parentId);
  const idxs      = siblings.map(s => tree.findIndex(n => n.id === s.id)).sort((a, b) => a - b);
  const next      = [...tree];
  newOrder.forEach((sid, i) => { next[idxs[i]] = tree.find(n => n.id === sid)!; });
  return next;
}

/** 根据布局方向和节点深度，确定兄弟排序应参考的坐标轴 */
function getSortAxis(dir: LayoutDir, depth: number): 'x' | 'y' {
  if (dir === 'LR' || dir === 'RL') return 'y';
  if (dir === 'Text') return 'y'; // Text 模式：所有节点都垂直排列
  return depth <= 1 ? 'x' : 'y'; // TB: 第二级横排用 X，第三级以下纵排用 Y
}

// ─────────────────────────────────────────────────────────────────
// Label parser
// ─────────────────────────────────────────────────────────────────
type LabelToken = { type: 'plain' | 'mention' | 'date'; text: string };
function parseLabel(text: string, members: SpaceMember[]): LabelToken[] {
  const out: LabelToken[] = [];
  const re = /(@[^@#\s]+(?:\s|$)|#[^@#]+|[^@#]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const v = m[1];
    if (!v) continue;
    if (v.startsWith('@')) {
      // 提取 @ 后的名字（去除末尾空格）
      const name = v.slice(1).trimEnd();
      // 只有通过选单插入的成员名才识别为 mention（检查是否在成员列表中）
      // 支持多语言字符的精确匹配
      const isMember = members.some(m => {
        const memberName = (m.name || m.email.split('@')[0]).trim();
        return memberName === name;
      });
      if (isMember) {
        out.push({ type: 'mention', text: v.trimEnd() });
      } else {
        // 不在成员列表中的 @xxx 当作普通文本，不渲染为人名样式
        out.push({ type: 'plain', text: v });
      }
    } else if (v.startsWith('#')) {
      out.push({ type: 'date', text: v.trimEnd() });
    } else {
      out.push({ type: 'plain', text: v });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────────────────────────
const HANDLE_POS: Record<LayoutDir, { target: Position; source: Position }> = {
  LR: { target: Position.Left,   source: Position.Right  },
  RL: { target: Position.Right,  source: Position.Left   },
  TB: { target: Position.Top,    source: Position.Bottom },
  Text: { target: Position.Top,    source: Position.Bottom },
};

// Node sizes — 与 CSS 的固定 width/height 完全对应（box-sizing: border-box）
const NODE_W: Record<number, number> = { 0: 160, 1: 130 };
const NODE_H: Record<number, number> = { 0: 36,  1: 36  };
const TASK_W = 220, TASK_H = 36;

// Spacing constants
const LR_V_GAP    = 14;  // vertical gap between sibling subtree blocks (LR/RL)
const LR_H_GAP    = 48;  // horizontal gap between rank columns (LR/RL)
const TB_V_GAP    = 8;   // vertical gap between nodes in the same column (TB)
const TB_H_PAD    = 24;  // horizontal padding between depth-1 columns (TB)
const TB_RANK_GAP = 40;  // vertical gap between root row and depth-1 row (TB)
const TB_TREE_INDENT = 24; // horizontal indent per depth level for tree layout (depth >= 2)
const TEXT_V_GAP = 4;   // vertical gap between nodes in text mode (smaller spacing)
const TEXT_TREE_INDENT = 20; // horizontal indent per depth level for text mode

function buildEdgeSpec(visible: MindTreeNode[], hidden: Set<string>, dir: LayoutDir): Edge[] {
  return visible
    .filter(n => n.parentId && !hidden.has(n.parentId))
    .map(n => ({
      id: `e-${n.parentId}-${n.id}`,
      source: n.parentId!, target: n.id,
      type: 'mindedge',
      data: { dir },
      style: { stroke: '#C5C9D6', strokeWidth: 1.5 },
    }));
}

function buildNodeSpec(
  visible: MindTreeNode[],
  tree: MindTreeNode[],
  getPos: (id: string) => { cx: number; cy: number },
  tPos: Position, sPos: Position,
  getNodeH: (id: string, depth: number) => number,
): Node[] {
  return visible.map(n => {
    const { cx, cy } = getPos(n.id);
    const d  = getDepth(tree, n.id);
    const nw = NODE_W[d] ?? TASK_W;
    const nh = getNodeH(n.id, d);
    return {
      id: n.id, type: 'mindnode',
      position: { x: cx - nw / 2, y: cy - nh / 2 },
      width: nw, height: nh,
      selected: false, draggable: true,
      data: {
        label: n.label, depth: d,
        collapsed: n.collapsed,
        hasKids:    childIds(tree, n.id).length > 0,
        childCount: tree.filter(x => x.parentId === n.id).length,
        targetPos: tPos, sourcePos: sPos, isEditing: false,
      },
    };
  });
}

// ── LR / RL ──────────────────────────────────────────────────────
function computeLayoutLRRL(
  tree: MindTreeNode[], dir: 'LR' | 'RL',
  tPos: Position, sPos: Position, hidden: Set<string>,
  getNodeH: (id: string, depth: number) => number,
): { nodes: Node[]; edges: Edge[] } {
  const visible = tree.filter(n => !hidden.has(n.id));
  const root = visible.find(n => !n.parentId);
  if (!root) return { nodes: [], edges: [] };

  const V_GAP = LR_V_GAP;
  const H_GAP = LR_H_GAP;

  const shCache = new Map<string, number>();
  function subtreeH(id: string): number {
    if (shCache.has(id)) return shCache.get(id)!;
    const d    = getDepth(tree, id);
    const ownH = getNodeH(id, d);
    const kids = visible.filter(n => n.parentId === id);
    if (!kids.length) { shCache.set(id, ownH); return ownH; }
    const span = kids.reduce((s, k) => s + subtreeH(k.id), 0) + (kids.length - 1) * V_GAP;
    const h = Math.max(ownH, span);
    shCache.set(id, h);
    return h;
  }
  visible.forEach(n => subtreeH(n.id));

  // 根节点固定在画布中心 (0, 0)，子节点从中心向不同方向展开
  function getCX(depth: number): number {
    if (depth === 0) return 0; // 根节点在中心
    let cx = (NODE_W[0] ?? 160) / 2;
    for (let d = 1; d <= depth; d++) {
      cx += (NODE_W[d - 1] ?? TASK_W) / 2 + H_GAP + (NODE_W[d] ?? TASK_W) / 2;
    }
    return dir === 'LR' ? cx : -cx;
  }

  const positions = new Map<string, { cx: number; cy: number }>();
  function place(id: string, cx: number, cy: number) {
    positions.set(id, { cx, cy });
    const kids = visible.filter(n => n.parentId === id);
    if (!kids.length) return;
    const depth  = getDepth(tree, kids[0].id);
    const kidCX  = getCX(depth);
    const totalH = kids.reduce((s, k) => s + subtreeH(k.id), 0) + (kids.length - 1) * V_GAP;
    let curY = cy - totalH / 2;
    for (const kid of kids) {
      const h = subtreeH(kid.id);
      place(kid.id, kidCX, curY + h / 2);
      curY += h + V_GAP;
    }
  }

  place(root.id, 0, 0); // 根节点固定在画布中心

  const nodes = buildNodeSpec(
    visible, tree,
    id => positions.get(id) ?? { cx: 0, cy: 0 },
    tPos, sPos, getNodeH,
  );
  return { nodes, edges: buildEdgeSpec(visible, hidden, dir) };
}

// ── Text ──────────────────────────────────────────────────────
function computeLayoutText(
  tree: MindTreeNode[],
  tPos: Position, sPos: Position, hidden: Set<string>,
  getNodeH: (id: string, depth: number) => number,
): { nodes: Node[]; edges: Edge[] } {
  const visible = tree.filter(n => !hidden.has(n.id));
  const pos     = new Map<string, { cx: number; cy: number }>();

  // 文本模式：所有节点垂直 L 形排列，逐级缩进
  function placeTree(id: string, leftX: number, topY: number): number {
    const d = getDepth(tree, id);
    const h = getNodeH(id, d);
    const w = NODE_W[d] ?? TASK_W;
    // depth 0（根）不缩进，depth 1（清单）缩进 1 级，depth 2（任务）缩进 2 级…
    const indentLevel = d;
    const xOffset = indentLevel * TEXT_TREE_INDENT;
    const cx = leftX + xOffset + w / 2;
    pos.set(id, { cx, cy: topY + h / 2 });

    const kids = visible.filter(n => n.parentId === id);
    if (!kids.length) return h;

    let y = topY + h + TEXT_V_GAP;
    for (const kid of kids) {
      y += placeTree(kid.id, leftX, y) + TEXT_V_GAP;
    }
    return y - topY - TEXT_V_GAP;
  }

  const root = visible.find(n => !n.parentId);
  if (!root) return { nodes: [], edges: [] };

  // 根节点固定在画布中心 (0, 0)
  const rootW  = NODE_W[0] ?? 160;
  const rootH  = getNodeH(root.id, 0);
  pos.set(root.id, { cx: 0, cy: 0 });

  const rootKids = visible.filter(n => n.parentId === root.id);
  if (rootKids.length > 0) {
    const rootLeftX = -rootW / 2; // 根节点左端
    let y = rootH / 2 + TEXT_V_GAP;
    for (const kid of rootKids) {
      y += placeTree(kid.id, rootLeftX, y) + TEXT_V_GAP;
    }
  }

  // Text 模式下，所有节点的 sourcePos 为 Left（连线起点在左端）
  const nodes = buildNodeSpec(visible, tree, id => pos.get(id) ?? { cx: 0, cy: 0 }, tPos, sPos, getNodeH).map(n => {
    return { ...n, data: { ...n.data, sourcePos: Position.Left, isTextMode: true } };
  });

  return { nodes, edges: buildEdgeSpec(visible, hidden, 'Text') };
}

// ── TB ──────────────────────────────────────────────────────
function computeLayoutTB(
  tree: MindTreeNode[], dir: 'TB',
  tPos: Position, sPos: Position, hidden: Set<string>,
  getNodeH: (id: string, depth: number) => number,
): { nodes: Node[]; edges: Edge[] } {
  const visible = tree.filter(n => !hidden.has(n.id));
  const pos     = new Map<string, { cx: number; cy: number }>();

  // 子树中的最大深度（用于计算树宽 n）
  function maxDepthInSubtree(id: string): number {
    const d = getDepth(tree, id);
    const kids = visible.filter(n => n.parentId === id);
    if (!kids.length) return d;
    return Math.max(d, ...kids.map(k => maxDepthInSubtree(k.id)));
  }

  // 第一级子节点（清单）的列宽：树宽 = S + 缩进×n（S=任务节点宽度，n=展开的子节点层级数）
  function treeWidthForList(id: string): number {
    const listW = NODE_W[1] ?? TASK_W; // 清单节点自身宽度
    const n = Math.max(0, maxDepthInSubtree(id) - 2); // 任务层级数（depth 2 为第 1 层）
    const width = TASK_W + TB_TREE_INDENT * n;
    return Math.max(listW, width);
  }

  // 第一级子节点：垂直列布局（左右排开），仅用于高度计算
  function placeCol(id: string, cx: number, topY: number): number {
    const d = getDepth(tree, id);
    const h = getNodeH(id, d);
    pos.set(id, { cx, cy: topY + h / 2 });
    const kids = visible.filter(n => n.parentId === id);
    if (!kids.length) return h;
    let y = topY + h + TB_V_GAP;
    for (const kid of kids) {
      y += placeCol(kid.id, cx, y) + TB_V_GAP;
    }
    return y - topY - TB_V_GAP;
  }

  // 第二级及以下：文档式树形布局，所有节点与清单左端对齐，逐级缩进
  // leftX 是清单左端（基准点），depth 1 不缩进，depth 2 缩进 1 级，depth 3 缩进 2 级…
  function placeTree(id: string, leftX: number, topY: number): number {
    const d = getDepth(tree, id);
    const h = getNodeH(id, d);
    const w = NODE_W[d] ?? TASK_W;
    // depth 2（第一级任务）缩进 1 级，depth 3 缩进 2 级，depth 4 缩进 3 级…
    const indentLevel = d >= 2 ? d - 1 : 0;
    const xOffset = indentLevel * TB_TREE_INDENT;
    const cx = leftX + xOffset + w / 2;
    pos.set(id, { cx, cy: topY + h / 2 });

    const kids = visible.filter(n => n.parentId === id);
    if (!kids.length) return h;

    let y = topY + h + TB_V_GAP;
    for (const kid of kids) {
      y += placeTree(kid.id, leftX, y) + TB_V_GAP;
    }
    return y - topY - TB_V_GAP;
  }

  const root = visible.find(n => !n.parentId);
  if (!root) return { nodes: [], edges: [] };

  // 根节点固定在画布中心 (0, 0)
  const rootW  = NODE_W[0] ?? 160;
  const rootH  = getNodeH(root.id, 0);
  pos.set(root.id, { cx: 0, cy: 0 });

  const listNodes = visible.filter(n => n.parentId === root.id);
  if (listNodes.length > 0) {
    // 计算每个第一级子节点的子树高度（包括所有子节点）
    function subtreeHeight(id: string): number {
      const d = getDepth(tree, id);
      const h = getNodeH(id, d);
      const kids = visible.filter(n => n.parentId === id);
      if (!kids.length) return h;
      let totalH = h;
      for (const kid of kids) {
        totalH += TB_V_GAP + subtreeHeight(kid.id);
      }
      return totalH;
    }
    
    const colWidths = listNodes.map(n => treeWidthForList(n.id));
    const totalW    = colWidths.reduce((s, w) => s + w, 0) + Math.max(0, listNodes.length - 1) * TB_H_PAD;
    const listY = rootH / 2 + TB_RANK_GAP; // 从根节点中心向下
    let curX = -totalW / 2; // 从中心向左开始
    
    for (let i = 0; i < listNodes.length; i++) {
      const listNode = listNodes[i];
      const listNodeW = colWidths[i];
      const listNodeLeftX = curX; // 清单左端（所有节点的左对齐基准点）
      const listNodeH = getNodeH(listNode.id, 1);
      const listNodeW_actual = NODE_W[1] ?? TASK_W;
      
      // 第一级子节点（清单）：左端对齐，不缩进（作为基准点）
      pos.set(listNode.id, { cx: listNodeLeftX + listNodeW_actual / 2, cy: listY + listNodeH / 2 });
      
      // 第二级及以下：树形布局，从清单左端开始，逐级缩进
      const secondLevelKids = visible.filter(n => n.parentId === listNode.id);
      if (secondLevelKids.length > 0) {
        let y = listY + listNodeH + TB_V_GAP;
        for (const kid of secondLevelKids) {
          const kidH = placeTree(kid.id, listNodeLeftX, y);
          y += kidH + TB_V_GAP;
        }
      }
      
      curX += colWidths[i] + TB_H_PAD;
    }
  }

  // TB 模式下，第二级及以下节点的 sourcePos 为 Left（连线起点在左端）
  const nodes = buildNodeSpec(visible, tree, id => pos.get(id) ?? { cx: 0, cy: 0 }, tPos, sPos, getNodeH).map(n => {
    const d = getDepth(tree, n.id);
    if (dir === 'TB') {
      // TB 模式下：所有节点（包括清单）的 sourcePos 改为 Left，标记放在左端点
      return { ...n, data: { ...n.data, sourcePos: Position.Left } };
    }
    return n;
  });
  return { nodes, edges: buildEdgeSpec(visible, hidden, dir) };
}

// ── Entry point ───────────────────────────────────────────────────
function computeLayout(
  tree: MindTreeNode[], dir: LayoutDir,
  getNodeH: (id: string, depth: number) => number,
): { nodes: Node[]; edges: Edge[] } {
  const collapsed = new Set(tree.filter(n => n.collapsed).map(n => n.id));
  const hidden    = new Set<string>();
  collapsed.forEach(id => descendants(tree, id).forEach(d => hidden.add(d)));
  const { target: tPos, source: sPos } = HANDLE_POS[dir];
  if (dir === 'TB') return computeLayoutTB(tree, dir, tPos, sPos, hidden, getNodeH);
  if (dir === 'Text') return computeLayoutText(tree, tPos, sPos, hidden, getNodeH);
  return computeLayoutLRRL(tree, dir, tPos, sPos, hidden, getNodeH);
}

// Default height getter — used before any node is measured
function defaultNodeH(_id: string, depth: number): number {
  return NODE_H[depth] ?? TASK_H;
}

// ─────────────────────────────────────────────────────────────────
// Global callback registry
// ─────────────────────────────────────────────────────────────────
const CB = {
  onLabelChange:      (_id: string, _label: string) => {},
  onToggleCollapse:   (_id: string) => {},
  setEditingId:       (_id: string | null) => {},
  onNodeHeightChange: (_id: string, _h: number) => {},
  members:            [] as SpaceMember[],
};

// ─────────────────────────────────────────────────────────────────
// Anchor detection
// ─────────────────────────────────────────────────────────────────
function findMentionAnchor(text: string, cursor: number) {
  for (let i = cursor - 1; i >= 0; i--) {
    if (text[i] === '@' || text[i] === '＠') {
      return { start: i, query: text.slice(i + 1, cursor) };
    }
    if (text[i] === '#' || text[i] === '＃') return null;
  }
  return null;
}
function findDateAnchor(text: string, cursor: number) {
  for (let i = cursor - 1; i >= 0; i--) {
    if (text[i] === '#' || text[i] === '＃') {
      return { start: i };
    }
    if (text[i] === '@' || text[i] === '＠') return null;
  }
  return null;
}

// Default datetime: today 18:00
function defaultDatetime() {
  const d   = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T18:00`;
}

// ─────────────────────────────────────────────────────────────────
// Custom Node
// ─────────────────────────────────────────────────────────────────
interface NodeData extends Record<string, unknown> {
  label: string; depth: number; collapsed: boolean;
  hasKids: boolean; childCount: number;
  targetPos: Position; sourcePos: Position; isEditing: boolean;
  isTextMode?: boolean;
}

function MindNode({ id, data, selected }: NodeProps) {
  const d      = data as NodeData;
  const isTask = d.depth >= 2;

  const [draft,       setDraft]       = useState(d.label);
  const [mention,     setMention]     = useState<{ start: number; query: string } | null>(null);
  const [datePick,    setDatePick]    = useState<boolean>(false);
  const [mentionIdx,  setMentionIdx]  = useState(0);
  // Portal dropdown position (fixed, screen coords)
  const [portalStyle, setPortalStyle] = useState<React.CSSProperties>({});

  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const blurTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isComposing    = useRef(false);
  const mentionListRef = useRef<HTMLDivElement>(null);
  const dateInputRef   = useRef<HTMLInputElement>(null);
  const nodeRef        = useRef<HTMLDivElement>(null);

  // Report actual rendered height to parent via CB so layout can adapt
  useEffect(() => {
    const el = nodeRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight;
      if (h > 0) CB.onNodeHeightChange(id, h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [id]);

  const clearBlurTimer = () => {
    if (blurTimer.current) { clearTimeout(blurTimer.current); blurTimer.current = null; }
  };

  // Update portal position from input rect
  const updatePortalPos = useCallback(() => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPortalStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left, zIndex: 99999 });
  }, []);

  // Auto-focus on editing start
  useEffect(() => {
    if (!d.isEditing) { setDraft(d.label); return; }
    setDraft(d.label);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }));
  }, [d.isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!d.isEditing) setDraft(d.label); }, [d.label, d.isEditing]);

  // Auto-resize textarea to match content (WYSIWYG)
  const syncTextareaHeight = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  useEffect(() => {
    if (d.isEditing) syncTextareaHeight();
  }, [draft, d.isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val    = e.target.value;
    const cursor = e.target.selectionStart ?? val.length;
    setDraft(val);
    if (!isTask) return;
    // During IME composition selectionStart is unreliable → skip anchor detection
    // to avoid accidentally closing the dropdown mid-composition
    if ((e.nativeEvent as InputEvent).isComposing) return;

    let ma = findMentionAnchor(val, cursor);
    // @ 后继续输入若无任何成员匹配，则 @ 及后续文字当作普通文本，不识别为提及
    if (ma && ma.query.trim() !== '') {
      const q = ma.query.toLowerCase();
      const hasMatch = CB.members.some(m => {
        const text = (m.name || m.email).toLowerCase();
        let qi = 0;
        for (let i = 0; i < text.length && qi < q.length; i++) {
          if (text[i] === q[qi]) qi++;
        }
        return qi === q.length;
      });
      if (!hasMatch) ma = null;
    }
    const da = !ma ? findDateAnchor(val, cursor) : null;
    setMention(ma);
    setDatePick(!!da);
    if (ma || da) updatePortalPos();
  };

  const commit = useCallback(() => {
    clearBlurTimer();
    const text = draft.replace(/\n+/g, ' ').trim();
    CB.onLabelChange(id, text || d.label || '新节点');
    CB.setEditingId(null);
    setMention(null); setDatePick(false);
  }, [draft, d.label, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const insertMember = (m: SpaceMember) => {
    if (!mention) return;
    clearBlurTimer();
    const name   = m.name || m.email.split('@')[0];
    const before = draft.slice(0, mention.start);
    const after  = draft.slice(mention.start + 1 + mention.query.length);
    setDraft(`${before}@${name} ${after}`);
    setMention(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const insertDate = (fmt: string) => {
    clearBlurTimer();
    const anchor = findDateAnchor(draft, draft.length);
    const start  = anchor ? anchor.start : draft.lastIndexOf('#');
    if (start < 0) return;
    const before = draft.slice(0, start);
    const rest   = draft.slice(start + 1).replace(/^[^@#]*/, '');
    setDraft(`${before}#${fmt} ${rest}`.trimEnd());
    setDatePick(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  // Read current value from the uncontrolled date input and commit it.
  // Safe to call even after the input is unmounted (ref will be null → no-op).
  const doCommitDate = () => {
    const val = dateInputRef.current?.value;
    if (!val) { setDatePick(false); return; }
    const dt  = new Date(val);
    const pad = (n: number) => String(n).padStart(2, '0');
    insertDate(`${dt.getFullYear()}/${pad(dt.getMonth()+1)}/${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`);
  };

  // Reset selection when mention query changes
  useEffect(() => { setMentionIdx(0); }, [mention?.query]);

  // Scroll selected item into view
  useEffect(() => {
    const list = mentionListRef.current;
    if (!list) return;
    const active = list.querySelector<HTMLElement>('.mm-dropdown-item--active');
    active?.scrollIntoView({ block: 'nearest' });
  }, [mentionIdx]);

  const filteredMembers = useMemo(() => {
    if (!mention) return [];
    if (!mention.query.trim()) return CB.members;
    const q = mention.query.toLowerCase();
    return CB.members.filter(m => {
      const text = (m.name || m.email).toLowerCase();
      // Fuzzy: all chars of q appear in text in order
      let qi = 0;
      for (let i = 0; i < text.length && qi < q.length; i++) {
        if (text[i] === q[qi]) qi++;
      }
      return qi === q.length;
    });
  }, [mention]);

  const labelTokens = useMemo(() => parseLabel(d.label, CB.members), [d.label, CB.members]);
  const circleNums  = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨'];

  const cls = ['mm-node',
    selected ? 'mm-node--selected' : '',
    d.depth === 0 ? 'mm-node--root' : d.depth === 1 ? 'mm-node--list' : 'mm-node--task',
    d.isTextMode ? 'mm-node--text-mode' : '',
  ].filter(Boolean).join(' ');

  const dropdownOpen = mention !== null || datePick;

  return (
    <div ref={nodeRef} className={cls}>
      {d.depth > 0 && <Handle type="target" position={d.targetPos} className="mm-handle" />}

      {/* 内容区：flex:1，独立 overflow:hidden 防文字超出 */}
      <div className="mm-node__body">
      {d.isEditing ? (
        <div className="mm-node__edit-wrap" onMouseDown={e => e.stopPropagation()}>
          <textarea
            ref={inputRef}
            className="mm-node__input"
            value={draft}
            rows={1}
            placeholder={isTask ? '@成员  #截止时间' : d.depth === 1 ? '清单名称' : '文件名'}
            onChange={handleChange}
            onBlur={() => {
              blurTimer.current = setTimeout(() => {
                setMention(null);
                setDatePick(false);
                commit();
              }, 180);
            }}
            onCompositionStart={() => { isComposing.current = true; }}
            onCompositionEnd={() => { isComposing.current = false; }}
            onKeyDown={e => {
              e.stopPropagation();
              if (isComposing.current) return;

              if (mention !== null) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setMentionIdx(i => Math.min(i + 1, filteredMembers.length - 1));
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setMentionIdx(i => Math.max(i - 1, 0));
                  return;
                }
                if ((e.key === 'Enter' || e.key === ' ') && filteredMembers.length > 0) {
                  e.preventDefault();
                  insertMember(filteredMembers[Math.min(mentionIdx, filteredMembers.length - 1)]);
                  return;
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  clearBlurTimer();
                  setMention(null);
                  return;
                }
              }

              if (e.key === 'Escape') {
                e.preventDefault();
                clearBlurTimer();
                setMention(null); setDatePick(false);
                CB.setEditingId(null);
              }
              // Enter without Shift = commit (no newline in label)
              if (e.key === 'Enter' && !e.shiftKey && !mention && !datePick) {
                e.preventDefault();
                commit();
              }
            }}
            onClick={e => e.stopPropagation()}
          />

          {/* @mention portal dropdown */}
          {mention !== null && createPortal(
            <div ref={mentionListRef} className="mm-dropdown mm-mention-list" style={portalStyle} tabIndex={-1}>
              {filteredMembers.length === 0 ? (
                <div className="mm-dropdown-empty">
                  {CB.members.length === 0 ? '暂无空间成员' : '无匹配成员'}
                </div>
              ) : (
                filteredMembers.map((m, i) => (
                  <button key={m.id}
                    className={`mm-dropdown-item${i === mentionIdx ? ' mm-dropdown-item--active' : ''}`}
                    onMouseEnter={() => setMentionIdx(i)}
                    onMouseDown={e => { e.preventDefault(); clearBlurTimer(); insertMember(m); }}>
                    <span className="mm-avatar">{(m.name || m.email)[0].toUpperCase()}</span>
                    <span>{m.name || m.email}</span>
                  </button>
                ))
              )}
            </div>,
            document.body
          )}

          {/* # date picker portal */}
          {datePick && createPortal(
            <div className="mm-dropdown mm-date-wrap" style={portalStyle} tabIndex={-1}
              onMouseDown={e => { e.preventDefault(); clearBlurTimer(); }}>
              <label className="mm-date-label">截止时间 (Enter 确认)</label>
              <input
                ref={dateInputRef}
                type="datetime-local"
                className="mm-date-input"
                defaultValue={defaultDatetime()}
                autoFocus
                onFocus={() => {
                  clearBlurTimer();
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    clearBlurTimer();
                    doCommitDate();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    clearBlurTimer();
                    setDatePick(false);
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }
                }}
                onBlur={() => {
                  blurTimer.current = setTimeout(doCommitDate, 180);
                }}
              />
            </div>,
            document.body
          )}
        </div>
      ) : (
        <div className="mm-node__display" onDoubleClick={() => CB.setEditingId(id)}>
          {/* Text 模式下所有节点都显示人员和时间识别，其他模式只有任务节点显示 */}
          {(isTask || d.isTextMode) ? (
            <span className="mm-node__rich">
              {d.label
                ? labelTokens.map((t, i) =>
                    t.type === 'mention' ? <span key={i} className="mm-token-mention">{t.text}</span>
                    : t.type === 'date'  ? <span key={i} className="mm-token-date">{t.text}</span>
                    :                      <span key={i}>{t.text}</span>
                  )
                : <em className="mm-node__placeholder">双击编辑</em>
              }
            </span>
          ) : (
            <span className="mm-node__label">
              {d.label || <em className="mm-node__placeholder">双击编辑</em>}
            </span>
          )}
        </div>
      )}
      </div>{/* end mm-node__body */}

      {/* 折叠/展开徽标：绝对定位在连线起点（sourcePos 方向的边缘中点），显示子节点数量 */}
      {d.hasKids && (
        <button
          className={`mm-node__badge${d.collapsed ? ' mm-node__badge--collapsed' : ''}`}
          data-pos={d.sourcePos}
          title={d.collapsed ? `展开` : `折叠`}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); CB.onToggleCollapse(id); }}
        >
          {d.childCount}
        </button>
      )}
      <Handle type="source" position={d.sourcePos} className="mm-handle" />
    </div>
  );
}

const nodeTypes: NodeTypes = { mindnode: MindNode };

// ─────────────────────────────────────────────────────────────────
// Custom Edge — 直接从节点位置/尺寸计算端点，绕过 handle DOM 测量
// 彻底消除因 handle getBoundingClientRect 偏差导致的"回头"问题
// ─────────────────────────────────────────────────────────────────
function MindEdge({ id, source, target, data, style }: EdgeProps) {
  const dir = (data?.dir as LayoutDir) ?? 'LR';

  const sourceNode = useStore(s => s.nodeLookup.get(source));
  const targetNode = useStore(s => s.nodeLookup.get(target));
  if (!sourceNode || !targetNode) return null;

  // internals.positionAbsolute 是经过父节点偏移后的绝对坐标（支持嵌套）
  const sp = (sourceNode as any).internals?.positionAbsolute ?? sourceNode.position;
  const tp = (targetNode as any).internals?.positionAbsolute ?? targetNode.position;
  const sW = sourceNode.width  ?? TASK_W;
  // Prefer explicit height (from our layout) over stale measured.height
  const sH = sourceNode.height ?? (sourceNode as any).measured?.height ?? TASK_H;
  const tW = targetNode.width  ?? TASK_W;
  const tH = targetNode.height ?? (targetNode as any).measured?.height ?? TASK_H;

  // 根据布局方向计算连线起终点
  const sourceDepth = (sourceNode.data as NodeData)?.depth ?? 0;
  const targetDepth = (targetNode.data as NodeData)?.depth ?? 0;
  // TB/Text 模式下，所有连线都使用 L 形连线
  const isTreeLayout = dir === 'Text' || (dir === 'TB' && (sourceDepth === 1 || targetDepth >= 2));

  let edgePath: string;

  if (isTreeLayout) {
    // TB/Text 模式下：L 形连线，从父节点左端点连到子节点左端点
    // 路径：父节点左端（底部）→ 垂直向下 → 水平向右到子节点左边缘（形成 L 形）
    const sx = sp.x; // 父节点左端点（底部）
    const sy = sp.y + sH;
    const tx = tp.x; // 子节点左边缘
    const ty = tp.y + tH / 2; // 子节点中心
    // L 形：从父节点左端点往下，至子节点的中心，转水平向右
    edgePath = `M ${sx} ${sy} L ${sx} ${ty} L ${tx} ${ty}`;
  } else {
    // LR/RL 或 TB 第一级：使用贝塞尔曲线
    let sx: number, sy: number, tx: number, ty: number;
    let c1x: number, c1y: number, c2x: number, c2y: number;

    if (dir === 'LR') {
      sx = sp.x + sW; sy = sp.y + sH / 2;
      tx = tp.x;      ty = tp.y + tH / 2;
      const cp = (tx - sx) / 2;
      c1x = sx + cp; c1y = sy;
      c2x = tx - cp; c2y = ty;
    } else if (dir === 'RL') {
      sx = sp.x;      sy = sp.y + sH / 2;
      tx = tp.x + tW; ty = tp.y + tH / 2;
      const cp = (sx - tx) / 2;
      c1x = sx - cp; c1y = sy;
      c2x = tx + cp; c2y = ty;
    } else { // TB
      sx = sp.x + sW / 2; sy = sp.y;
      tx = tp.x + tW / 2; ty = tp.y + tH;
      const cp = (sy - ty) / 2;
      c1x = sx; c1y = sy - cp;
      c2x = tx; c2y = ty + cp;
    }
    edgePath = `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`;
  }

  return <BaseEdge id={id} path={edgePath} style={style as React.CSSProperties} />;
}

const edgeTypes: EdgeTypes = { mindedge: MindEdge };

// ─────────────────────────────────────────────────────────────────
// Direction labels
// ─────────────────────────────────────────────────────────────────
const DIR_LABELS: { value: LayoutDir; label: string }[] = [
  { value: 'LR', label: '→ 左右' }, { value: 'TB', label: '↓ 上下' },
  { value: 'RL', label: '← 右左' }, { value: 'Text', label: '📝 文本' },
];

// ── Zoom ruler (must live inside <ReactFlow> to access context) ──
const SNAP_LEVELS = [1.5, 1.25, 1.0, 0.8, 0.6] as const;
const ZOOM_MIN = 0.6, ZOOM_MAX = 1.5, ZOOM_RANGE = ZOOM_MAX - ZOOM_MIN;

function ZoomRuler() {
  const { zoom }          = useViewport();
  const { zoomTo }        = useReactFlow();
  const trackRef          = useRef<HTMLDivElement>(null);
  const dragging          = useRef(false);

  const toFrac  = (z: number) => (Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)) - ZOOM_MIN) / ZOOM_RANGE;
  const toZoom  = (f: number) => ZOOM_MIN + Math.max(0, Math.min(1, f)) * ZOOM_RANGE;

  const stepUp = () => {
    const next = [...SNAP_LEVELS].sort((a, b) => a - b).find(l => l > zoom + 0.01);
    if (next) zoomTo(next, { duration: 220 });
  };
  const stepDown = () => {
    const next = [...SNAP_LEVELS].sort((a, b) => b - a).find(l => l < zoom - 0.01);
    if (next) zoomTo(next, { duration: 220 });
  };

  const applyFromEvent = (clientY: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const frac = 1 - (clientY - rect.top) / rect.height;
    zoomTo(toZoom(frac), { duration: 0 });
  };

  const onTrackMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    applyFromEvent(e.clientY);
    const onMove = (ev: MouseEvent) => { if (dragging.current) applyFromEvent(ev.clientY); };
    const onUp   = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  };

  const handleFrac = toFrac(zoom);

  return (
    <div className="mm-zoom-ruler">
      <button className="mm-zoom-btn" onClick={stepUp}
        disabled={zoom >= ZOOM_MAX - 0.01} title="放大一级">＋</button>

      <div className="mm-zoom-track" ref={trackRef} onMouseDown={onTrackMouseDown}>
        <div className="mm-zoom-track-line" />

        {SNAP_LEVELS.map(level => {
          const frac   = toFrac(level);
          const active = Math.abs(zoom - level) < 0.02;
          return (
            <div key={level} className={`mm-zoom-tick${active ? ' active' : ''}`}
              style={{ bottom: `${frac * 100}%` }}
              onMouseDown={e => { e.stopPropagation(); zoomTo(level, { duration: 220 }); }}>
              <span className="mm-zoom-tick-label">{Math.round(level * 100)}%</span>
              <div className="mm-zoom-tick-dot" />
            </div>
          );
        })}

        <div className="mm-zoom-handle" style={{ bottom: `${handleFrac * 100}%` }}
          onMouseDown={onTrackMouseDown} />
      </div>

      <button className="mm-zoom-btn" onClick={stepDown}
        disabled={zoom <= ZOOM_MIN + 0.01} title="缩小一级">－</button>

      <div className="mm-zoom-pct">{Math.round(zoom * 100)}%</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Default tree
// ─────────────────────────────────────────────────────────────────
const DEFAULT_TREE: MindTreeNode[] = [
  { id: 'root', label: '',       parentId: null,   collapsed: false },
  { id: 'l1',   label: '清单 1', parentId: 'root', collapsed: false },
  { id: 'l2',   label: '清单 2', parentId: 'root', collapsed: false },
  { id: 't1',   label: '任务 1', parentId: 'l1',   collapsed: false },
  { id: 't2',   label: '任务 2', parentId: 'l1',   collapsed: false },
];
const { nodes: initNodes, edges: initEdges } = computeLayout(DEFAULT_TREE, 'LR', defaultNodeH);

// ─────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────
export default function MindMapEditor() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [mindMap,      setMindMap]      = useState<MindMap | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [dir,          setDir]          = useState<LayoutDir>('LR');
  const [tree,         setTree]         = useState<MindTreeNode[]>(DEFAULT_TREE);
  const [selectedId,   setSelectedId]   = useState<string>('root'); // 主选中节点（用于向后兼容）
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set(['root'])); // 多选节点集合
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [layoutVersion,setLayoutVersion]= useState(0);
  const [clipboard,    setClipboard]    = useState<MindTreeNode[] | null>(null);
  const [showSearch,   setShowSearch]   = useState(false);
  const [searchTerm,   setSearchTerm]   = useState('');
  const [showShortcuts,setShowShortcuts]= useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [layoutMode,   setLayoutMode]   = useState<'free' | 'auto'>('auto');
  // Text 模式文本编辑器
  const [textContent,  setTextContent]  = useState<string>('');
  const textEditorRef  = useRef<HTMLTextAreaElement>(null);
  const [textMention, setTextMention]  = useState<{ start: number; query: string } | null>(null);
  const [textDatePick, setTextDatePick] = useState<boolean>(false);
  const [textMentionIdx, setTextMentionIdx] = useState(0);
  const textMentionListRef = useRef<HTMLDivElement>(null);
  const textDateInputRef = useRef<HTMLInputElement>(null);
  const textDecorationRef = useRef<HTMLDivElement>(null);
  const [decorationSize, setDecorationSize] = useState({ w: 400, h: 600 });

  // 测量文本装饰层内容区域，使 SVG 与 textarea 对齐
  useEffect(() => {
    if (dir !== 'Text' || !textDecorationRef.current) return;
    const el = textDecorationRef.current;
    const padding = 24;
    const measure = () => {
      const w = el.clientWidth - padding * 2;
      const h = el.clientHeight - padding * 2;
      if (w > 0 && h > 0) setDecorationSize({ w: Math.max(200, w), h: Math.max(200, h) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [dir, textContent]);

  // Text 模式：预计算装饰数据，供单层 SVG 绘制（坐标与 textarea content 一致：0-based，与 padding 无关）
  const textDecorationSvg = useMemo(() => {
    if (dir !== 'Text') return { viewBox: '0 0 1 1', dots: [] as Array<{ cx: number; cy: number }>, paths: [] as Array<string> };

    const lines = textContent.split('\n');
    const lineHeight = 1.8;
    const fontSize = 14;
    const indentWidth = 16;
    const dotRadius = 4;
    const rowHeight = fontSize * lineHeight;

    const dots: Array<{ cx: number; cy: number }> = [];
    const paths: Array<string> = [];

    for (let idx = 1; idx < lines.length; idx++) {
      const line = lines[idx];
      const indent = Math.floor((line.match(/^(\s*)/)?.[1]?.length || 0) / 2);
      const lineTop = idx * rowHeight;
      const dotLeft = indent * indentWidth;
      const cx = dotLeft + dotRadius;
      const cy = lineTop + rowHeight / 2;
      dots.push({ cx, cy });

      let parentIdx = -1;
      let parentIndent = -1;
      for (let i = idx - 1; i >= 0; i--) {
        const prevIndent = Math.floor((lines[i].match(/^(\s*)/)?.[1]?.length || 0) / 2);
        if (prevIndent < indent) {
          parentIdx = i;
          parentIndent = prevIndent;
          break;
        }
      }

      if (parentIdx >= 0 && indent > 0) {
        const parentTop = parentIdx * rowHeight;
        const parentLeft = parentIndent * indentWidth;
        const parentCx = parentLeft + dotRadius;
        const parentCy = parentTop + rowHeight / 2;
        const d = `M ${parentCx} ${parentCy} V ${cy} H ${cx}`;
        paths.push(d);
      }
    }

    const maxY = Math.max(decorationSize.h, lines.length > 0 ? lines.length * rowHeight + 40 : 400);
    const viewBox = `0 0 ${decorationSize.w} ${maxY}`;
    return { viewBox, dots, paths };
  }, [textContent, dir, decorationSize]);

  const [rfNodes, setRfNodes, onRfNodesChange] = useNodesState<Node>(initNodes);
  const [rfEdges, setRfEdges, onRfEdgesChange] = useEdgesState<Edge>(initEdges);

  const reactFlowInstance = useReactFlow();
  const containerRef  = useRef<HTMLDivElement>(null);
  const searchRef     = useRef<HTMLInputElement>(null);
  const treeRef       = useRef(tree);
  const rfNodesRef    = useRef<Node[]>(initNodes);
  // For parent-drag-with-children
  const dragStartRef  = useRef<Map<string, { x: number; y: number }>>(new Map());
  // 记录用户手动拖移根节点后的坐标（布局重算时以此为锚点偏移整棵树）
  const rootPosRef    = useRef<{ x: number; y: number } | null>(null);
  // For sibling reorder during drag
  type DragOrderState = {
    dragId:   string;
    parentId: string;
    axis:     'x' | 'y';
    nodeW:    number;  // 同级节点宽度（同深度）
    nodeH:    number;  // 同级节点高度（同深度）
    slots:    Array<{ id: string; pos: number; origX: number; origY: number }>;
  };
  const dragOrderRef  = useRef<DragOrderState | null>(null);

  // Measured node heights from ResizeObserver (border-box)
  const measuredHeightsRef    = useRef<Map<string, number>>(new Map());
  const heightRelayoutRaf     = useRef<number | null>(null);
  // 跟踪拖拽状态，避免拖拽过程中触发布局重算导致 removeChild 报错
  const isDraggingRef          = useRef(false);
  // 首次布局重算延后到 React Flow 首帧渲染之后，避免挂载即 replace nodes 导致 removeChild
  const layoutEffectHasRunRef  = useRef(false);
  // 切换布局方向时的过渡：先收起 → 移动画布 → 逐级展开，并记住用户之前的展开/收起
  const layoutTransitionRef    = useRef<{ savedCollapsed: Map<string, boolean> } | null>(null);
  // 逐级展开过程中不调整 viewport，避免 TB/Text 下根节点抖动
  const isExpandingRef         = useRef(false);
  const [isExpanding, setIsExpanding] = useState(false);
  // 记录根节点的目标屏幕位置（TB/BT 模式下固定，避免子节点展开时根节点抖动）
  const rootTargetScreenPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => { treeRef.current   = tree;    }, [tree]);
  useEffect(() => { rfNodesRef.current = rfNodes; }, [rfNodes]);
  
  // Text 模式：树结构 → 文本内容同步（只在切换到 Text 模式或树结构变化时）
  const textContentSyncedRef = useRef<string>('');
  useEffect(() => {
    if (dir === 'Text') {
      const root = tree.find(n => !n.parentId);
      if (root) {
        const text = treeToText(tree);
        // 只在树结构真正变化时更新文本（避免循环更新）
        if (text !== textContentSyncedRef.current) {
          textContentSyncedRef.current = text;
          setTextContent(text);
        }
      }
    } else {
      // 切换到非 Text 模式时，重置同步标记
      textContentSyncedRef.current = '';
    }
  }, [tree, dir]); // eslint-disable-line react-hooks/exhaustive-deps
  
  // Text 模式：成员选单选中项变化时滚动到视图
  useEffect(() => {
    if (textMention && textMentionListRef.current) {
      const active = textMentionListRef.current.querySelector<HTMLElement>('.mm-dropdown-item--active');
      active?.scrollIntoView({ block: 'nearest' });
    }
  }, [textMentionIdx, textMention]);
  
  // Text 模式：文本内容变化时更新树结构
  // 确保根节点始终存在，即使文本被完全删除
  const handleTextChange = useCallback((newText: string) => {
    setTextContent(newText);
    textContentSyncedRef.current = newText; // 更新同步标记
    const root = tree.find(n => !n.parentId);
    if (root) {
      // 始终使用现有的根节点 ID，确保根节点不会被删除
      const newTree = textToTree(newText, root.id);
      // 验证：确保根节点存在且唯一
      const rootNodes = newTree.filter(n => !n.parentId);
      if (rootNodes.length === 0) {
        // 如果根节点丢失（不应该发生），重新添加
        newTree.unshift({ id: root.id, label: '', parentId: null, collapsed: false });
      } else if (rootNodes.length > 1) {
        // 如果有多个根节点（不应该发生），只保留第一个，其他的改为第一个的子节点
        const firstRoot = rootNodes[0];
        for (let i = 1; i < rootNodes.length; i++) {
          const extraRoot = rootNodes[i];
          extraRoot.parentId = firstRoot.id;
        }
      }
      treeRef.current = newTree;
      setTree(newTree);
    } else {
      // 如果没有根节点（不应该发生），创建一个
      const newRootId = 'root';
      const newTree = textToTree(newText, newRootId);
      treeRef.current = newTree;
      setTree(newTree);
    }
  }, [tree]);

  // getNodeH: actual measured height when available, otherwise layout default
  const getNodeH = useCallback((nid: string, depth: number): number =>
    measuredHeightsRef.current.get(nid) ?? NODE_H[depth] ?? TASK_H,
  []);

  // Callbacks
  CB.onLabelChange = useCallback((nid: string, label: string) => {
    setTree(prev => setLabel(prev, nid, label));
    setRfNodes(prev => prev.map(n =>
      n.id === nid ? { ...n, data: { ...n.data as NodeData, label } } : n
    ));
  }, [setRfNodes]);
  CB.onToggleCollapse = useCallback((nid: string) => {
    setTree(prev => { const next = toggleCollapse(prev, nid); treeRef.current = next; return next; });
    setLayoutVersion(v => v + 1);
  }, []);
  CB.setEditingId = useCallback((nid: string | null) => setEditingId(nid), []);

  // Height reported by each node's ResizeObserver → rAF-batched relayout
  // 拖拽过程中延迟布局重算，避免与 React Flow 的 DOM 更新冲突
  CB.onNodeHeightChange = useCallback((nid: string, h: number) => {
    const prev = measuredHeightsRef.current.get(nid);
    if (prev !== undefined && Math.abs(prev - h) < 2) return;
    measuredHeightsRef.current.set(nid, h);
    // 如果正在拖拽，延迟到拖拽结束后再重算布局
    if (isDraggingRef.current) return;
    if (heightRelayoutRaf.current !== null) cancelAnimationFrame(heightRelayoutRaf.current);
    heightRelayoutRaf.current = requestAnimationFrame(() => {
      heightRelayoutRaf.current = null;
      if (!isDraggingRef.current) setLayoutVersion(v => v + 1);
    });
  }, []);

  // 切换布局方向时重置根节点锚点（方向变了，原坐标已无意义）
  useEffect(() => { rootPosRef.current = null; }, [dir]);

  // 切换布局方向：先收起 → 移动画布到根位置 → 再逐级展开（并恢复用户之前的展开/收起）
  const handleDirChange = useCallback((newDir: LayoutDir) => {
    // 如果从 Text 模式切换出去，强制同步文本内容到树结构
    if (dir === 'Text' && newDir !== 'Text') {
      const root = treeRef.current.find(n => !n.parentId);
      if (root) {
        // 强制同步：无论是否变化，都重新解析文本
        const newTree = textToTree(textContent, root.id);
        // 验证：确保根节点存在且唯一
        const rootNodes = newTree.filter(n => !n.parentId);
        if (rootNodes.length === 0) {
          newTree.unshift({ id: root.id, label: '', parentId: null, collapsed: false });
        } else if (rootNodes.length > 1) {
          const firstRoot = rootNodes[0];
          for (let i = 1; i < rootNodes.length; i++) {
            rootNodes[i].parentId = firstRoot.id;
          }
        }
        treeRef.current = newTree;
        textContentSyncedRef.current = textContent; // 更新同步标记
        
        // 保存展开/收起状态，然后收起所有节点
        const savedCollapsed = new Map(newTree.map(n => [n.id, n.collapsed]));
        const collapsedTree = newTree.map(n => ({ ...n, collapsed: true }));
        treeRef.current = collapsedTree;
        
        // 同步更新状态并切换方向，确保布局 effect 能正确触发
        setTree(collapsedTree);
        layoutTransitionRef.current = { savedCollapsed };
        setDir(newDir);
        setLayoutVersion(v => v + 1);
        return;
      }
    }
    
    const currentTree = treeRef.current;
    if (currentTree.length <= 1) {
      setDir(newDir);
      setLayoutVersion(v => v + 1);
      return;
    }
    layoutTransitionRef.current = {
      savedCollapsed: new Map(currentTree.map(n => [n.id, n.collapsed])),
    };
    setTree(prev => prev.map(n => ({ ...n, collapsed: true })));
    setDir(newDir);
    setLayoutVersion(v => v + 1);
  }, [tree, dir, textContent]);

  // 逐级展开并恢复用户之前的展开/收起（在 viewport 移动后由 viewport effect 调度）
  const runExpandSequence = useCallback((savedCollapsed: Map<string, boolean>) => {
    const currentTree = treeRef.current;
    if (currentTree.length === 0) return;
    const maxDepth = Math.max(...currentTree.map(n => getDepth(currentTree, n.id)));
    isExpandingRef.current = true;
    setIsExpanding(true);
    let depth = 1;
    function step() {
      if (depth <= maxDepth) {
        setTree(prev => prev.map(n => ({ ...n, collapsed: getDepth(prev, n.id) > depth })));
        setLayoutVersion(v => v + 1);
        depth += 1;
        setTimeout(step, 90);
      } else {
        setTree(prev => prev.map(n => ({ ...n, collapsed: savedCollapsed.get(n.id) ?? false })));
        setLayoutVersion(v => v + 1);
        isExpandingRef.current = false;
        setIsExpanding(false);
      }
    }
    setTimeout(step, 120);
  }, []);

  // 仅在自动整理模式下，当 dir 或 layoutVersion 变化时移动画布到该模式下的根节点目标位置
  // 自由画布模式下完全不调整视口，让用户自由控制；逐级展开过程中也不调整，避免根节点抖动
  const lastViewportAdjustRef = useRef<{ dir: LayoutDir; layoutVersion: number } | null>(null);
  useEffect(() => {
    if (layoutMode === 'free') return;
    if (isExpandingRef.current) return;

    const triggerChanged =
      lastViewportAdjustRef.current?.dir !== dir ||
      lastViewportAdjustRef.current?.layoutVersion !== layoutVersion;
    if (!triggerChanged) return;

    const isFirstAdjust = lastViewportAdjustRef.current === null;
    // 不依赖 rfNodes，避免布局更新时重复调度；在 timeout 内从 ref 读取最新节点
    const delay = isFirstAdjust ? 250 : 120;
    const timer = setTimeout(() => {
      if (!reactFlowInstance.viewportInitialized) return;
      const container = containerRef.current?.querySelector<HTMLElement>('.react-flow__viewport');
      if (!container) return;

      const nodes = rfNodesRef.current;
      const currentRootNode = nodes.find(n => {
        const tNode = treeRef.current.find(t => t.id === n.id);
        return tNode && !tNode.parentId;
      });
      if (!currentRootNode || nodes.length === 0) return;

      const viewport = reactFlowInstance.getViewport();
      const viewportW = container.clientWidth;
      const viewportH = container.clientHeight;
      const padding = 100;
      const zoomRulerRight = 120;

      // 根节点固定在画布中心 (0, 0)，通过调整 viewport 让根节点出现在视窗合适位置
      const zoom = isFirstAdjust ? 1.0 : viewport.zoom;
      let viewportX: number;
      let viewportY: number;
      
      if (dir === 'LR') {
        // 左右模式：让画布中心偏右的位置位于视窗中心，使根节点（画布中心）位于视窗左侧
        // 视窗中心 = viewportW/2，要让根节点（世界坐标 0,0）在屏幕 padding 位置
        // screenX = viewportX + 0*zoom = viewportX，所以 viewportX = padding
        viewportX = padding;
        viewportY = viewportH / 2; // 垂直居中
      } else if (dir === 'RL') {
        // 右左模式：让画布中心偏左的位置位于视窗中心，使根节点位于视窗右侧
        viewportX = viewportW - padding - zoomRulerRight;
        viewportY = viewportH / 2;
      } else if (dir === 'TB') {
        // 上下模式：让画布中心偏下的位置位于视窗中心，使根节点位于视窗顶部
        viewportX = viewportW / 2; // 水平居中
        viewportY = padding;
      } else if (dir === 'Text') {
        // 文本模式：类似 TB，根节点中心在 (0,0)，让根节点顶部在视窗顶部
        const rootH = currentRootNode.height ?? (NODE_H[0] ?? 36);
        const targetScreenX = viewportW / 2;
        const targetScreenY = padding + rootH / 2;
        const rootCenterX = 0;
        const rootCenterY = 0;
        viewportX = targetScreenX - rootCenterX * zoom;
        viewportY = targetScreenY - rootCenterY * zoom;
      } else {
        // 默认值（不应该到达这里）
        viewportX = viewportW / 2;
        viewportY = viewportH / 2;
      }
      reactFlowInstance.setViewport({ x: viewportX, y: viewportY, zoom }, { duration: 0 });
      lastViewportAdjustRef.current = { dir, layoutVersion };
      // 根节点固定在画布中心，不再需要记录目标屏幕位置
      rootTargetScreenPosRef.current = null;

      // 若本次是「先收起再移动」的布局切换，在画布到位后逐级展开并恢复用户展开/收起
      const transition = layoutTransitionRef.current;
      layoutTransitionRef.current = null;
      if (transition) runExpandSequence(transition.savedCollapsed);
    }, delay);

    return () => clearTimeout(timer);
  }, [dir, layoutVersion, layoutMode, reactFlowInstance, runExpandSequence]);

  // Structural layout recompute（仅在自动整理模式下）
  useEffect(() => {
    // Text 模式下不计算画布布局
    if (dir === 'Text') return;
    // 自由画布模式下不自动重算布局，让用户自由拖拽节点
    if (layoutMode === 'free') return;
    // 拖拽过程中跳过布局重算，避免与 React Flow 的 DOM 更新冲突导致 removeChild 报错
    if (isDraggingRef.current) return;

    const runLayout = () => {
      if (isDraggingRef.current) return;
      const { nodes: newNodes, edges } = computeLayout(treeRef.current, dir, getNodeH);

      // 若用户手动拖移过根节点，以其当前位置为锚点整体偏移布局结果
      const rootId = treeRef.current.find(n => !n.parentId)?.id;
      let finalNodes = newNodes;
      if (rootId && rootPosRef.current !== null) {
        const computedRoot = newNodes.find(n => n.id === rootId);
        if (computedRoot) {
          const dx = rootPosRef.current.x - computedRoot.position.x;
          const dy = rootPosRef.current.y - computedRoot.position.y;
          if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
            finalNodes = newNodes.map(n => ({
              ...n,
              position: { x: n.position.x + dx, y: n.position.y + dy },
            }));
          }
        }
      }

      // 同批提交 nodes + edges，避免 React Flow 只收到 nodes 而丢失连线
      flushSync(() => {
        setRfNodes(prev => {
          const measuredMap = new Map(prev.map(n => [n.id, (n as any).measured]));
          return finalNodes.map(n => ({
            ...n,
            measured: measuredMap.get(n.id),
            selected: selectedIds.has(n.id),
            data: { ...n.data as NodeData, isEditing: n.id === editingId },
          }));
        });
        setRfEdges(edges);
      });
      layoutEffectHasRunRef.current = true;
      // 根节点固定在画布中心 (0,0)，布局重算时世界坐标不变，无需调整 viewport
    };

    // 首次进入模块时延后到 React Flow 首帧渲染后再重算，避免挂载即 replace 导致 removeChild
    if (!layoutEffectHasRunRef.current) {
      let raf2: number | undefined;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(runLayout);
      });
      return () => {
        cancelAnimationFrame(raf1);
        if (raf2 !== undefined) cancelAnimationFrame(raf2);
      };
    }

    const timer = setTimeout(runLayout, 0);
    return () => clearTimeout(timer);
  }, [layoutVersion, dir, layoutMode, tree]); // 添加 tree 依赖，确保从 Text 模式切换回来时能触发布局重算

  // State-only update (preserves drag positions)
  useEffect(() => {
    setRfNodes(prev => prev.map(n => ({
      ...n, selected: selectedIds.has(n.id),
      data: { ...n.data as NodeData, isEditing: n.id === editingId },
    })));
  }, [selectedIds, editingId]);

  // Filter onNodesChange: allow position/dimension, block React Flow's built-in select
  const handleNodesChange: OnNodesChange = useCallback((changes: NodeChange[]) => {
    const allowed = changes.filter(c => c.type !== 'select');
    if (allowed.length) onRfNodesChange(allowed);
  }, [onRfNodesChange]);

  // ── Drag: parent-with-children + sibling reorder ───────────────
  const onNodeDragStart = useCallback((_: React.MouseEvent, node: Node) => {
    isDraggingRef.current = true;
    // 1. Capture start positions of dragged node + its descendants
    const map   = new Map<string, { x: number; y: number }>();
    const descs = descendants(treeRef.current, node.id);
    rfNodesRef.current.forEach(n => {
      if (n.id === node.id || descs.includes(n.id))
        map.set(n.id, { x: n.position.x, y: n.position.y });
    });
    dragStartRef.current = map;

    // 2. Capture sibling slots for reorder tracking
    const tNode = treeRef.current.find(n => n.id === node.id);
    if (!tNode?.parentId) { dragOrderRef.current = null; return; }
    const depth  = getDepth(treeRef.current, node.id);
    const axis   = getSortAxis(dir, depth);
    const nodeW  = NODE_W[depth] ?? TASK_W;
    const nodeH  = NODE_H[depth] ?? TASK_H;
    const siblings = treeRef.current.filter(n => n.parentId === tNode.parentId);
    const slots  = siblings
      .map(s => {
        const rf = rfNodesRef.current.find(n => n.id === s.id);
        // position 是左上角，加半高/半宽得到节点中心，用于热区比较
        return {
          id: s.id, origX: rf?.position.x ?? 0, origY: rf?.position.y ?? 0,
          pos: rf ? (axis === 'y' ? rf.position.y + nodeH / 2 : rf.position.x + nodeW / 2) : 0,
        };
      })
      .sort((a, b) => a.pos - b.pos);
    dragOrderRef.current = { dragId: node.id, parentId: tNode.parentId, axis, nodeW, nodeH, slots };
  }, [dir]);

  const onNodeDrag = useCallback((_: React.MouseEvent, node: Node) => {
    const startPos = dragStartRef.current.get(node.id);
    if (!startPos) return;
    const dx = node.position.x - startPos.x;
    const dy = node.position.y - startPos.y;

    const descs = descendants(treeRef.current, node.id);
    const posUpdates = new Map<string, { x: number; y: number }>();

    // Move descendants with parent
    for (const desc of descs) {
      const orig = dragStartRef.current.get(desc);
      if (orig) posUpdates.set(desc, { x: orig.x + dx, y: orig.y + dy });
    }

    // Auto-mode: shift siblings to make way
    if (layoutMode === 'auto' && dragOrderRef.current?.dragId === node.id) {
      const { axis, slots, nodeW, nodeH } = dragOrderRef.current;
      const dragPos   = axis === 'y' ? node.position.y + nodeH / 2 : node.position.x + nodeW / 2;
      const others    = slots.filter(s => s.id !== node.id);
      const slotPoss  = slots.map(s => s.pos);
      const insertIdx = calcInsertIdx(others.map(s => s.pos), dragPos);

      others.forEach((s, k) => {
        const targetSlot  = k < insertIdx ? k : k + 1;
        const centerCoord = slotPoss[Math.min(targetSlot, slotPoss.length - 1)];
        posUpdates.set(s.id, {
          x: axis === 'y' ? s.origX : centerCoord - nodeW / 2,
          y: axis === 'y' ? centerCoord - nodeH / 2 : s.origY,
        });
      });
    }

    if (posUpdates.size > 0) {
      setRfNodes(prev => prev.map(n => {
        const upd = posUpdates.get(n.id);
        if (!upd) return n;
        // 保留所有 React Flow 内部属性（internals, measured 等），只更新 position
        return { ...n, position: upd };
      }));
    }
  }, [layoutMode, setRfNodes]);

  // ── Drag stop: finalise sibling order ──────────────────────────
  const onNodeDragStop = useCallback((_: React.MouseEvent, node: Node) => {
    isDraggingRef.current = false;
    
    // 若拖移了根节点，记录其新位置作为后续布局锚点
    const rootId = treeRef.current.find(n => !n.parentId)?.id;
    if (rootId && node.id === rootId) {
      rootPosRef.current = { x: node.position.x, y: node.position.y };
    }

    const ord = dragOrderRef.current;
    if (!ord || ord.dragId !== node.id) { dragOrderRef.current = null; return; }

    const { parentId, axis, slots, nodeW, nodeH } = ord;
    // position 是左上角，加半高/半宽取中心
    const dragPos  = axis === 'y' ? node.position.y + nodeH / 2 : node.position.x + nodeW / 2;
    const others   = slots.filter(s => s.id !== node.id);
    const insertIdx = calcInsertIdx(others.map(s => s.pos), dragPos);

    const newOrder = [
      ...others.slice(0, insertIdx).map(s => s.id),
      node.id,
      ...others.slice(insertIdx).map(s => s.id),
    ];

    // Apply new order to tree
    setTree(prev => {
      const next = reorderSiblings(prev, parentId, newOrder);
      treeRef.current = next;
      return next;
    });

    dragOrderRef.current = null;

    if (layoutMode === 'auto') {
      setLayoutVersion(v => v + 1); // re-layout with new order
    }
    
    // 拖拽结束后，如果有待处理的高度变化，触发一次布局重算
    requestAnimationFrame(() => {
      if (heightRelayoutRaf.current !== null) {
        cancelAnimationFrame(heightRelayoutRaf.current);
        heightRelayoutRaf.current = null;
      }
      setLayoutVersion(v => v + 1);
    });
  }, [layoutMode]);

  // Load
  useEffect(() => {
    if (!id) { setLoading(false); return; }
    (async () => {
      let spaceId: string | null = null;
      try {
        const mm = await getMindMapById(id);
        spaceId = mm.space_id;
        setMindMap(mm);
        setTree(prev => { const next = setLabel(prev, 'root', mm.name); treeRef.current = next; return next; });
        setRfNodes(prev => prev.map(n =>
          n.id === 'root' ? { ...n, data: { ...n.data as NodeData, label: mm.name } } : n
        ));
      } catch (e) {
        console.error('getMindMapById failed:', e);
        // Fallback: get space_id from current session
        try {
          const space = await getCurrentSpaceInfo();
          spaceId = space?.id ?? null;
        } catch { /* ignore */ }
      }
      // Fetch members regardless of whether mind map load succeeded
      if (spaceId) {
        try { CB.members = await getSpaceMembers(spaceId); }
        catch (e) { console.error('getSpaceMembers failed:', e); }
      }
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    const fn = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fn);
    return () => document.removeEventListener('fullscreenchange', fn);
  }, []);

  // Structural helpers
  /** 自由模式下将新节点插入 rfNodes/rfEdges，无需全量重排 */
  const freeInsertNode = useCallback((newId: string, next: MindTreeNode[]) => {
    const d  = getDepth(next, newId);
    const nw = NODE_W[d] ?? TASK_W;
    const nh = NODE_H[d] ?? TASK_H;
    const { target: tPos, source: sPos } = HANDLE_POS[dir];
    const parentId = next.find(n => n.id === newId)?.parentId;

    // 在已有同级节点末尾之后放置；若找不到则放在父节点旁边
    const siblings = parentId
      ? rfNodesRef.current.filter(n => next.find(t => t.id === n.id)?.parentId === parentId)
      : [];
    const lastSib = siblings.length
      ? siblings.reduce((a, b) => (a.position.y > b.position.y ? a : b))
      : null;
    const parentNode = parentId ? rfNodesRef.current.find(n => n.id === parentId) : null;

    let posX: number, posY: number;
    if (lastSib) {
      // position 是左上角：同级节点同一列，新节点紧接 lastSib 下方
      posX = lastSib.position.x;
      posY = lastSib.position.y + nh + LR_V_GAP;
    } else if (parentNode) {
      const parentDepth = getDepth(next, parentId!);
      const pw = NODE_W[parentDepth] ?? TASK_W;
      const ph = NODE_H[parentDepth] ?? TASK_H;
      // 新节点左上角：父节点右边缘 + H_GAP；Y 与父节点中心对齐（等高时 = 同 top）
      posX = parentNode.position.x + pw + LR_H_GAP;
      posY = parentNode.position.y + ph / 2 - nh / 2;
    } else {
      posX = 200; posY = 0;
    }

    setRfNodes(prev => [
      ...prev.map(n => ({ ...n, selected: false })),
      {
        id: newId, type: 'mindnode',
        position: { x: posX, y: posY },
        width: nw, height: nh,
        selected: true, draggable: true,
        data: { label: '', depth: d, collapsed: false, hasKids: false, childCount: 0,
                targetPos: tPos, sourcePos: sPos, isEditing: false },
      },
    ]);
    if (parentId) {
      setRfEdges(prev => [
        ...prev,
        { id: `e-${parentId}-${newId}`, source: parentId, target: newId,
          type: 'mindedge', data: { dir }, style: { stroke: '#C5C9D6', strokeWidth: 1.5 } },
      ]);
    }
  }, [dir, setRfNodes, setRfEdges]);

  const doAddSibling = useCallback(() => {
    const [next, newId] = addSibling(treeRef.current, selectedId);
    treeRef.current = next;
    setTree(next);
    setSelectedId(newId);
    if (layoutMode === 'auto') {
      setLayoutVersion(v => v + 1);
    } else {
      freeInsertNode(newId, next);
    }
    setTimeout(() => setEditingId(newId), 80);
  }, [selectedId, layoutMode, freeInsertNode]);

  const doAddChild = useCallback(() => {
    const [next, newId] = addChild(treeRef.current, selectedId);
    treeRef.current = next;
    setTree(next);
    setSelectedId(newId);
    if (layoutMode === 'auto') {
      setLayoutVersion(v => v + 1);
    } else {
      freeInsertNode(newId, next);
    }
    setTimeout(() => setEditingId(newId), 80);
  }, [selectedId, layoutMode, freeInsertNode]);

  const doDelete = useCallback(() => {
    const [next, newSel] = removeNode(treeRef.current, selectedId);
    treeRef.current = next;
    setTree(next);
    if (newSel) setSelectedId(newSel);
    if (layoutMode === 'auto') {
      setLayoutVersion(v => v + 1);
    } else {
      // 自由模式：直接从 rfNodes/rfEdges 移除已删节点及其子树
      const removed = new Set([selectedId, ...descendants(next, selectedId)]);
      setRfNodes(prev => prev.filter(n => !removed.has(n.id)));
      setRfEdges(prev => prev.filter(e => !removed.has(e.source) && !removed.has(e.target)));
    }
  }, [selectedId, layoutMode]);

  // Keyboard
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isMac = /mac/i.test(navigator.platform);
    const mod   = isMac ? e.metaKey : e.ctrlKey;
    const tgt   = e.target as HTMLElement;
    if (tgt.tagName === 'INPUT' && !tgt.classList.contains('mm-node__input')) return;
    if (tgt.tagName === 'TEXTAREA') return;
    if (editingId && tgt.classList.contains('mm-node__input')) return;

    if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
      e.preventDefault(); setShowSearch(true); setTimeout(() => searchRef.current?.focus(), 50); return;
    }
    if (mod && e.altKey && e.key.toLowerCase() === 'f') { e.preventDefault(); handleFullscreen(); return; }
    if (mod && e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); handleExport(); return; }
    if (mod && e.key.toLowerCase() === 'a' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      const allIds = new Set(treeRef.current.map(n => n.id));
      setSelectedIds(allIds);
      if (allIds.size > 0) {
        setSelectedId(Array.from(allIds)[allIds.size - 1]);
      }
      // 同步到 React Flow 的选中状态
      setRfNodes(prev => prev.map(n => ({ ...n, selected: allIds.has(n.id) })));
      return;
    }
    if (mod && e.key === '/') {
      e.preventDefault();
      if (selectedId) {
        setTree(prev => { const next = toggleCollapse(prev, selectedId); treeRef.current = next; return next; });
        setLayoutVersion(v => v + 1);
      }
      return;
    }
    if (mod && e.key.toLowerCase() === 'c' && !e.shiftKey) {
      const descs   = descendants(treeRef.current, selectedId);
      const subtree = treeRef.current.filter(n => n.id === selectedId || descs.includes(n.id));
      setClipboard(subtree); return;
    }
    if (mod && e.key.toLowerCase() === 'v' && !e.shiftKey) {
      // Text 模式：支持粘贴多行文本，根据缩进创建节点
      if (dir === 'Text') {
        e.preventDefault();
        navigator.clipboard.readText().then(text => {
          if (!text) return;
          const lines = text.split(/\r?\n/);
          
          // 多选模式：每个选中节点粘贴一行文本（忽略空行）
          if (selectedIds.size > 1) {
            const selectedArray = Array.from(selectedIds);
            const nonEmptyLines = lines.filter(line => line.trim());
            const newNodes: MindTreeNode[] = [];
            
            selectedArray.forEach((nodeId, index) => {
              if (index >= nonEmptyLines.length) return;
              const line = nonEmptyLines[index].trim();
              if (!line) return;
              
              const selectedNode = treeRef.current.find(n => n.id === nodeId);
              if (!selectedNode || selectedNode.parentId === null) return;
              
              const newNode: MindTreeNode = {
                id: uid(),
                label: line,
                parentId: selectedNode.parentId,
                collapsed: false,
              };
              newNodes.push(newNode);
            });
            
            if (newNodes.length > 0) {
              setTree(prev => { const next = [...prev, ...newNodes]; treeRef.current = next; return next; });
              setLayoutVersion(v => v + 1);
            }
            return;
          }
          
          // 单选模式：根据缩进创建节点树
          if (!selectedId) return;
          const nonEmptyLines = lines.filter(line => line.trim());
          if (nonEmptyLines.length === 0) return;
          
          // 解析缩进层级（支持空格和制表符）
          const parseIndent = (line: string): number => {
            let indent = 0;
            for (let i = 0; i < line.length; i++) {
              if (line[i] === ' ') indent++;
              else if (line[i] === '\t') indent += 2; // 制表符算作 2 个空格
              else break;
            }
            return Math.floor(indent / 2); // 每 2 个空格算一级
          };
          
          const selectedNode = treeRef.current.find(n => n.id === selectedId);
          if (!selectedNode) return;
          
          // 构建节点树
          const newNodes: MindTreeNode[] = [];
          const stack: Array<{ id: string; depth: number }> = [{ id: selectedId, depth: getDepth(treeRef.current, selectedId) }];
          
          for (const line of nonEmptyLines) {
            const indent = parseIndent(line);
            const label = line.trim();
            if (!label) continue;
            
            // 找到合适的父节点
            while (stack.length > 0 && stack[stack.length - 1].depth >= indent) {
              stack.pop();
            }
            const parent = stack[stack.length - 1];
            if (!parent) continue;
            
            const newNode: MindTreeNode = {
              id: uid(),
              label,
              parentId: parent.id,
              collapsed: false,
            };
            newNodes.push(newNode);
            stack.push({ id: newNode.id, depth: indent });
          }
          
          if (newNodes.length > 0) {
            setTree(prev => { const next = [...prev, ...newNodes]; treeRef.current = next; return next; });
            setLayoutVersion(v => v + 1);
          }
        }).catch(() => {});
        return;
      }
      
      // 其他模式：粘贴剪贴板中的节点树
      if (!clipboard || !selectedId) return;
      e.preventDefault();
      const idMap = new Map<string, string>();
      clipboard.forEach(n => idMap.set(n.id, uid()));
      const root0 = clipboard[0];
      const reId  = clipboard.map(n => ({
        ...n, id: idMap.get(n.id)!,
        parentId: n.id === root0.id ? selectedId : (idMap.get(n.parentId || '') || null), collapsed: false,
      }));
      setTree(prev => { const next = [...prev, ...reId]; treeRef.current = next; return next; });
      setLayoutVersion(v => v + 1); return;
    }
    if (!selectedId) return;
    if (e.key === 'Enter' && !mod && !e.shiftKey) { e.preventDefault(); doAddSibling(); return; }
    if (e.key === 'Tab')                           { e.preventDefault(); doAddChild();   return; }
    if (e.key === 'Delete' || e.key === 'Backspace'){ e.preventDefault(); doDelete();    return; }
    if (e.key === ' ')                             { e.preventDefault(); setEditingId(selectedId); return; }

    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation(); // 捕获阶段拦截，防止 React Flow 内置键盘移动节点
      const cur  = treeRef.current;
      const sel  = cur.find(n => n.id === selectedId);
      if (!sel) return;
      const kids = childIds(cur, selectedId);
      const sibs = orderedSiblings(cur, selectedId);
      const sIdx = sibs.indexOf(selectedId);
      let tp: string, tc: string, tprev: string, tnext: string;
      if      (dir === 'LR') { tp='ArrowLeft';  tc='ArrowRight'; tprev='ArrowUp';   tnext='ArrowDown'; }
      else if (dir === 'RL') { tp='ArrowRight'; tc='ArrowLeft';  tprev='ArrowUp';   tnext='ArrowDown'; }
      else if (dir === 'TB') { tp='ArrowUp';    tc='ArrowDown';  tprev='ArrowLeft'; tnext='ArrowRight'; }
      else                   { tp='ArrowDown';  tc='ArrowUp';    tprev='ArrowLeft'; tnext='ArrowRight'; }
      let nextId: string | undefined;
      if (e.key === tp    && sel.parentId)               nextId = sel.parentId;
      if (e.key === tc    && kids.length && !sel.collapsed) nextId = kids[0];
      if (e.key === tprev && sIdx > 0)                   nextId = sibs[sIdx - 1];
      if (e.key === tnext && sIdx < sibs.length - 1)     nextId = sibs[sIdx + 1];
      if (nextId && rfNodesRef.current.find(n => n.id === nextId)) setSelectedId(nextId);
    }
  }, [selectedId, editingId, dir, clipboard, doAddSibling, doAddChild, doDelete]);

  useEffect(() => {
    // 用捕获阶段确保在 React Flow 内部处理器之前拦截键盘事件
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(treeRef.current, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob), download: `${mindMap?.name || 'mindmap'}.json`,
    });
    a.click(); URL.revokeObjectURL(a.href);
  }, [mindMap]);

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  }, []);

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const q = searchTerm.toLowerCase();
    return treeRef.current.filter(n => n.label.toLowerCase().includes(q));
  }, [searchTerm, tree]);

  if (loading) return <div className="mindmap-editor-page"><div className="mindmap-loading">Loading...</div></div>;
  if (!mindMap) return (
    <div className="mindmap-editor-page">
      <div className="mindmap-loading">Mind map not found.</div>
      <button onClick={() => navigate('/project-map')}>返回</button>
    </div>
  );

  return (
    <div className="mindmap-editor-page" ref={containerRef} tabIndex={-1}>
      {/* Toolbar */}
      <div className="mindmap-toolbar">
        <button className="btn-back" onClick={() => navigate('/project-map')}><ArrowLeft size={14} /> 返回</button>
        <h2 className="mindmap-title">{mindMap.name}</h2>
        <div className="mm-dir-group">
          {DIR_LABELS.map(d => (
            <button key={d.value} className={`mm-dir-btn${dir === d.value ? ' active' : ''}`}
              onClick={() => handleDirChange(d.value)}>{d.label}
            </button>
          ))}
        </div>
        <button
          className={`mm-mode-btn${layoutMode === 'auto' ? ' active' : ''}`}
          onClick={() => {
            const next = layoutMode === 'auto' ? 'free' : 'auto';
            setLayoutMode(next);
            if (next === 'auto') setLayoutVersion(v => v + 1); // snap back to grid
          }}
          title={layoutMode === 'auto' ? '当前：自动整理模式（点击切换为自由画布）' : '当前：自由画布模式（点击切换为自动整理）'}
        >
          {layoutMode === 'auto'
            ? <><LayoutGrid size={13} /> 自动整理</>
            : <><Move size={13} /> 自由画布</>}
        </button>

        <div className="mindmap-toolbar-actions">
          <button className="btn-tool" onClick={doAddChild} title="Tab"><Plus size={14} /> 添加节点</button>
          <button className="btn-tool btn-tool--icon" onClick={() => { setShowSearch(true); setTimeout(() => searchRef.current?.focus(), 50); }} title="Ctrl+F"><Search size={14} /></button>
          <button className="btn-tool btn-tool--icon" onClick={handleExport} title="Shift+Ctrl+S"><Download size={14} /></button>
          <button className="btn-tool btn-tool--icon" onClick={handleFullscreen} title="Alt+Ctrl+F">
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button className="btn-tool btn-tool--icon" onClick={() => setShowShortcuts(v => !v)} title="快捷键"><Keyboard size={14} /></button>
        </div>
      </div>

      {/* Canvas / Text Editor */}
      <div className="mindmap-main">
        {dir === 'Text' && (
        <div className="mindmap-text-editor-container">
          {/* 装饰层：单层 SVG 绘制 L 形连线和圆点，与 textarea 坐标一致 */}
          <div ref={textDecorationRef} className="mindmap-text-decoration" aria-hidden="true">
            <svg
              className="mindmap-text-decoration-svg"
              viewBox={textDecorationSvg.viewBox}
              preserveAspectRatio="none"
            >
              <defs>
                <circle id="mm-text-dot-shape" r="4" fill="#7B7EFF" />
              </defs>
              {/* L 形连线 */}
              {textDecorationSvg.paths.map((d, i) => (
                <path key={`p-${i}`} d={d} fill="none" stroke="rgba(123, 126, 255, 0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {/* 圆点 */}
              {textDecorationSvg.dots.map((dot, i) => (
                <use key={`d-${i}`} href="#mm-text-dot-shape" x={dot.cx - 4} y={dot.cy - 4} />
              ))}
            </svg>
          </div>
          <textarea
            ref={textEditorRef}
            className="mindmap-text-editor"
            value={textContent}
            onChange={(e) => {
              const val = e.target.value;
              const cursor = e.target.selectionStart ?? val.length;
              handleTextChange(val);
              
              // 检测 @ 和 # 的自动完成
              if ((e.nativeEvent as InputEvent).isComposing) return;
              let ma = findMentionAnchor(val, cursor);
              if (ma && ma.query.trim() !== '') {
                const q = ma.query.toLowerCase();
                const hasMatch = CB.members.some(m => {
                  const text = (m.name || m.email).toLowerCase();
                  let qi = 0;
                  for (let i = 0; i < text.length && qi < q.length; i++) {
                    if (text[i] === q[qi]) qi++;
                  }
                  return qi === q.length;
                });
                if (!hasMatch) ma = null;
              }
              const da = !ma ? findDateAnchor(val, cursor) : null;
              setTextMention(ma);
              setTextDatePick(!!da);
              // 当 mention 查询变化时，重置选中索引
              if (ma && ma.query !== textMention?.query) {
                setTextMentionIdx(0);
              }
            }}
            onKeyDown={(e) => {
              const textarea = e.currentTarget;
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const value = textarea.value;
              
              // 如果成员选单或日期选择器打开，优先处理它们的键盘事件
              if (textMention) {
                const filteredMembers = CB.members.filter(m => {
                  const text = (m.name || m.email).toLowerCase();
                  const q = textMention.query.toLowerCase();
                  let qi = 0;
                  for (let i = 0; i < text.length && qi < q.length; i++) {
                    if (text[i] === q[qi]) qi++;
                  }
                  return qi === q.length;
                });
                
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setTextMentionIdx(prev => Math.min(prev + 1, filteredMembers.length - 1));
                  // 滚动到选中项
                  setTimeout(() => {
                    const active = textMentionListRef.current?.querySelector<HTMLElement>('.mm-dropdown-item--active');
                    active?.scrollIntoView({ block: 'nearest' });
                  }, 0);
                  return;
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setTextMentionIdx(prev => Math.max(prev - 1, 0));
                  // 滚动到选中项
                  setTimeout(() => {
                    const active = textMentionListRef.current?.querySelector<HTMLElement>('.mm-dropdown-item--active');
                    active?.scrollIntoView({ block: 'nearest' });
                  }, 0);
                  return;
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredMembers.length > 0 && filteredMembers[textMentionIdx]) {
                    const m = filteredMembers[textMentionIdx];
                    const name = m.name || m.email.split('@')[0];
                    const before = textContent.slice(0, textMention.start);
                    const after = textContent.slice(textMention.start + 1 + textMention.query.length);
                    const newText = `${before}@${name} ${after}`;
                    handleTextChange(newText);
                    setTextMention(null);
                    setTextMentionIdx(0);
                    setTimeout(() => {
                      const newPos = textMention.start + 1 + name.length + 1;
                      textEditorRef.current?.setSelectionRange(newPos, newPos);
                      textEditorRef.current?.focus();
                    }, 0);
                  }
                  return;
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setTextMention(null);
                  setTextMentionIdx(0);
                  return;
                }
              }
              
              if (textDatePick) {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  // 日期选择器不需要上下键导航，但需要阻止文本编辑器处理
                  return;
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setTextDatePick(false);
                  return;
                }
              }
              
              if (e.key === 'Tab') {
                e.preventDefault();
                if (e.shiftKey) {
                  // Shift+Tab: 减少一级缩进
                  const lines = value.split('\n');
                  const lineStart = value.substring(0, start).lastIndexOf('\n') + 1;
                  const lineEnd = value.indexOf('\n', start);
                  const lineIdx = value.substring(0, lineStart).split('\n').length - 1;
                  
                  if (lineIdx < lines.length) {
                    const line = lines[lineIdx];
                    if (line.startsWith('  ')) {
                      const newLine = line.substring(2);
                      lines[lineIdx] = newLine;
                      const newValue = lines.join('\n');
                      const newStart = Math.max(0, start - 2);
                      const newEnd = Math.max(0, end - 2);
                      handleTextChange(newValue);
                      setTimeout(() => {
                        textarea.setSelectionRange(newStart, newEnd);
                      }, 0);
                    } else if (line.startsWith('\t')) {
                      const newLine = line.substring(1);
                      lines[lineIdx] = newLine;
                      const newValue = lines.join('\n');
                      const newStart = Math.max(0, start - 1);
                      const newEnd = Math.max(0, end - 1);
                      handleTextChange(newValue);
                      setTimeout(() => {
                        textarea.setSelectionRange(newStart, newEnd);
                      }, 0);
                    }
                  }
                } else {
                  // Tab: 增加一级缩进（2 个空格）
                  const lines = value.split('\n');
                  const lineStart = value.substring(0, start).lastIndexOf('\n') + 1;
                  const lineIdx = value.substring(0, lineStart).split('\n').length - 1;
                  
                  if (lineIdx < lines.length) {
                    lines[lineIdx] = '  ' + lines[lineIdx];
                    const newValue = lines.join('\n');
                    const newStart = start + 2;
                    const newEnd = end + 2;
                    handleTextChange(newValue);
                    setTimeout(() => {
                      textarea.setSelectionRange(newStart, newEnd);
                    }, 0);
                  }
                }
              } else if (e.key === 'Enter' && !e.shiftKey) {
                // Enter: 换行，保持当前行的缩进
                e.preventDefault();
                const lineStart = value.substring(0, start).lastIndexOf('\n') + 1;
                const currentLine = value.substring(lineStart, start);
                const indentMatch = currentLine.match(/^(\s*)/);
                const indent = indentMatch ? indentMatch[1] : '';
                const newValue = value.substring(0, start) + '\n' + indent + value.substring(end);
                const newStart = start + 1 + indent.length;
                handleTextChange(newValue);
                setTimeout(() => {
                  textarea.setSelectionRange(newStart, newStart);
                }, 0);
              }
            }}
            placeholder="输入文本，使用 Tab 缩进，Shift+Tab 减少缩进..."
            spellCheck={false}
          />
          
          {/* @ 成员选择下拉 */}
          {textMention && (
            <div className="mm-dropdown" style={{ position: 'fixed', top: textEditorRef.current ? textEditorRef.current.getBoundingClientRect().top + 20 : 0, left: textEditorRef.current ? textEditorRef.current.getBoundingClientRect().left : 0, zIndex: 99999 }}>
              <div ref={textMentionListRef} className="mm-dropdown-list">
                {CB.members.filter(m => {
                  const text = (m.name || m.email).toLowerCase();
                  const q = textMention.query.toLowerCase();
                  let qi = 0;
                  for (let i = 0; i < text.length && qi < q.length; i++) {
                    if (text[i] === q[qi]) qi++;
                  }
                  return qi === q.length;
                }).map((m, i) => (
                  <div
                    key={m.id}
                    className={`mm-dropdown-item${i === textMentionIdx ? ' mm-dropdown-item--active' : ''}`}
                    onClick={() => {
                      const name = m.name || m.email.split('@')[0];
                      const before = textContent.slice(0, textMention.start);
                      const after = textContent.slice(textMention.start + 1 + textMention.query.length);
                      const newText = `${before}@${name} ${after}`;
                      handleTextChange(newText);
                      setTextMention(null);
                      setTimeout(() => {
                        const newPos = textMention.start + 1 + name.length + 1;
                        textEditorRef.current?.setSelectionRange(newPos, newPos);
                        textEditorRef.current?.focus();
                      }, 0);
                    }}
                  >
                    {m.name || m.email}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* # 日期选择 */}
          {textDatePick && (
            <div className="mm-dropdown" style={{ position: 'fixed', top: textEditorRef.current ? textEditorRef.current.getBoundingClientRect().top + 20 : 0, left: textEditorRef.current ? textEditorRef.current.getBoundingClientRect().left : 0, zIndex: 99999 }}>
              <input
                ref={textDateInputRef}
                type="datetime-local"
                className="mm-date-input"
                onBlur={() => {
                  const val = textDateInputRef.current?.value;
                  if (val) {
                    const dt = new Date(val);
                    const pad = (n: number) => String(n).padStart(2, '0');
                    const fmt = `${dt.getFullYear()}/${pad(dt.getMonth()+1)}/${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
                    const anchor = findDateAnchor(textContent, textContent.length);
                    const start = anchor ? anchor.start : textContent.lastIndexOf('#');
                    if (start >= 0) {
                      const before = textContent.slice(0, start);
                      const rest = textContent.slice(start + 1).replace(/^[^@#]*/, '');
                      const newText = `${before}#${fmt} ${rest}`.trimEnd();
                      handleTextChange(newText);
                    }
                  }
                  setTextDatePick(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    textDateInputRef.current?.blur();
                  }
                }}
                autoFocus
              />
            </div>
          )}
        </div>
        )}

        {/* React Flow 画布始终挂载，仅通过样式隐藏，避免卸载时 removeChild 异常 */}
        <div className={`mindmap-flow-container${isExpanding ? ' mm-expanding' : ''}${dir === 'Text' ? ' mindmap-flow-container--hidden' : ''}`}>
          <ReactFlow
          nodes={rfNodes} edges={rfEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={onRfEdgesChange}
          onNodeClick={(e, n) => {
            if (editingId) return;
            const isMac = /mac/i.test(navigator.platform);
            const mod = isMac ? e.metaKey : e.ctrlKey;
            const shift = e.shiftKey;
            
            if (mod || shift) {
              // Ctrl/Cmd+Click 或 Shift+Click：多选
              setSelectedIds(prev => {
                const next = new Set(prev);
                if (next.has(n.id)) {
                  next.delete(n.id);
                } else {
                  next.add(n.id);
                }
                if (next.size > 0) {
                  setSelectedId(Array.from(next)[next.size - 1]); // 最后一个作为主选中
                }
                return next;
              });
            } else {
              // 普通点击：单选
              setSelectedId(n.id);
              setSelectedIds(new Set([n.id]));
            }
          }}
          onSelectionChange={(params) => {
            // React Flow 的多选框选择
            if (params.nodes.length > 0) {
              const ids = new Set(params.nodes.map(n => n.id));
              setSelectedIds(ids);
              if (ids.size > 0) {
                setSelectedId(Array.from(ids)[ids.size - 1]);
              }
            }
          }}
          multiSelectionKeyCode={['Meta', 'Control']}
          selectionOnDrag
          onNodeDragStart={onNodeDragStart}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          minZoom={ZOOM_MIN} maxZoom={ZOOM_MAX}
          deleteKeyCode={null}
          nodesFocusable={false}
        >
          <MiniMap nodeColor={n => (n.data as NodeData).depth === 0 ? '#6C5CE7' : '#94a3b8'} maskColor="rgba(236,239,241,0.6)" />
          <ZoomRuler />
        </ReactFlow>
        </div>
      </div>

      {/* Hint */}
      <div className="mindmap-hint">
        双击/Space 编辑 · Enter 兄弟 · Tab 子节点 · Delete 删除 · 方向键导航 · Ctrl+/ 折叠
        <span className="mm-hint-sep">·</span>
        <span className="mm-hint-tag">任务</span>
        <kbd>@</kbd> 成员 <kbd>#</kbd> 截止时间
      </div>

      {/* Search modal */}
      {showSearch && (
        <div className="mm-overlay" onClick={() => { setShowSearch(false); setSearchTerm(''); }}>
          <div className="mm-modal" onClick={e => e.stopPropagation()}>
            <div className="mm-modal-header">
              <Search size={14} />
              <input ref={searchRef} className="mm-search-input" placeholder="搜索节点..."
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setShowSearch(false); setSearchTerm(''); }
                  if (e.key === 'Enter' && searchResults.length) { setSelectedId(searchResults[0].id); setShowSearch(false); setSearchTerm(''); }
                }} />
              <button className="mm-modal-close" onClick={() => { setShowSearch(false); setSearchTerm(''); }}><X size={13} /></button>
            </div>
            <div className="mm-modal-body">
              {searchResults.length === 0 && searchTerm && <div className="mm-empty">未找到节点</div>}
              {searchResults.map(n => (
                <button key={n.id} className="mm-list-item" onClick={() => { setSelectedId(n.id); setShowSearch(false); setSearchTerm(''); }}>{n.label}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Shortcuts modal */}
      {showShortcuts && (
        <div className="mm-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="mm-modal mm-shortcuts" onClick={e => e.stopPropagation()}>
            <div className="mm-modal-header"><Keyboard size={14} /> 快捷键
              <button className="mm-modal-close" onClick={() => setShowShortcuts(false)}><X size={13} /></button>
            </div>
            <table className="mm-sc-table"><tbody>
              {[['节点','Enter','插入兄弟节点'],['节点','Tab','插入子节点'],['节点','Delete','删除节点'],
                ['节点','↑↓←→','节点导航'],['节点','Ctrl+/','展开/折叠'],['节点','Space','编辑节点'],
                ['节点','Ctrl+C','复制（含子树）'],['节点','Ctrl+V','粘贴'],
                ['任务','@','指派成员'],['任务','#','设置截止时间'],
                ['操作','Ctrl+F','搜索'],['操作','Alt+Ctrl+F','全屏'],['操作','Shift+Ctrl+S','导出'],
              ].map(([cat,key,desc],i) => (
                <tr key={i}><td className="mm-sc-cat">{cat}</td><td className="mm-sc-key"><kbd>{key}</kbd></td><td className="mm-sc-desc">{desc}</td></tr>
              ))}
            </tbody></table>
          </div>
        </div>
      )}
    </div>
  );
}
