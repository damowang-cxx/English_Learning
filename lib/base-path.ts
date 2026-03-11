const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH || "/listen";

export const BASE_PATH =
  configuredBasePath === "/"
    ? ""
    : configuredBasePath.replace(/\/+$/, "");

function isExternalUrl(path: string) {
  return /^(?:[a-z]+:)?\/\//i.test(path);
}

export function withBasePath(path: string) {
  if (!path) {
    return BASE_PATH || "/";
  }

  if (isExternalUrl(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (!BASE_PATH) {
    return normalizedPath;
  }

  if (
    normalizedPath === BASE_PATH ||
    normalizedPath.startsWith(`${BASE_PATH}/`)
  ) {
    return normalizedPath;
  }

  return `${BASE_PATH}${normalizedPath}`;
}

export function stripBasePath(pathname: string) {
  const normalizedPathname = pathname || "/";

  if (!BASE_PATH) {
    return normalizedPathname;
  }

  if (normalizedPathname === BASE_PATH) {
    return "/";
  }

  if (normalizedPathname.startsWith(`${BASE_PATH}/`)) {
    return normalizedPathname.slice(BASE_PATH.length);
  }

  return normalizedPathname;
}

export function getAudioSrc(audioUrl: string) {
  if (!audioUrl) {
    return withBasePath("/api/audio");
  }

  if (isExternalUrl(audioUrl)) {
    return audioUrl;
  }

  if (audioUrl.startsWith("/audio/")) {
    return withBasePath(`/api/audio/${audioUrl.slice("/audio/".length)}`);
  }

  return withBasePath(audioUrl);
}
