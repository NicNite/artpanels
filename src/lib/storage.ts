import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./public/uploads";

export async function saveImage(
  projectId: string,
  generationId: string,
  index: number,
  data: Buffer,
  ext = "webp"
): Promise<{ filePath: string; thumbnailPath: string }> {
  const dir = path.join(UPLOAD_DIR, "projects", projectId, generationId);
  await mkdir(dir, { recursive: true });

  const filename = `${index}.${ext}`;
  const absPath = path.join(dir, filename);
  await writeFile(absPath, data);

  // Path relative to public/ with leading slash
  const relativePath = path.posix.join(
    "/uploads",
    "projects",
    projectId,
    generationId,
    filename
  );

  return {
    filePath: relativePath,
    thumbnailPath: relativePath,
  };
}

export async function saveExportFile(
  candidateId: string,
  data: Buffer,
  ext = "3mf"
): Promise<string> {
  const dir = path.join(UPLOAD_DIR, "exports", candidateId);
  await mkdir(dir, { recursive: true });

  const timestamp = Date.now();
  const filename = `panel-${timestamp}.${ext}`;
  const absPath = path.join(dir, filename);
  await writeFile(absPath, data);

  // Path relative to public/ with leading slash
  return path.posix.join("/uploads", "exports", candidateId, filename);
}

export async function readImageFile(publicPath: string): Promise<Buffer> {
  // publicPath starts with /, so strip the leading slash before joining
  const relativePath = publicPath.startsWith("/")
    ? publicPath.slice(1)
    : publicPath;
  const absPath = path.join("./public", relativePath);
  return readFile(absPath);
}
