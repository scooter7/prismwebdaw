import { useEffect, useState } from 'react';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import { listProjects } from '../controller/Projects';
import { useAuth } from '../auth/AuthContext';
import { Loader2, Music } from 'lucide-react';

interface ProjectInfo {
  id: string;
  name: string;
  updated_at: string;
}

interface ProjectBrowserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadProject: (projectId: string) => void;
}

export const ProjectBrowserDialog = ({
  isOpen,
  onClose,
  onLoadProject,
}: ProjectBrowserDialogProps) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && user) {
      setLoading(true);
      listProjects(user)
        .then(setProjects)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen, user]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Load Project</DialogTitle>
          <DialogDescription>Select a project to load it into the editor.</DialogDescription>
        </DialogHeader>
        <div className="mt-4 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center h-24">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : projects.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">You have no saved projects.</p>
          ) : (
            <ul className="space-y-2">
              {projects.map((project) => (
                <li key={project.id}>
                  <button
                    className="w-full text-left p-3 rounded-md hover:bg-secondary transition-colors flex justify-between items-center"
                    onClick={() => {
                      onLoadProject(project.id);
                      onClose();
                    }}
                  >
                    <div className="flex items-center">
                      <Music className="h-4 w-4 mr-3 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground">{project.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Last updated: {new Date(project.updated_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};