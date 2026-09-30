const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = __dirname;
const cacheDir = path.resolve(projectRoot, "cache", "nativewind");

// Ensure cache directory exists before starting Metro
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

// Pre-compile Tailwind CSS synchronously for all target platforms.
const platforms = ["web", "ios", "android"];
for (const p of platforms) {
  try {
    const inputPath = path.resolve(projectRoot, "global.css");
    const outputPath = path.resolve(cacheDir, `global.css.${p}.css`);
    execSync(
      `npx tailwindcss -i "${inputPath}" -o "${outputPath}"`,
      { 
        stdio: "ignore", 
        cwd: projectRoot,
        env: { ...process.env, NATIVEWIND_NATIVE: p } 
      }
    );
  } catch (error) {
    console.error(`Failed to pre-compile Tailwind CSS for platform ${p}:`, error);
  }
}

const baseConfig = getDefaultConfig(projectRoot);

const configWithNativeWind = withNativeWind(baseConfig, { 
  input: "./global.css",
  outputDir: "cache/nativewind",
  cliCommand: "npx tailwindcss",
});

// Inject resolveRequest AFTER withNativeWind to ensure Windows backslash-mangled paths are resolved cleanly
const originalResolveRequest = configWithNativeWind.resolver.resolveRequest;
configWithNativeWind.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    typeof moduleName === "string" &&
    (moduleName.includes("global.css") ||
     moduleName.includes("nativewind") ||
     moduleName.includes("cache"))
  ) {
    const resolvedPath = path.resolve(
      projectRoot,
      "cache",
      "nativewind",
      `global.css.${platform}.css`
    );
    if (fs.existsSync(resolvedPath)) {
      return {
        filePath: resolvedPath,
        type: "sourceFile",
      };
    }
  }

  if (originalResolveRequest) {
    try {
      return originalResolveRequest(context, moduleName, platform);
    } catch (e) {
      if (
        typeof moduleName === "string" &&
        moduleName.includes("global.css")
      ) {
        const resolvedPath = path.resolve(
          projectRoot,
          "cache",
          "nativewind",
          `global.css.${platform}.css`
        );
        return {
          filePath: resolvedPath,
          type: "sourceFile",
        };
      }
      throw e;
    }
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = configWithNativeWind;
