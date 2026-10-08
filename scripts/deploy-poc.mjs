import { access, readFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const deployEnvFile = process.env.DEPLOY_ENV_FILE || ".env.deploy.poc";

async function fileExists(targetPath) {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function stripInlineComment(value) {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === "#" && !inSingleQuote && !inDoubleQuote) {
      return value.slice(0, i).trim();
    }
  }

  return value.trim();
}

async function loadEnvFileIfPresent(filePath) {
  if (!(await fileExists(filePath))) {
    return;
  }

  const contents = await readFile(filePath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalIdx = line.indexOf("=");
    if (equalIdx === -1) {
      continue;
    }

    const key = line.slice(0, equalIdx).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = stripInlineComment(line.slice(equalIdx + 1).trim());
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required deploy variable: ${name}`);
  }
  return value;
}

async function run(command, args, extraEnv = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: { ...process.env, ...extraEnv },
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed (${command} ${args.join(" ")}), exit code ${code}`));
    });
  });
}

async function runCapture(command, args, extraEnv = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...extraEnv },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(stderr || `Command failed (${command} ${args.join(" ")}), exit code ${code}`));
    });
  });
}

function buildAwsArgs(region, profile, args) {
  const result = [...args];
  if (region) {
    result.push("--region", region);
  }
  if (profile) {
    result.push("--profile", profile);
  }
  return result;
}

async function resolveDistributionId(region, profile, domainName) {
  const output = await runCapture(
    "aws",
    buildAwsArgs(region, profile, [
      "cloudfront",
      "list-distributions",
      "--query",
      `DistributionList.Items[?DomainName=='${domainName}'].Id | [0]`,
      "--output",
      "text",
    ]),
  );

  const distributionId = output.trim();
  if (!distributionId || distributionId === "None") {
    throw new Error(`Could not find CloudFront distribution for domain ${domainName}`);
  }
  return distributionId;
}

async function main() {
  // Load the deploy env file FIRST so that any VITE_* values it contains
  // (e.g. Cognito hosted-UI configuration) flow into the build subprocess.
  // Without this, `vite build --mode poc` would only see .env / .env.poc and
  // would silently drop any VITE_COGNITO_* values that live in the deploy
  // file, leaving the SPA without a Cognito sign-in button at runtime.
  await loadEnvFileIfPresent(path.resolve(rootDir, deployEnvFile));

  if (process.env.SKIP_BUILD !== "1") {
    console.log("Building POC bundle");
    await run("npm", ["run", "build:poc"]);
  }

  const bucket = requireEnv("POC_DEPLOY_BUCKET");
  const region = process.env.POC_AWS_REGION?.trim() || "us-east-1";
  const profile = process.env.POC_AWS_PROFILE?.trim();
  const prefix = (process.env.POC_S3_PREFIX || "").replace(/^\/+|\/+$/g, "");
  const invalidationPathsRaw = process.env.POC_INVALIDATION_PATHS || "/*";
  const distributionDomain = process.env.POC_CLOUDFRONT_DOMAIN_NAME?.trim();
  let distributionId = process.env.POC_CLOUDFRONT_DISTRIBUTION_ID?.trim();

  if (!distributionId && distributionDomain) {
    console.log(`Resolving CloudFront distribution ID for ${distributionDomain}`);
    distributionId = await resolveDistributionId(region, profile, distributionDomain);
  }
  if (!distributionId) {
    throw new Error(
      "Missing CloudFront target. Set POC_CLOUDFRONT_DISTRIBUTION_ID or POC_CLOUDFRONT_DOMAIN_NAME.",
    );
  }

  const distPath = path.resolve(rootDir, "dist");
  if (!(await fileExists(distPath))) {
    throw new Error("dist directory not found. Run a build before deploying.");
  }

  const s3Uri = prefix ? `s3://${bucket}/${prefix}` : `s3://${bucket}`;
  console.log(`Syncing ${distPath} -> ${s3Uri}`);

  await run("aws", buildAwsArgs(region, profile, ["s3", "sync", distPath, s3Uri, "--delete"]));

  const indexTarget = prefix ? `${s3Uri}/index.html` : `${s3Uri}/index.html`;
  const indexSource = path.join(distPath, "index.html");
  if (await fileExists(indexSource)) {
    console.log(`Updating cache headers for ${indexTarget}`);
    await run(
      "aws",
      buildAwsArgs(region, profile, [
        "s3",
        "cp",
        indexSource,
        indexTarget,
        "--cache-control",
        "no-cache,no-store,must-revalidate",
        "--content-type",
        "text/html",
      ]),
    );
  }

  const invalidationPaths = invalidationPathsRaw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  console.log(`Creating CloudFront invalidation on ${distributionId}`);
  await run(
    "aws",
    buildAwsArgs(region, profile, [
      "cloudfront",
      "create-invalidation",
      "--distribution-id",
      distributionId,
      "--paths",
      ...(invalidationPaths.length > 0 ? invalidationPaths : ["/*"]),
    ]),
  );

  console.log("POC deploy completed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
