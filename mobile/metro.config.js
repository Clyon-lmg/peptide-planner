const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Fix for Windows path issue: when the Android dev client is built on Windows,
// the absolute project path (e.g. C:\projects\foo\mobile) gets embedded into
// the bundle request URL as /projects/foo/mobile/node_modules/... Metro then
// tries to resolve this as a relative path from the project root and fails.
// We strip the project root prefix so Metro receives the correct module path.
const projectRootUrlPath = __dirname
  .replace(/^[A-Za-z]:/, "") // strip Windows drive letter e.g. "C:"
  .replace(/\\/g, "/"); // backslash → forward slash

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

module.exports = withNativeWind(config, { input: "./global.css" });
