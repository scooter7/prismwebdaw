import { supabase } from '../integrations/supabase/client';
import { Project } from '../core/Project';
import { useAuth } from '../auth/AuthContext';

/**
 * Save a project to Supabase
 * @param project The project to save
 * @param projectId Optional project ID for updating existing projects
 * @returns The saved project data or null if failed
 */
export async function saveProjectToSupabase(project: Project, projectId?: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('User not authenticated');
    }
    
    const projectData = {
      name: project.name,
      data: JSON.stringify(project.toJson()),
      user_id: session.user.id,
    };
    
    let result;
    
    if (projectId) {
      // Update existing project
      result = await supabase
        .from('projects')
        .update(projectData)
        .eq('id', projectId)
        .select()
        .single();
    } else {
      // Create new project
      result = await supabase
        .from('projects')
        .insert(projectData)
        .select()
        .single();
    }
    
    if (result.error) {
      throw result.error;
    }
    
    return result.data;
  } catch (error) {
    console.error('Error saving project:', error);
    return null;
  }
}

/**
 * Load a project from Supabase
 * @param projectId The ID of the project to load
 * @returns The loaded project or null if failed
 */
export async function loadProjectFromSupabase(projectId: string): Promise<Project | null> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('data')
      .eq('id', projectId)
      .single();
      
    if (error) {
      throw error;
    }
    
    if (!data) {
      return null;
    }
    
    const projectJson = JSON.parse(data.data);
    return Project.fromJson(projectJson);
  } catch (error) {
    console.error('Error loading project:', error);
    return null;
  }
}

/**
 * Get all projects for the current user
 * @returns Array of user's projects or empty array if failed
 */
export async function getUserProjects(): Promise<any[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('User not authenticated');
    }
    
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
      
    if (error) {
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching user projects:', error);
    return [];
  }
}