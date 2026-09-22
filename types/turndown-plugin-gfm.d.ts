// The GFM plugin ships no typings. Only the piece the MediaWiki export uses is declared.
declare module "@joplin/turndown-plugin-gfm" {
  import type TurndownService from "turndown";

  export const tables: TurndownService.Plugin;
  export const gfm: TurndownService.Plugin;
}
