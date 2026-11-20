import { readFileSync, writeFileSync } from "node:fs";
import { autoSession } from "/home/akash/code/vibes-ai-unofficial-api/src/auth/auto-login.js";
import { VibesClient } from "/home/akash/code/vibes-ai-unofficial-api/src/client.js";

/**
 * Usage: tsx ramayana-gen.mts <frame.jpg> <outDir> <outName> <projectName> <promptFile>
 */
const [framePath, outDir, outName, projectName, promptFile] = process.argv.slice(2);
if (!framePath || !outDir || !outName || !projectName || !promptFile) {
  throw new Error("missing args: <frame.jpg> <outDir> <outName> <projectName> <promptFile>");
}

const prompt = readFileSync(promptFile, "utf8").trim();
const client = new VibesClient({ session: autoSession() });
console.log("[auth]", (await client.auth.me()).user.username);

const project = await client.projects.create(projectName);
const projectId = project.project.id;
console.log("[project]", projectId);

const { upload, attach } = await client.media.uploadToProject(
  projectId,
  readFileSync(framePath),
  { filename: `${outName}-startframe.jpg` },
);
const contentItemId = attach.contentItems[0]?.id;
console.log(
  "[upload]",
  upload.mediaEntId,
  JSON.stringify(upload.dimensions),
  upload.aspectRatio,
  "ci:",
  contentItemId,
);

const result = await client.videos.generateAndWait(
  {
    projectId,
    prompt,
    startFrame: {
      imageUrl: upload.cdnUrl,
      imageEntId: upload.mediaEntId,
      contentItemId,
      dimensions: upload.dimensions,
    },
    aspectRatio: "9:16",
    variations: 1,
  },
  { timeoutMs: 12 * 60_000, intervalMs: 3_000 },
);

const video = result.videos[0]!;
console.log("[video]", video.videoUrl);
console.log(
  "[video] contentItemId:",
  video.contentItemId,
  "mediaEntId:",
  video.mediaEntId,
);

const res = await fetch(video.videoUrl);
if (!res.ok) throw new Error(`download failed ${res.status}`);
const bytes = Buffer.from(await res.arrayBuffer());
const outPath = `${outDir}/${outName}.mp4`;
writeFileSync(outPath, bytes);
console.log("[saved]", outPath, bytes.length, "bytes");

const asset = (await client.assets.list(projectId)).assets.find(
  (a) => a.contentItemId === video.contentItemId,
);
console.log(
  "[asset]",
  JSON.stringify({
    dimensions: asset?.structuredOutput?.metadata?.dimensions,
    aspectRatio: asset?.structuredOutput?.metadata?.aspectRatio,
    duration: asset?.videoDuration,
  }),
);

writeFileSync(
  `${outDir}/${outName}.generation.json`,
  JSON.stringify(
    {
      projectId,
      batchId: result.batch.id,
      contentItemId: video.contentItemId,
      mediaEntId: video.mediaEntId,
      videoUrl: video.videoUrl,
      frame: {
        mediaEntId: upload.mediaEntId,
        contentItemId,
        dimensions: upload.dimensions,
      },
      prompt,
    },
    null,
    2,
  ),
);
