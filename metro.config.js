const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("vrm");

// Force all "three" imports to resolve from the project root, preventing
// stats-gl (or any other dep) from pulling in its own nested copy.
const rootThree = path.resolve(__dirname, "node_modules", "three");

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "three") {
    const newContext = {
      ...context,
      nodeModulesPaths: [path.resolve(__dirname, "node_modules")],
    };
    if (originalResolveRequest) {
      return originalResolveRequest(newContext, moduleName, platform);
    }
    return context.resolveRequest(newContext, moduleName, platform);
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
