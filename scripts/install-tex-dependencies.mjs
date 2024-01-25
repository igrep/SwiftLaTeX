import { dirname, basename } from "node:path";
import { readFile, writeFile, mkdir, symlink } from "node:fs/promises";

process.chdir(dirname(dirname(new URL(import.meta.url).pathname)));
const lines = (await readFile("tex-dependencies.txt", "utf8")).split("\n");

const texDepsDir = "tex-dependencies";
await mkdir(texDepsDir, { recursive: true }); // `recursive: true` ignores `Error: EEXIST`.
process.chdir(texDepsDir);

async function skipIfAlreadyExists(name, body) {
  try {
    await body();
  } catch (e) {
    if (e.code === "EEXIST") {
      console.info(`${name} already exists`);
      return;
    }
    throw e;
  }
}

for (const line of lines) {
  const url = line.trim();
  if (!url) {
    continue;
  }
  console.log(`Downloading ${url}`);
  const r = await fetch(url);
  if (!r.ok) { // NOTE: texlive2.swiftlatex.com returns 301 when not found.
    console.warn(`Failed to download ${url}`);
    continue;
  }
  const fileId = r.headers.get("fileid");
  const urlBasename = basename(url);
  const name = fileId || urlBasename;

  await skipIfAlreadyExists(name, async () => {
    await writeFile(
      name,
      new Uint8Array(await r.arrayBuffer()),
      { flag: "wx" },
    );
  });

  if (name !== urlBasename) {
    await skipIfAlreadyExists(urlBasename, async () => {
      await symlink(name, urlBasename);
    });
  }
}
