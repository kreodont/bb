## Save without a shortcut

A visible **Save** button sits beside the file path. The usual **⌘S / Ctrl+S** shortcut still works. Enable **Auto-save** for the current file to save after one second without typing; it starts off each time a file opens.

Edits made while a write is running remain unsaved until the next write succeeds. If another process changes the file, saving pauses and offers **Reload** or **Overwrite**. A failed write keeps your changes in the editor and can be retried with **Save**.

## The existing File Editor

This is a standalone build of BB's Monaco File Editor. Syntax highlighting, the file tree, find, folding, and theme support are retained. No account or external service is required. This change introduces no file-content logs, telemetry, or exports.

## Setup

Requires BB 0.43.4 or newer. Save any open edits before installing and disable the bundled File Editor to avoid two competing file openers. Reopen file tabs after switching. Wait for saves to finish before closing a tab.

The separate plugin installation survives application updates. Use `bb plugin update file-editor-save` to update this version.
