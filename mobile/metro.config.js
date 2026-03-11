const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// ─── 1. React deduplication ───────────────────────────────────────────────────
// The new architecture (Bridgeless / nativewind jsxImportSource) can cause
// two copies of React to be loaded, making ReactCurrentDispatcher.current null
// and crashing every hook call with "Cannot read property 'useState' of null".
// Force every package to resolve 'react' and 'react-native' to the single copy
// in this project's node_modules.
const appReact = require.resolve("react");
const appReactNative = require.resolve("react-native");

// ─── 2. Windows path deduplication ───────────────────────────────────────────
// When the Android dev client is compiled on Windows the absolute project path
// (e.g. C:\projects\foo\mobile) gets embedded into HTTP bundle URLs *and* HMR
// WebSocket entry-point parameters.  Metro then doubles the path and returns
// 404 / UnableToResolveError.
//
// Convert  C:\projects\foo\mobile  →  /projects/foo/mobile  (URL form)
const projectRootUrlPath = __dirname
  .replace(/^[A-Za-z]:/, "") // strip drive letter (C: D: …)
  .replace(/\\/g, "/"); // backslash → forward slash

// Regex: optional leading "./" / "../" repetitions + project path + "/" + rest
// Capture group 1 = the real module path that follows the project root.
// Guard: we only rewrite when group 1 starts with "node_modules/" so we never
// accidentally remap a legitimate relative import.
const projectPathSegment = projectRootUrlPath.slice(1); // "projects/foo/mobile"
const escapedSegment = projectPathSegment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const embeddedPathRegex = new RegExp(
  `^(?:\\.{1,2}\\/)*${escapedSegment}\\/(node_modules\\/.+)$`
);

// Fix HTTP bundle URLs  (e.g. GET /projects/foo/mobile/node_modules/expo-router/…)
const originalRewrite = config.server && config.server.rewriteRequestUrl;
config.server = {
  ...config.server,
  rewriteRequestUrl: (url) => {
    let rewritten = url;
    if (projectRootUrlPath.length > 1 && rewritten.startsWith(projectRootUrlPath + "/")) {
      rewritten = rewritten.slice(projectRootUrlPath.length);
    }
    return originalRewrite ? originalRewrite(rewritten) : rewritten;
  },
};

// Apply nativewind before wrapping the resolver so our resolver runs outermost.
const finalConfig = withNativeWind(config, { input: "./global.css" });

// ─── 3. Windows multipart/chunked encoding fix ────────────────────────────────
// React Native's BundleDownloader sends "Accept: multipart/mixed", causing Metro
// to stream the bundle with Transfer-Encoding: chunked in a multipart envelope.
// On Windows, Metro's CRLF line endings in multipart boundaries corrupt the chunk
// size headers, producing:
//   ProtocolException: Expected leading [0-9a-fA-F] character but was 0xd
// Strip the multipart Accept header so Metro sends a plain application/javascript
// response instead, which OkHttp parses without issues.
const existingEnhance = finalConfig.server?.enhanceMiddleware;
finalConfig.server = {
  ...finalConfig.server,
  enhanceMiddleware: (metroMiddleware, server) => {
    const wrapped = existingEnhance
      ? existingEnhance(metroMiddleware, server)
      : metroMiddleware;
    return (req, res, next) => {
      if (req.headers?.accept?.includes("multipart/mixed")) {
        req.headers.accept = req.headers.accept.replace(
          "multipart/mixed",
          "application/javascript"
        );
      }
      return wrapped(req, res, next);
    };
  },
};

// Combined resolver: React dedup + Windows HMR path fix
const nextResolver = finalConfig.resolver && finalConfig.resolver.resolveRequest;
finalConfig.resolver = {
  ...finalConfig.resolver,
  resolveRequest: (context, moduleName, platform) => {
    // React deduplication — return the project-root copy unconditionally
    if (moduleName === "react") {
      return { type: "sourceFile", filePath: appReact };
    }
    if (moduleName === "react-native") {
      return { type: "sourceFile", filePath: appReactNative };
    }

    // Windows HMR path fix — only rewrite when result is inside node_modules
    let fixedName = moduleName;
    if (projectPathSegment.length > 0) {
      const match = moduleName.match(embeddedPathRegex);
      if (match) {
        fixedName = "./" + match[1]; // e.g. "./node_modules/expo-router/entry"
      }
    }

    const resolve = nextResolver || context.resolveRequest;
    return resolve(context, fixedName, platform);
  },
};

module.exports = finalConfig;
