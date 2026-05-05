const { CompositeDisposable } = require("atom");

module.exports = {
  activate() {
    this.disposables = new CompositeDisposable(
      atom.config.observe("scrollmap-git-diff.threshold", (value) => {
        this.threshold = value;
      }),
    );
  },

  deactivate() {
    this.disposables.dispose();
  },

  getGitDiffDecorations(editor) {
    return editor.getDecorations({ type: "line-number" }).filter((d) => {
      return d.properties?.class?.startsWith("git-");
    });
  },

  provideScrollmap() {
    return {
      name: "git",
      description: "Git diff markers",
      position: "right",
      timer: 100,
      initialize: ({ editor, disposables, update }) => {
        for (const d of this.getGitDiffDecorations(editor)) {
          d.getMarker().onDidDestroy(update);
        }
        const orig = editor.decorateMarker;
        editor.decorateMarker = function (marker, params) {
          const result = orig.call(this, marker, params);
          if (params?.type === "line-number" && params?.class?.startsWith("git-")) {
            update();
            marker.onDidDestroy(update);
          }
          return result;
        };
        disposables.add(
          {
            dispose: () => {
              editor.decorateMarker = orig;
            },
          },
          atom.config.onDidChange("scrollmap-git-diff.threshold", update),
        );
      },
      getItems: ({ editor }) => {
        const items = [];
        let lastItem = null;
        for (const decoration of this.getGitDiffDecorations(editor)) {
          const marker = decoration.getMarker();
          if (!marker.isValid()) continue;
          const cls = decoration.properties.class;
          let mappedCls;
          if (cls === "git-line-added") {
            mappedCls = "added";
          } else if (cls === "git-line-removed" || cls === "git-previous-line-removed") {
            mappedCls = "removed";
          } else if (cls === "git-line-modified") {
            mappedCls = "modified";
          } else continue;
          const range = marker.getBufferRange();
          const startRow = editor.screenRowForBufferRow(range.start.row);
          const endPosition = editor.screenPositionForBufferPosition(range.end);
          const endRow = endPosition.column ? endPosition.row : endPosition.row - 1;
          if (lastItem && lastItem.cls === mappedCls && startRow <= lastItem.end + 1) {
            lastItem.end = endRow;
          } else {
            if (lastItem) items.push(lastItem);
            lastItem = { row: startRow, end: endRow, cls: mappedCls };
          }
        }
        if (lastItem) items.push(lastItem);
        if (this.threshold && items.length > this.threshold) {
          return [];
        }
        return items;
      },
    };
  },
};
