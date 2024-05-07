export function red(message: string): string {
  return `\u001b[31m${message}\u001b[39m`;
}

export function green(message: string): string {
  return `\u001b[32m${message}\u001b[39m`;
}
