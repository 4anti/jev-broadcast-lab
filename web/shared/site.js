/** Site root is the parent of /shared/. Works on /, /repo/, and file://. */
export const SITE = new URL("../", import.meta.url);

export function siteUrl(path = "") {
  return new URL(String(path).replace(/^\//, ""), SITE);
}

export function pathNorm(pathname) {
  const trimmed = String(pathname || "").replace(/index\.html$/i, "").replace(/\/+$/, "");
  return trimmed || "/";
}
