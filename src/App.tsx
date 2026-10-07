import { useEffect, useState } from "react";
import { NoProjects } from "./components/NoProjects";
import { ProjectRail } from "./components/ProjectRail";
import { ProjectWorkspace } from "./components/ProjectWorkspace";
import { usePreviews } from "./usePreviews";
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
  const session = usePreviews();
  const { statuses, recheck } = useStatuses(projects);
  const managed = session.state?.active;
  const railStatuses = managed ? { ...statuses, [managed.projectId]: { state: "online" as const, manifest: managed.manifest } } : statuses;
  const project = projects.find((project) => project.id === active)!;

  useEffect(() => { store.update((saved) => { saved.active = active; saved.sidebar = sidebar; }); }, [active, sidebar]);
  useEffect(() => {
    document.title = `${project.name} · Atelier`;
  }, [project.name]);
  // Positions are written a moment after each change; make sure the last one lands.
  useEffect(() => {
    const flush = () => store.flush();
    window.addEventListener("pagehide", flush);
    window.addEventListener("atelier:flush", flush);
    return () => { window.removeEventListener("pagehide", flush); window.removeEventListener("atelier:flush", flush); };
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden">
      <ProjectRail projects={projects.map(p => managed?.projectId === p.id ? { ...p, origin: managed.origin } : p)} statuses={railStatuses} active={active} onSelect={(id) => { setActive(id); recheck(); }} />
      <ProjectWorkspace session={session} key={project.id} project={project} status={statuses[project.id] ?? { state: "checking" }} store={store} sidebar={sidebar} onSidebar={setSidebar} onRetry={recheck} />
    </div>
  );
}
