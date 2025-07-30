// This file contains controller functions associated with the "Project" menu

import { AudioFileManager } from '../core/AudioFileManager';
import { Project } from '../core/Project';
import { saveProjectToSupabase, loadProjectFromSupabase } from './ProjectSave';

/**
 * Project > New
 */
export function createProject(afm: AudioFileManager, callback: (project: Project) => void) {
  /* ... */
  console.log('Creating a new project.');
  const urlString = new URL('templates/default-project.json', document.baseURI).toString();
  console.log(`Creating a new project using template ${urlString}.`);

  fetch(urlString, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  })
    .then((response) => {
      console.log(response);
      return response.json();
    })
    .then((json) => {
      const project = Project.fromJson(json);
      project.audioFiles.forEach((audioFile) => {
        afm.registerAudioFile(audioFile);
      });
      callback(project);
    });
}

/**
 * Project > Load...
 */
export async function loadProject(afm: AudioFileManager, projectId: string): Promise<Project | null> {
  console.log('Loading an existing project.');
  const project = await loadProjectFromSupabase(projectId);
  
  if (project) {
    project.audioFiles.forEach((audioFile) => {
      afm.registerAudioFile(audioFile);
    });
  }
  
  return project;
}

/**
 * Project > Save
 */
export async function saveProject(project: Project, projectId?: string) {
  console.log('Save project');
  return await saveProjectToSupabase(project, projectId);
}

/**
 * Project > Save As...
 */
export async function saveAsProject(project: Project) {
  console.log('Save As project');
  return await saveProjectToSupabase(project);
}