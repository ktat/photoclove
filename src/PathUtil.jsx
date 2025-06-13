// Propely change Windows path like \\?\C:\path\to\file.jpg
export default function fileUrl(windowsPath) {
  let cleanPath = windowsPath.replace(/^\\\\\?\\/, '/');
  // if clearPath is equal to windowsPath, it means it is not a Windows path
  if (cleanPath != windowsPath) {
    cleanPath = cleanPath.replace(/\\/g, '/');
  }
  const fileUrl = new URL(`file://${cleanPath}`);
  return fileUrl.href;
}