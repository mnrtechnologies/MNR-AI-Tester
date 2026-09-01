import React, { useCallback, useRef, useState } from 'react';
import { Upload, FileArchive, Folder, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiUpload } from '../api';
import {
  MAX_MB, MAX_FILES, collectFromInput, collectFromDrop, totalBytes, zipEntries,
} from '../folderZip';

const ACCEPTED = ['.zip', '.tar.gz', '.tgz'];
const looksLikeArchive = (n = '') => ACCEPTED.some((e) => n.toLowerCase().endsWith(e));

const fmtSize = (bytes) =>
  bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Upload a codebase from the user's machine — either a folder chosen
 * directly, or an archive they already have.
 *
 * A folder is packed into a zip in the browser (see ../folderZip.js) so both
 * routes hit the same server endpoint, and so the archive's hash still keys
 * the resume cache. Folders are listed first because that is what people
 * actually have on disk; asking them to zip first is a chore invented by the
 * software.
 */
export default function UploadCode({ onIndexed }) {
  const [file, setFile] = useState(null);      // the archive to send
  const [picked, setPicked] = useState(null);  // {kind, label, fileCount, bytes}
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('');
  const [pct, setPct] = useState(0);
  const [dragging, setDragging] = useState(false);

  const folderRef = useRef(null);
  const zipRef = useRef(null);

  const reset = () => { setFile(null); setPicked(null); setPct(0); setPhase(''); };

  const acceptArchive = useCallback((f) => {
    if (!looksLikeArchive(f.name)) {
      toast.error('Upload a .zip or .tar.gz, or choose a folder instead.');
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`That file is ${fmtSize(f.size)} — the limit is ${MAX_MB}MB.`);
      return;
    }
    setFile(f);
    setPicked({ kind: 'archive', label: f.name, bytes: f.size });
    setName((n) => n || f.name.replace(/\.(zip|tar\.gz|tgz)$/i, ''));
  }, []);

  const acceptFolder = useCallback(async (entries, folderName) => {
    if (!entries.length) {
      toast.error('That folder has no files in it.');
      return;
    }
    if (entries.length > MAX_FILES) {
      toast.error(`That folder has ${entries.length.toLocaleString()} files — the limit is ${MAX_FILES.toLocaleString()}.`);
      return;
    }
    const bytes = totalBytes(entries);
    if (bytes > MAX_MB * 1024 * 1024) {
      toast.error(`That folder is ${fmtSize(bytes)} — the limit is ${MAX_MB}MB.`);
      return;
    }

    setBusy(true);
    setPhase('packing');
    setPct(0);
    try {
      const blob = await zipEntries(entries, setPct);
      const zipped = new File([blob], `${folderName || 'project'}.zip`, { type: 'application/zip' });
      setFile(zipped);
      setPicked({ kind: 'folder', label: folderName || 'Selected folder', fileCount: entries.length, bytes: zipped.size });
      setName((n) => n || folderName || '');
    } catch (err) {
      toast.error(`Could not read that folder: ${err.message}`);
    } finally {
      setBusy(false);
      setPhase('');
      setPct(0);
    }
  }, []);

  const onFolderInput = (e) => {
    const list = e.target.files;
    if (!list?.length) return;
    const root = list[0].webkitRelativePath?.split('/')[0] || '';
    acceptFolder(collectFromInput(list), root);
    e.target.value = '';
  };

  const onDrop = async (e) => {
    e.preventDefault();
    setDragging(false);
    if (busy) return;

    // A dropped FOLDER is only reachable through the entry API;
    // dataTransfer.files is empty or useless for one.
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && looksLikeArchive(dropped.name)) {
      acceptArchive(dropped);
      return;
    }
    try {
      const entries = await collectFromDrop(e.dataTransfer);
      if (entries?.length) {
        const item = e.dataTransfer.items?.[0]?.webkitGetAsEntry?.();
        acceptFolder(entries, item?.name || '');
        return;
      }
    } catch {
      /* fall through to the message below */
    }
    if (dropped) acceptArchive(dropped);
    else toast.error('Drop a project folder, or a .zip of one.');
  };

  const start = async () => {
    if (!file) return;
    setBusy(true);
    setPhase('uploading');
    setPct(0);
    try {
      const repo = await apiUpload(file, { name: name.trim() || undefined, onProgress: setPct });
      toast.success(`Indexed ${repo.fileCount} file${repo.fileCount === 1 ? '' : 's'}.`);
      onIndexed(repo);
    } catch (err) {
      toast.error(err.message || 'Upload failed.');
    } finally {
      setBusy(false);
      setPhase('');
    }
  };

  const packing = busy && phase === 'packing';

  return (
    <div className="bg-white border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Upload size={16} className="text-gray-700" />
        <h3 className="font-semibold text-gray-800">Upload code from your computer</h3>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        Pick your project folder directly — no GitHub account, no zipping first.
      </p>

      {!picked ? (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-xl p-7 text-center transition ${
              dragging ? 'border-gray-800 bg-gray-50' : 'border-gray-200'
            }`}
          >
            {packing ? (
              <>
                <Loader2 size={26} className="mx-auto text-gray-400 mb-2 animate-spin" />
                <p className="text-sm font-medium text-gray-700">Preparing your folder… {pct}%</p>
                <p className="text-[11px] text-gray-400 mt-1">Packing locally — nothing has been sent yet.</p>
              </>
            ) : (
              <>
                <Folder size={26} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-700 mb-3">
                  Drag your project folder here
                </p>
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => folderRef.current?.click()}
                    className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800"
                  >
                    <Folder size={14} /> Choose folder
                  </button>
                  <button
                    onClick={() => zipRef.current?.click()}
                    className="flex items-center gap-1.5 text-sm text-gray-600 border rounded-lg px-4 py-2 hover:bg-gray-50"
                  >
                    <FileArchive size={14} /> Choose .zip
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-3">
                  up to {MAX_MB}MB · node_modules, venv, .git and __pycache__ are skipped automatically
                </p>
              </>
            )}

            {/* webkitdirectory is the only way a browser exposes a folder.
                `directory` is the standards-track spelling; both are set so
                this keeps working as engines migrate. */}
            <input
              ref={folderRef}
              type="file"
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
              onChange={onFolderInput}
            />
            <input
              ref={zipRef}
              type="file"
              accept=".zip,.tar.gz,.tgz"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) acceptArchive(f); e.target.value = ''; }}
            />
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 border rounded-lg px-3 py-2.5">
            {picked.kind === 'folder'
              ? <Folder size={18} className="text-gray-400 shrink-0" />
              : <FileArchive size={18} className="text-gray-400 shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 truncate">{picked.label}</p>
              <p className="text-[11px] text-gray-400">
                {picked.kind === 'folder'
                  ? `${picked.fileCount.toLocaleString()} files · ${fmtSize(picked.bytes)} packed`
                  : fmtSize(picked.bytes)}
              </p>
            </div>
            {!busy && (
              <button onClick={reset} className="text-gray-300 hover:text-gray-600 shrink-0" aria-label="Remove">
                <X size={16} />
              </button>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Project name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              placeholder="my-project"
              className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-50"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Uploading the same project name again replaces it, keeping one entry in the sidebar.
            </p>
          </div>

          {busy && (
            <div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gray-800 transition-all duration-200" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">
                {pct < 100
                  ? `Uploading… ${pct}%`
                  : 'Unpacking and indexing — this can take a moment for a large project.'}
              </p>
            </div>
          )}

          <button
            onClick={start}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white font-medium py-2.5 rounded-lg hover:bg-gray-800 disabled:opacity-60"
          >
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
            {busy ? 'Working…' : 'Upload and index'}
          </button>
        </div>
      )}
    </div>
  );
}
