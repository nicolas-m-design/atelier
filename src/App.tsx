import { useEffect, useState } from "react";
import { ProjectRail } from "./components/ProjectRail";
import { Workspace } from "./components/Workspace";
import { PROJECTS } from "./projects";
import { browserStorage, createStore } from "./storage";
import { useStatuses } from "./useStatuses";

const store = createStore(browserStorage());

export function App() {
  const [active, setActive] = useState(() => PROJECTS.find((project) => project.id === store.get().active)?.id ?? PROJECTS[0]!.id);
  const [sidebar, setSidebar] = useState(() => store.get().sidebar);
  const { statuses, recheck } = useStatuses(PROJECTS);
  const project = PROJECTS.find((project) => project.id === active)!;

  useEffect(() => { store.update((saved) => { saved.active = active; saved.sidebar = sidebar; }); }, [active, sidebar]);
  useEffect(() => {
    document.title = `${project.name} · Atelier`;
  }, [project.name]);
  // Positions are written a moment after each change; make sure the last one lands.
  useEffect(() => {
    const flush = () => store.flush();
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden">
      <ProjectRail projects={PROJECTS} statuses={statuses} active={active} onSelect={(id) => { setActive(id); recheck(); }} />
      <Workspace key={project.id} project={project} status={statuses[project.id] ?? { state: "checking" }} store={store} sidebar={sidebar} onSidebar={setSidebar} onRetry={recheck} />
    </div>
  );
}
