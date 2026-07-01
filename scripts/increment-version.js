import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const versionFilePath = path.join(__dirname, "../src/version.json");

try {
  const fileContent = fs.readFileSync(versionFilePath, "utf8");
  const data = JSON.parse(fileContent);
  const currentVersion = data.version || "2.0.4";
  
  const parts = currentVersion.split(".");
  if (parts.length === 3) {
    const major = parseInt(parts[0], 10) || 2;
    const minor = parseInt(parts[1], 10) || 0;
    const patch = parseInt(parts[2], 10) || 0;
    
    const newVersion = `${major}.${minor}.${patch + 1}`;
    data.version = newVersion;
    fs.writeFileSync(versionFilePath, JSON.stringify(data, null, 2), "utf8");
    console.log(`[Version Increment] Successfully incremented version from ${currentVersion} to ${newVersion}`);
  } else {
    data.version = "2.0.5";
    fs.writeFileSync(versionFilePath, JSON.stringify(data, null, 2), "utf8");
    console.log(`[Version Increment] Version format unexpected. Reset to 2.0.5`);
  }
} catch (error) {
  console.error("[Version Increment Error]", error);
}
