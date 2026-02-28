import { useState, useMemo } from "react";
import { Sidebar } from "./components/Sidebar";
import { EditorArea } from "./components/EditorArea";
import { StatusBar } from "./components/StatusBar";
import { ActivityBar } from "./components/ActivityBar";
import { TerminalPanel } from "./components/TerminalPanel";
import { CommandPalette } from "./components/CommandPalette";
import { QuickOpen } from "./components/QuickOpen";
import { useKeybindings } from "./hooks/useKeybindings";

function App() {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [activePanel, setActivePanel] = useState<string>("explorer");
  const [commandPaletteVisible, setCommandPaletteVisible] = useState(false);
  const [quickOpenVisible, setQuickOpenVisible] = useState(false);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorColumn, setCursorColumn] = useState(1);

  // Keybinding handlers
  const handlers = useMemo(
    () => ({
      "command.palette": () => setCommandPaletteVisible(true),
      "file.quickOpen": () => setQuickOpenVisible(true),
      "panel.toggleTerminal": () => setTerminalVisible((v) => !v),
      "panel.toggleSidebar": () => setSidebarVisible((v) => !v),
      "file.save": () => {
        // TODO: Save current file via Tauri IPC
        console.log("Save triggered");
      },
    }),
    [],
  );

  useKeybindings(handlers);

  const handleCommand = (action: string) => {
    const handler = handlers[action as keyof typeof handlers];
    if (handler) handler();
  };

  return (
    <div className="app-container">
      {/* Activity Bar */}
      <ActivityBar activePanel={activePanel} onPanelChange={setActivePanel} />

      {/* Main content */}
      <div className="main-area">
        <div className="editor-row">
          {sidebarVisible && <Sidebar activePanel={activePanel} />}
          <EditorArea />
        </div>
        {terminalVisible && <TerminalPanel />}
      </div>

      {/* Status Bar */}
      <StatusBar
        branch="main"
        encoding="UTF-8"
        lineEnding="LF"
        line={cursorLine}
        column={cursorColumn}
        onToggleTerminal={() => setTerminalVisible(!terminalVisible)}
      />

      {/* Overlays */}
      <CommandPalette
        visible={commandPaletteVisible}
        onClose={() => setCommandPaletteVisible(false)}
        onExecute={handleCommand}
      />
      <QuickOpen
        visible={quickOpenVisible}
        onClose={() => setQuickOpenVisible(false)}
        onSelect={(path) => console.log("Open file:", path)}
      />
    </div>
  );
}

export default App;
