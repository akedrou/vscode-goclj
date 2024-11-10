import * as assert from "assert";
import { parseDiff } from "../../extension";
import { suite, test } from "mocha";

suite("parseDiff Function", () => {
  test("should handle simple addition", () => {
    const diff = `@@ -0,0 +1,2 @@
+New line 1
+New line 2
`;
    console.error("start!");
    const edits = parseDiff(diff);
    console.error("Edits: ", edits);

    assert.strictEqual(edits.length, 1);
    assert.strictEqual(edits[0].newText, "New line 1\nNew line 2");
  });

  test("should handle simple deletion", () => {
    const diff = `@@ -2,2 +2,0 @@
Old line 1
-Old line 2
-Old line 3
`;
    const edits = parseDiff(diff);

    assert.strictEqual(edits.length, 1);
    assert.strictEqual(edits[0].newText, "");
  });

  test("should handle total deletion", () => {
    const diff = `@@ -1,2 +0,0 @@
-Old line 1
-Old line 2
`;
    const edits = parseDiff(diff);

    assert.strictEqual(edits.length, 1);
    assert.strictEqual(edits[0].newText, "");
  });

  test("should handle replacement", () => {
    const diff = `@@ -1,2 +1,2 @@
-Old line 1
+New line 1
 Old line 2
`;
    const edits = parseDiff(diff);

    assert.strictEqual(edits.length, 1);
    assert.strictEqual(edits[0].newText, "New line 1");
  });

  test("should handle multiple edits", () => {
    const diff = `@@ -1,2 +1,2 @@
-Old line 1
+New line 1
 Old line 2
@@ -4,0 +4,1 @@
+Additional line
`;
    const edits = parseDiff(diff);

    assert.strictEqual(edits.length, 2);
    assert.strictEqual(edits[0].newText, "New line 1");
    assert.strictEqual(edits[1].newText, "Additional line");
  });
});
