import { useState } from 'react';
import { TopBar } from './components/TopBar';
import { LeftSidebar } from './components/LeftSidebar';
import { RightSidebar } from './components/RightSidebar';
import { MainCanvas } from './components/MainCanvas';
import { NavigationHelp } from './components/NavigationHelp';
import { INITIAL_OBJECTS, INITIAL_STEPS } from './constants';
import { SceneObject, SidebarSection } from './types';

function App() {
  const [activeTab, setActiveTab] = useState<SidebarSection | null>(null);
  const [objects, setObjects] = useState<SceneObject[]>(INITIAL_OBJECTS);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [steps] = useState(INITIAL_STEPS);
  const [simulationTitle, setSimulationTitle] = useState('New Simulation');

  const handleSelectObject = (id: string | null) => {
    setSelectedObjectId(id);
  };

  const handleUpdateObject = (updated: SceneObject) => {
    setObjects((prev) => prev.map((obj) => (obj.id === updated.id ? updated : obj)));
  };

  const handleDeleteObject = (id: string) => {
    setObjects((prev) => prev.filter((obj) => obj.id !== id));
    if (selectedObjectId === id) setSelectedObjectId(null);
  };

  const selectedObject = objects.find((obj) => obj.id === selectedObjectId) || null;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black selection:bg-blue-500/30 selection:text-white">
      {/* Background / Workspace Layer */}
      <MainCanvas
        objects={objects}
        selectedObjectId={selectedObjectId}
        onSelectObject={handleSelectObject}
        onUpdateObject={handleUpdateObject}
      />

      {/* Floating UI Layer */}
      <TopBar title={simulationTitle} onTitleChange={setSimulationTitle} />

      <LeftSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        steps={steps}
        objects={objects}
        onSelectObject={handleSelectObject}
        selectedObjectId={selectedObjectId}
      />

      {selectedObject && (
        <RightSidebar
          object={selectedObject}
          onUpdate={handleUpdateObject}
          onDelete={handleDeleteObject}
          onClose={() => setSelectedObjectId(null)}
        />
      )}

      <NavigationHelp offsetForSidebar={!!selectedObject} />
    </div>
  );
}

export default App;
