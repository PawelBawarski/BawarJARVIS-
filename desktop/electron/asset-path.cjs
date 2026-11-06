const path = require("node:path");

function resolveUiAsset(rootDirectory, requestUrl) {
  try {
    const url = new URL(requestUrl);

    if (
      url.protocol !== "jarvis:" ||
      url.host !== "app" ||
      url.username ||
      url.password
    ) {
      return null;
    }

    const decodedPath = decodeURIComponent(url.pathname);

    const relativePath =
      decodedPath === "/" ? "index.html" : decodedPath.slice(1);

    if (
      !relativePath ||
      relativePath.includes("\0") ||
      path.isAbsolute(relativePath)
    ) {
      return null;
    }

    const root = path.resolve(rootDirectory);
    const assetPath = path.resolve(root, relativePath);
    const relative = path.relative(root, assetPath);

    if (
      !relative ||
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    ) {
      return null;
    }

    return assetPath;
  } catch {
    return null;
  }
}

module.exports = { resolveUiAsset };
