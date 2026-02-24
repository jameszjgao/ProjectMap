import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Folder,
  FileText,
  Plus,
  ChevronRight,
  ChevronDown,
  Settings,
  Trash2,
} from 'lucide-react';
import { getCurrentSpaceInfo, getCurrentUserInfo } from '../lib/auth-helper';
import {
  getFolders,
  getMindMapsInFolder,
  createFolder,
  createMindMap,
  deleteFolder,
  deleteMindMap,
  type Folder as FolderType,
  type MindMap as MindMapType,
} from '../lib/workmap';
import type { SpaceInfo } from '../lib/auth-helper';
import './ProjectMap.css';

export default function ProjectMap() {
  const navigate = useNavigate();
  const location = useLocation();
  const [space, setSpace] = useState<SpaceInfo | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [breadcrumb, setBreadcrumb] = useState<FolderType[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [mindMaps, setMindMaps] = useState<MindMapType[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showNewMap, setShowNewMap] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentFolderId = breadcrumb.length > 0 ? breadcrumb[breadcrumb.length - 1].id : null;

  // 进入项目地图页或从空间管理返回时拉取当前空间及内容
  useEffect(() => {
    if (location.pathname === '/project-map') {
      load();
    }
  }, [location.pathname]);

  // 监听空间切换事件，立即刷新列表
  useEffect(() => {
    const onSpaceChanged = () => load();
    window.addEventListener('space-changed', onSpaceChanged);
    return () => window.removeEventListener('space-changed', onSpaceChanged);
  }, []);

  useEffect(() => {
    if (space?.id) loadContent();
  }, [space?.id, currentFolderId]);

  async function load() {
    try {
      setLoading(true);
      const [spaceData, userData] = await Promise.all([
        getCurrentSpaceInfo(),
        getCurrentUserInfo(),
      ]);
      setSpace(spaceData || null);
      setUserId(userData?.id || null);
      if (!spaceData?.id) {
        setLoading(false);
        return;
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadContent() {
    if (!space?.id) return;
    try {
      setError(null);
      const [folderList, mapList] = await Promise.all([
        getFolders(space.id, currentFolderId),
        getMindMapsInFolder(space.id, currentFolderId),
      ]);
      setFolders(folderList);
      setMindMaps(mapList);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || String(e));
    }
  }

  const handleCreateFolder = async () => {
    if (!space?.id || !userId || !newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createFolder(space.id, newName.trim(), currentFolderId, userId);
      setNewName('');
      setShowNewFolder(false);
      loadContent();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateMindMap = async () => {
    if (!space?.id || !userId || !newName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const map = await createMindMap(space.id, newName.trim(), currentFolderId, userId);
      setNewName('');
      setShowNewMap(false);
      navigate(`/project-map/map/${map.id}`);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFolder = async (f: FolderType) => {
    if (!confirm(`Delete folder "${f.name}" and its contents?`)) return;
    setError(null);
    try {
      await deleteFolder(f.id);
      loadContent();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || String(e));
    }
  };

  const handleDeleteMindMap = async (m: MindMapType) => {
    if (!confirm(`Delete mind map "${m.name}"?`)) return;
    setError(null);
    try {
      await deleteMindMap(m.id);
      loadContent();
    } catch (e: any) {
      console.error(e);
      setError(e?.message || String(e));
    }
  };

  const goToFolder = (f: FolderType) => {
    setBreadcrumb((prev) => [...prev, f]);
    setExpandedFolders((prev) => new Set(prev).add(f.id));
  };

  const goUp = () => {
    setBreadcrumb((prev) => prev.slice(0, -1));
  };

  if (loading || !space) {
    return (
      <div className="project-map-page">
        <div className="project-map-loading">
          {loading ? 'Loading...' : 'Please select a space first.'}
        </div>
      </div>
    );
  }

  return (
    <div className="project-map-page">
      <header className="project-map-header">
        <h1>Project Map</h1>
        <p className="project-map-subtitle">Mind maps & folders · {space.name}</p>
      </header>

      {error && (
        <div className="project-map-error">
          <strong>Error:</strong> {error}
          <button type="button" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {!userId && (
        <div className="project-map-error">
          未获取到用户信息，请刷新页面或重新登录。
        </div>
      )}

      <div className="project-map-toolbar">
        <div className="breadcrumb">
          <button type="button" className="breadcrumb-item" onClick={() => setBreadcrumb([])}>
            Root
          </button>
          {breadcrumb.map((f) => (
            <span key={f.id} className="breadcrumb-sep">
              <ChevronRight size={14} />
              <button
                type="button"
                className="breadcrumb-item"
                onClick={() => setBreadcrumb((prev) => prev.slice(0, prev.indexOf(f) + 1))}
              >
                {f.name}
              </button>
            </span>
          ))}
        </div>
        <div className="toolbar-actions">
          <button
            type="button"
            className="btn-icon"
            onClick={() => { setShowNewFolder(true); setShowNewMap(false); }}
            title="New folder"
          >
            <Folder size={18} />
            <span>Folder</span>
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={() => { setShowNewMap(true); setShowNewFolder(false); }}
            title="New mind map"
          >
            <FileText size={18} />
            <span>Mind Map</span>
          </button>
        </div>
      </div>

      {(showNewFolder || showNewMap) && (
        <div className="new-item-form">
          <input
            type="text"
            placeholder={showNewFolder ? 'Folder name' : 'Mind map name'}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') showNewFolder ? handleCreateFolder() : handleCreateMindMap();
              if (e.key === 'Escape') { setShowNewFolder(false); setShowNewMap(false); setNewName(''); }
            }}
            autoFocus
          />
          <button type="button" onClick={showNewFolder ? handleCreateFolder : handleCreateMindMap} disabled={saving || !newName.trim()}>
            Create
          </button>
          <button type="button" onClick={() => { setShowNewFolder(false); setShowNewMap(false); setNewName(''); }}>
            Cancel
          </button>
        </div>
      )}

      <div className="project-map-content">
        {folders.map((f) => (
          <div key={f.id} className="item-row folder-row">
            <Folder size={20} className="item-icon" />
            <button type="button" className="item-name" onClick={() => goToFolder(f)}>
              {f.name}
            </button>
            <button
              type="button"
              className="item-action"
              onClick={() => handleDeleteFolder(f)}
              title="Delete folder"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {mindMaps.map((m) => (
          <div key={m.id} className="item-row map-row">
            <FileText size={20} className="item-icon" />
            <button
              type="button"
              className="item-name"
              onClick={() => navigate(`/project-map/map/${m.id}`)}
            >
              {m.name}
            </button>
            <button
              type="button"
              className="item-action"
              onClick={() => handleDeleteMindMap(m)}
              title="Delete mind map"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {folders.length === 0 && mindMaps.length === 0 && !showNewFolder && !showNewMap && (
          <div className="empty-state">
            <p>No folders or mind maps yet.</p>
            <p>Create a folder or mind map to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
