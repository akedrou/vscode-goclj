import * as vscode from "vscode";
import * as cp from "child_process";
import * as fs from "fs";
import * as path from "path";

export const CLOJURE_LANGUAGE = "clojure";

function findOnPath(command: string): string | undefined {
  const paths = (process.env.PATH || "").split(path.delimiter);
  for (const p of paths) {
    const fullPath = path.join(p, command);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return fullPath;
    }
  }
  return undefined;
}

async function formatDocument(
  document: vscode.TextDocument
): Promise<vscode.TextEdit[]> {
  const config = vscode.workspace.getConfiguration("goclj");
  const configFile = config.get<string>("configFile");
  let formatterPath = config.get<string>("path");

  if (!formatterPath || !fs.existsSync(formatterPath)) {
    if (!formatterPath || !fs.existsSync(formatterPath)) {
      if (config.get<boolean>("searchPath")) {
        formatterPath = findOnPath("cljfmt");
      }
      if (!formatterPath) {
        vscode.window.showErrorMessage(
          "No valid formatter found: please configure a path or install `goclj`."
        );
        return [];
      }
    }

    vscode.window.showErrorMessage("Clojure formatter path is not valid.");
    return [];
  }

  const result = await runFormatter(document, formatterPath, configFile);
  return result ? parseDiff(result) : [];
}

async function runFormatter(
  document: vscode.TextDocument,
  formatterPath: string,
  configFile: string | undefined
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const params = ["-d"];
    if (configFile && fs.existsSync(configFile)) {
      params.push("-c", configFile);
    }
    const child = cp.spawn(formatterPath, params, {
      stdio: ["pipe", "pipe", "ignore"],
    });

    child.stdin.write(document.getText());
    child.stdin.end();

    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk.toString()));
    child.on("error", reject);
    child.on("close", () => resolve(output));
  });
}

export function parseDiff(diff: string): vscode.TextEdit[] {
  const edits: vscode.TextEdit[] = [];
  const lines = diff.split("\n");
  let currentLine = 0;

  while (currentLine < lines.length) {
    const line = lines[currentLine];

    // Process hunk header (e.g., @@ -start,len +start,len @@)
    if (line.startsWith("@@")) {
      const match = /@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (!match) {
        currentLine++;
        continue;
      }

      let startLine = parseInt(match[1]) - 1;
      // If an edit somehow deletes the whole document, the matched value will
      // be 0, which is invalid. VSCode can't have a document with 0 lines, so
      // we'll just start at the beginning in that case.
      if (startLine < 0) {
        startLine = 0;
      }
      let editStartLine = startLine;
      let editStartCharacter = 0;
      let editText = "";
      let needsEdit = false;

      currentLine++;
      while (
        currentLine < lines.length &&
        !lines[currentLine].startsWith("@@")
      ) {
        const changeLine = lines[currentLine];

        if (changeLine.startsWith("-")) {
          // Deletion line, skip it for the text to add, but count it for position
          startLine++;
          needsEdit = true;
        } else if (changeLine.startsWith("+")) {
          // Addition line, append this text
          editText += changeLine.slice(1) + "\n";
          needsEdit = true;
        } else {
          // Context line (no change), if there's pending text to add, create an edit
          if (needsEdit) {
            edits.push(
              vscode.TextEdit.replace(
                new vscode.Range(
                  editStartLine,
                  editStartCharacter,
                  startLine,
                  0
                ),
                editText.trimEnd() // Remove final newline
              )
            );
            editText = "";
            needsEdit = false;
          }
          startLine++;
          editStartLine = startLine;
          editStartCharacter = 0;
        }
        currentLine++;
      }

      // Final addition, if any
      if (needsEdit) {
        edits.push(
          vscode.TextEdit.replace(
            new vscode.Range(editStartLine, editStartCharacter, startLine, 0),
            editText.trimEnd()
          )
        );
      }
    } else {
      currentLine++;
    }
  }

  return edits;
}

export function activate(context: vscode.ExtensionContext) {
  // Register the manual format command
  const formatCommand = vscode.commands.registerCommand(
    "goclj.formatDocument",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor found");
        return;
      }

      const document = editor.document;
      if (document.languageId !== "clojure") {
        vscode.window.showErrorMessage("Not a Clojure file.");
        return;
      }

      formatDocument(document);
    }
  );

  // Register the document formatter for Clojure
  const documentFormatter =
    vscode.languages.registerDocumentFormattingEditProvider("clojure", {
      provideDocumentFormattingEdits(
        document: vscode.TextDocument
      ): Promise<vscode.TextEdit[]> {
        return formatDocument(document);
      },
    });

  context.subscriptions.push(formatCommand, documentFormatter);
}

export function deactivate() {}
