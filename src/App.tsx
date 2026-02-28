import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { EditorArea } from "./components/EditorArea";
import { StatusBar } from "./components/StatusBar";
import { ActivityBar } from "./components/ActivityBar";
import { TerminalPanel } from "./components/TerminalPanel";

function App() {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [activePanel, setActivePanel] = useState<string>("explorer");

  return (
    <div className="app-container">
      {/* Activity Bar — Left icon strip */}
      <ActivityBar
        activePanel={activePanel}
        onPanelChange={setActivePanel}
      />

      {/* Main content area */}
      <div className="main-area">
        {/* Top: Editor + optional sidebar */}
        <div className="editor-row">
          {sidebarVisible && (
            <Sidebar activePanel={activePanel} />
          )}
          <EditorArea />
        </div>

        {/* Bottom: Terminal panel */}
        {terminalVisible && <TerminalPanel />}
      </div>

      {/* Status Bar — Bottom */}
      <StatusBar
        branch="main"
        encoding="UTF-8"
        lineEnding="LF"
        line={1}
        column={1}
        onToggleTerminal={() => setTerminalVisible(!terminalVisible)}
      />
    </div>
  );
}

export default App;
