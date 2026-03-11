const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Fix for Windows path issue: when the Android dev client is compiled on
// Windows, the absolute project path (C:\projects\foo\mobile) gets embedded
// into both HTTP bundle URLs AND HMR WebSocket entry-point parameters as
// /projects/foo/mobile/node_modules/…  Metro then fails to resolve the module
// because it ends up constructing a doubled/relative path.
//
// We apply the fix at two levels:
//  1. rewriteRequestUrl – strips the path prefix from HTTP bundle URLs.
//  2. resolver.resolveRequest – strips it from HMR WebSocket entry-point
//     module names (which arrive as e.g. "./../projects/foo/mobile/…").

// Convert the Windows absolute path to a URL-style path segment, e.g.:
//   C:\projects\foo\mobile  →  /projects/foo/mobile
const projectRootUrlPath = __dirname
  .replace(/^[A-Za-z]:/, "") // strip drive letter  (C: D: …)
  .replace(/\\/g, "/"); // backslash → forward slash

// Matches any module name that embeds the project root path, preceded by any
// number of leading "./" or "../" segments that Windows path-relativity adds.
// Capture group 1 is the real module path that comes after the project root.
const projectPathSegment = projectRootUrlPath.slice(1); // e.g. "projects/foo/mobile"
const escapedSegment = projectPathSegment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Matches: (optional "./" or "../" repetitions) + projectPathSegment + "/" + rest
const embeddedPathRegex = new RegExp(
  `^(?:\\.{1,2}\\/)*${escapedSegment}\\/(.+)$`
);

// 1. Fix HTTP bundle URLs (e.g. /projects/foo/mobile/node_modules/…)
const originalRewrite = config.server && config.server.rewriteRequestUrl;
config.server = {
  ...config.server,
  rewriteRequestUrl: (url) => {
    let rewritten = url;
    if (
      projectRootUrlPath.length > 1 &&
      rewritten.startsWith(projectRootUrlPath + "/")
    ) {
      rewritten = rewritten.slice(projectRootUrlPath.length);
    }
    return originalRewrite ? originalRewrite(rewritten) : rewritten;
  },
};

// Apply nativewind BEFORE wrapping the resolver so we can sit on top of it.
const finalConfig = withNativeWind(config, { input: "./global.css" });

// 2. Fix module names inside the resolver (handles HMR WebSocket entry points
//    that arrive as relative paths containing the full Windows project path).
const nextResolver =
  finalConfig.resolver && finalConfig.resolver.resolveRequest;
finalConfig.resolver = {
  ...finalConfig.resolver,
  resolveRequest: (context, moduleName, platform) => {
    let fixedName = moduleName;
    if (projectPathSegment.length > 0) {
      const match = moduleName.match(embeddedPathRegex);
      if (match) {
        // Resolve the real module relative to the project root (origin is ".")
        fixedName = "./" + match[1];
      }
    }
    const resolve = nextResolver || context.resolveRequest;
    return resolve(context, fixedName, platform);
  },
};

module.exports = finalConfig;
