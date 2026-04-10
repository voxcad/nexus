/**
 * Local-first persistence using Origin Private File System (OPFS).
 * Falls back to localStorage if OPFS not available.
 */

export interface ProjectFile {
  name: string;
  lastModified: number;
  size: number;
}

async function getOPFSRoot(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await navigator.storage.getDirectory();
  } catch {
    return null;
  }
}

async function getNexusDir(): Promise<FileSystemDirectoryHandle | null> {
  const root = await getOPFSRoot();
  if (!root) return null;
  try {
    return await root.getDirectoryHandle('nexus-projects', { create: true });
  } catch {
    return null;
  }
}

export async function saveProject(name: string, data: string): Promise<boolean> {
  const dir = await getNexusDir();
  if (dir) {
    try {
      const fileHandle = await dir.getFileHandle(`${name}.nexus`, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(data);
      await writable.close();
      return true;
    } catch (e) {
      console.error('OPFS save failed:', e);
    }
  }

  // Fallback to localStorage
  try {
    localStorage.setItem(`nexus_project_${name}`, data);
    return true;
  } catch (e) {
    console.error('localStorage save failed:', e);
    return false;
  }
}

export async function loadProject(name: string): Promise<string | null> {
  const dir = await getNexusDir();
  if (dir) {
    try {
      const fileHandle = await dir.getFileHandle(`${name}.nexus`);
      const file = await fileHandle.getFile();
      return await file.text();
    } catch {
      // File not found in OPFS
    }
  }

  // Fallback to localStorage
  return localStorage.getItem(`nexus_project_${name}`) || null;
}

export async function listProjects(): Promise<ProjectFile[]> {
  const projects: ProjectFile[] = [];

  const dir = await getNexusDir();
  if (dir) {
    try {
      for await (const [name, handle] of (dir as any).entries()) {
        if (name.endsWith('.nexus') && handle.kind === 'file') {
          const file = await (handle as FileSystemFileHandle).getFile();
          projects.push({
            name: name.replace('.nexus', ''),
            lastModified: file.lastModified,
            size: file.size,
          });
        }
      }
    } catch (e) {
      console.error('OPFS list failed:', e);
    }
  }

  // Also check localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('nexus_project_')) {
      const name = key.replace('nexus_project_', '');
      const data = localStorage.getItem(key) || '';
      if (!projects.find(p => p.name === name)) {
        projects.push({
          name,
          lastModified: Date.now(),
          size: data.length,
        });
      }
    }
  }

  return projects.sort((a, b) => b.lastModified - a.lastModified);
}

export async function deleteProject(name: string): Promise<boolean> {
  const dir = await getNexusDir();
  if (dir) {
    try {
      await dir.removeEntry(`${name}.nexus`);
      return true;
    } catch {}
  }

  try {
    localStorage.removeItem(`nexus_project_${name}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Serialize full project state (entities + constraints + metadata).
 */
export function serializeProject(entitiesJson: string, constraintsJson: string, metadata: any = {}): string {
  return JSON.stringify({
    version: '0.1.0',
    format: 'nexus-project',
    timestamp: Date.now(),
    metadata,
    entities: JSON.parse(entitiesJson),
    constraints: JSON.parse(constraintsJson),
  }, null, 2);
}

/**
 * Deserialize project state.
 */
export function deserializeProject(data: string): {
  entities: any[];
  constraints: any[];
  metadata: any;
} | null {
  try {
    const parsed = JSON.parse(data);
    if (parsed.format !== 'nexus-project') return null;
    return {
      entities: parsed.entities || [],
      constraints: parsed.constraints || [],
      metadata: parsed.metadata || {},
    };
  } catch {
    return null;
  }
}

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Open a file picker and read the selected file.
 */
export function openFilePicker(accept: string = '.dxf,.nexus'): Promise<{ name: string; content: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      const content = await file.text();
      resolve({ name: file.name, content });
    };
    input.click();
  });
}
