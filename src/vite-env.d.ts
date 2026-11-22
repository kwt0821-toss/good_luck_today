/// <reference types="vite/client" />

declare global {
  var __ROOM_BUILD_ID__: string | undefined;
}

export {};

declare module "*.css" {
  const content: Record<string, string>;
  export default content;
}
