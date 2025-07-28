// This file contains controller functions associated with the "Project" menu
import { User } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';
import { AudioFileManager } from '../core/AudioFileManager';
import { Project } from '../core/Project';

/**
 * Project > New
 */
export async function createProject(afm: AudioFileManager): Promise<Project> {
  console.log('Creating a new project.');
  const urlString = new URL('templates/default-project.json', document.baseURI).toString();
  console.log(`Creating a new project using template ${urlString}.`);

  const response = await fetch(urlString, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
  const json = await response.json();
  const project = Project.fromJson(json);
  project.audioFiles.forEach((audioFile) => {
    afm.registerAudioFile(audioFile);
  });
  return project;
}

/**
 * Project > Load...
 * Fetches a list of projects for the current user.
 */
export async function listProjects(user: User) {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error listing projects:', error);
    throw error;
  }
  return data;
}

/**
 * Loads a specific project from the database.
 */
export async function loadProject(projectId: string, afm: AudioFileManager): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, user_id, data')
    .eq('id', projectId)
    .single();

  if (error) {
    console.error('Error loading project:', error);
    throw error;
  }

  const project = Project.fromJson(data.data);
  project.id = data.id;
  project.name = data.name;
  project.userId = data.user_id;

  // Register audio files with the manager
  project.audioFiles.forEach((audioFile) => {
    afm.registerAudioFile(audioFile);
  });

  return project;
}

/**
 * Project > Save
 * Saves the project to the database. If it's a new project, it will require a name.
 */
export async function saveProject(project: Project, user: User) {
  if (!project.id) {
    throw new Error("This is a new project. Please use 'Save As' to give it a name first.");
  }

  const { data, error } = await supabase
    .from('projects')
    .update({
      name: project.name,
      data: project.toJson(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', project.id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error saving project:', error);
    throw error;
  }

  return data;
}

/**
 * Project > Save As...
 * Saves the project as a new entry in the database.
 */
export async function saveAsProject(
  project: Project,
  newName: string,
  user: User,
): Promise<Project> {
  const projectData = project.toJson();

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name: newName,
      data: projectData,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving project as:', error);
    throw error;
  }

  // Create a new project object to avoid mutating the old one, and assign the new ID/name
  const newProject = Project.fromJson(projectData);
  newProject.id = data.id;
  newProject.name = data.name;
  newProject.userId = data.user_id;

  return newProject;
}