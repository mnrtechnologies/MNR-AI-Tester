import JSZip from 'jszip';

/**
 * Turning a folder the user picked on their own machine into an archive the
 * server can accept.
 *
 * WHY ZIP IN THE BROWSER AT ALL
 *
 * The server already accepts, stores, hashes and safely unpacks a single
 * archive, and that path is the one carrying the zip-slip / symlink /
 * decompression-bomb defences. Posting a folder as hundreds of separate
 * multipart parts would need a second upload protocol and a second set of
 * those defences. Packing client-side means a folder upload and a zip upload
 * are the same request, and the security story stays in one place.
 *
 * DETERMINISM MATTERS HERE, MORE THAN IT LOOKS
 *
 * The resume cache keys on the archive's sha256. A zip embeds a modification
 * date per entry by default, so zipping the same unchanged folder twice would
 * produce two different files, two different hashes, and a cache miss — the
 * user would pay to re-analyse code that had not changed. Every entry is
 * therefore stamped with a FIXED date, which makes the archive a pure
 * function of the file contents and paths. Same folder, same bytes, free
 * re-run.
 */

// Mirrors _SKIP_DIR_NAMES in uploads/archive.py. Kept identical on purpose:
// the server drops these anyway, so filtering here changes nothing about the
// result and everything about the upload size.
const SKIP_DIRS = new Set([
  '__MACOSX',
  '.git',
  'node_modules',
  'venv',
  '.venv',
  '__pycache__',
  '.pytest_cache',
]);

// A fixed timestamp so identical content always produces an identical archive.
const FIXED_DATE = new Date(Date.UTC(1980, 0, 1));

export const MAX_MB = 500;
export const MAX_FILES = 20000;

const isSkipped = (relPath) =>
  relPath.split('/').some((seg) => SKIP_DIRS.has(seg));

/** Drops the top folder name, matching the server's wrapper-stripping. */
const stripRoot = (relPath) => {
  const i = relPath.indexOf('/');
  return i === -1 ? relPath : relPath.slice(i + 1);
};

/**
 * Files chosen via <input webkitdirectory>. Each File carries
 * webkitRelativePath like "myproject/src/app.py".
 */
export function collectFromInput(fileList) {
  const out = [];
  for (const file of fileList) {
    const rel = file.webkitRelativePath || file.name;
    if (isSkipped(rel)) continue;
    out.push({ path: stripRoot(rel), file });
  }
  return out;
}

/**
 * Files from a dropped folder. The DataTransferItem entry API is the only way
 * to read a dropped DIRECTORY — dataTransfer.files alone gives nothing useful
 * for one.
 */
export async function collectFromDrop(dataTransfer) {
  const roots = [];
  for (const item of dataTransfer.items) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) roots.push(entry);
  }
  if (!roots.length) return null;

  const out = [];

  const readDir = (reader) =>
    new Promise((resolve, reject) => reader.readEntries(resolve, reject));

  const walk = async (entry, prefix) => {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (isSkipped(rel)) return;

    if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      out.push({ path: rel, file });
      return;
    }
    if (!entry.isDirectory) return;

    // readEntries returns at most ~100 per call, so it must be drained in a
    // loop until it yields an empty batch. Calling it once silently truncates
    // any directory with more than 100 children.
    const reader = entry.createReader();
    for (;;) {
      const batch = await readDir(reader);
      if (!batch.length) break;
      for (const child of batch) await walk(child, rel);
    }
  };

  // A single dropped folder is the wrapper; strip it exactly as the server
  // would. Dropping several items keeps them all.
  const single = roots.length === 1 && roots[0].isDirectory;
  for (const root of roots) await walk(root, '');

  return single ? out.map((e) => ({ ...e, path: stripRoot(e.path) })) : out;
}

export function totalBytes(entries) {
  return entries.reduce((sum, e) => sum + (e.file.size || 0), 0);
}

/**
 * Packs the collected files into a .zip Blob.
 *
 * DEFLATE at level 6: level 9 costs noticeably more CPU in a browser tab for
 * a few percent on source text, and this runs on the user's machine while
 * they wait.
 */
export async function zipEntries(entries, onProgress) {
  const zip = new JSZip();
  for (const { path, file } of entries) {
    zip.file(path, file, { date: FIXED_DATE, createFolders: false });
  }
  return zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (meta) => onProgress && onProgress(Math.round(meta.percent)),
  );
}
