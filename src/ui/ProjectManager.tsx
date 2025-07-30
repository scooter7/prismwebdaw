import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { getUserProjects } from '../controller/ProjectSave';
import { Project } from '../core/Project';
import { useAuth } from '../auth/AuthContext';

interface ProjectManagerProps {
  project: Project | null;
  onSaveProject: (project: Project, projectId?: string) => Promise<any>;
  onLoadProject: (projectId: string) => Promise<Project | null>;
  onProjectLoaded: (project: Project) => void;
}

export function ProjectManager({ 
  project, 
  onSaveProject, 
  onLoadProject,
  onProjectLoaded
}: ProjectManagerProps) {
  const { user, loading } = useAuth();
  const [projects, setProjects] = useState<any[]>([]);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch user's projects when component mounts or when user changes
  useEffect(() => {
    if (user && !loading) {
      fetchUserProjects();
    }
  }, [user, loading]);

  const fetchUserProjects = async () => {
    const userProjects = await getUserProjects();
    setProjects(userProjects);
  };

  const handleSave = async () => {
    if (!project) return;
    
    setIsLoading(true);
    try {
      // If we're saving an existing project, use its ID
      // Otherwise, it will be a new project
      const projectId = project.name && projects.find(p => p.name === project.name)?.id;
      await onSaveProject(project, projectId);
      await fetchUserProjects(); // Refresh the project list
      setIsSaveDialogOpen(false);
    } catch (error) {
      console.error('Error saving project:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoad = async () => {
    if (!selectedProjectId) return;
    
    setIsLoading(true);
    try {
      const loadedProject = await onLoadProject(selectedProjectId);
      if (loadedProject) {
        onProjectLoaded(loadedProject);
        setIsLoadDialogOpen(false);
      }
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (loading || !user) {
    return null;
  }

  return (
    <div className="flex space-x-2">
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              if (project) {
                setProjectName(project.name);
              }
              setIsSaveDialogOpen(true);
            }}
            disabled={!project}
          >
            Save
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Save Project</DialogTitle>
            <DialogDescription>
              Save your current project to the cloud.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="submit" 
              onClick={handleSave}
              disabled={isLoading || !projectName.trim()}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLoadDialogOpen} onOpenChange={setIsLoadDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            Load
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Load Project</DialogTitle>
            <DialogDescription>
              Select a project to load from your saved projects.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-60 overflow-y-auto">
            {projects.length === 0 ? (
              <p className="text-center text-muted-foreground">No saved projects found.</p>
            ) : (
              projects.map((proj) => (
                <div 
                  key={proj.id}
                  className={`p-3 rounded-md cursor-pointer border ${
                    selectedProjectId === proj.id 
                      ? 'bg-primary/10 border-primary' 
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => setSelectedProjectId(proj.id)}
                >
                  <div className="font-medium">{proj.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(proj.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button 
              type="submit" 
              onClick={handleLoad}
              disabled={isLoading || !selectedProjectId}
            >
              {isLoading ? 'Loading...' : 'Load Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}