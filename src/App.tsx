import { useEffect, useState } from "react";
import { NoProjects } from "./components/NoProjects";
import { ProjectRail } from "./components/ProjectRail";
import { Workspace } from "./components/Workspace";
import type { Project } from "./projects";
import { browserStorage, createStore } from "./storage";
import { useProjects } from "./useProjects";
import { useStatuses } from "./useStatuses";

const store = createStore(browserStorage());

export function App() {
  const loaded = useProjects();
  if (loaded.state === "loading") return null;
  if (loaded.state === "unavailable" || loaded.projects.length === 0) return <NoProjects loaded={loaded} />;
  return <Projects projects={loaded.projects} />;
}

/** The workspace, once there is at least one project to show. */
function Projects({ projects }: { projects: readonly Project[] }) {
  const [active, setActive] = useState(() => projects.find((project) => project.id === store.get().active)?.id ?? projects[0]!.id);
  const [sidebar, setSidebar] = useState(() => store.get().sidebar);
  const { statuses, recheck } = useStatuses(projects);
  const project = projects.find((project) => project.id === active)!;

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
      <ProjectRail projects={projects} statuses={statuses} active={active} onSelect={(id) => { setActive(id); recheck(); }} />
      <Workspace key={project.id} project={project} status={statuses[project.id] ?? { state: "checking" }} store={store} sidebar={sidebar} onSidebar={setSidebar} onRetry={recheck} />
    </div>
  );
}
