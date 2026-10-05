# File Editor with Save and Auto-save

A standalone build of BB's existing Monaco File Editor, with a visible **Save** button and optional **Auto-save**. Based on `get-bb/bb` at `desktop-v0.43.4` (`9b8c1d3457b00359af206e3fd423fe50520182c2`). The original MIT license is included.

## Saving

- Click **Save**, or use **⌘S** on macOS / **Ctrl+S** on Windows and Linux.
- **Auto-save** is off by default for each opened file. Turn it on to save after one second without typing. It is a temporary preference for that editor, not a global setting.
- Writes are serialized. Changes typed during a save remain unsaved until the next write succeeds.
- Saving identical content that is already on disk succeeds, including retries after a lost response.
- If the file changed on disk to different content, saving stops. Choose **Reload** to discard local changes or **Overwrite** to replace the disk version deliberately.
- After a write error, changes remain in the editor. Auto-save pauses; click **Save** to retry.
- Wait for saving to finish before closing the tab. Closing does not flush pending edits.

The editor retains syntax highlighting, the file tree, search, folding, theme support, and the original BB file routing. It uses the existing version-checked file write RPC. This change adds no content logging, telemetry, or exports.

## Installation

Requires BB 0.43.4 or newer with Plugin SDK 0.5.9 or newer.

Save changes in all open File Editor tabs before switching implementations. This package has its own plugin ID because BB reserves the bundled plugin's ID. Once installed, disable the bundled File Editor to avoid having two editors claim the same file types.

```sh
bb plugin install git:https://github.com/kreodont/bb.git@file-editor-save-addon
bb plugin disable monaco-editor
```

Reopen a file tab to use the new toolbar. Application updates do not overwrite this managed plugin. Update it with:

```sh
bb plugin update file-editor-save
```

To return to the bundled editor, save any open edits first, then run:

```sh
bb plugin disable file-editor-save
bb plugin enable monaco-editor
```

## Development

```sh
pnpm install --frozen-lockfile
pnpm exec turbo run typecheck test build
bb plugin types --check .
```

`build` stages Monaco's lazy-loaded assets and then runs `bb plugin build`. Generated plugin and Monaco bundles are committed so a managed Git install does not need a build toolchain. The package uses BB's runtime React/UI shims and the pinned SDK declarations.

## SDK and CLI

Manual and automatic saves call the same `write` RPC with `path`, `source`, `content`, and `expectedSha256`. Keep the hash returned by `read`; a null hash explicitly requests overwrite. The supported methods can be inspected with:

```sh
bb plugin rpc list file-editor-save
bb plugin rpc call file-editor-save write --input-file write-request.json
```

Auto-save scheduling belongs to the open editor's in-memory buffer. CLI clients own their buffers and scheduling and use the same version-checked write operation.
