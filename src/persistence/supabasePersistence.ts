import { supabase } from '../lib/supabase';
import type { Project } from '../types/project';
import type { AsyncProjectPersistence } from './projectPersistence';
import { resolveThumbnailUrl } from '../utils/thumbnailUpload';

interface ProjectDataRow {
  objects?: Project['objects'];
  steps?: Project['steps'];
}

interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  data: ProjectDataRow | null;
  thumbnail_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

async function mapProjectRowToProject(row: ProjectRow): Promise<Project> {
  const resolvedThumbnail = await resolveThumbnailUrl(row.thumbnail_url);
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    thumbnail: resolvedThumbnail,
    objects: row.data?.objects ?? [],
    steps: row.data?.steps ?? [],
  };
}

async function requireAuthenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw new Error(`Failed to resolve authenticated user: ${error.message}`);
  }

  if (!data.user) {
    throw new Error('You must be signed in to access cloud projects.');
  }

  return data.user.id;
}

export class SupabaseProjectPersistence implements AsyncProjectPersistence {
  async loadProjects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select('id, owner_id, name, thumbnail_url, created_at, updated_at, deleted_at')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to load cloud projects: ${error.message}`);
    }

    const rows = (data ?? []) as ProjectRow[];
    return Promise.all(
      rows.map((row) =>
        mapProjectRowToProject({
        ...row,
        data: null,
      })
      )
    );
  }

  async saveProjects(projects: Project[]): Promise<void> {
    for (const project of projects) {
      await this.saveProject(project);
    }
  }

  async getProject(id: string): Promise<Project | undefined> {
    const { data, error } = await supabase
      .from('projects')
      .select('id, owner_id, name, data, thumbnail_url, created_at, updated_at, deleted_at')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load cloud project: ${error.message}`);
    }

    if (!data) {
      return undefined;
    }

    return mapProjectRowToProject(data as ProjectRow);
  }

  async saveProject(project: Project): Promise<void> {
    const userId = await requireAuthenticatedUserId();
    const now = new Date().toISOString();

    const { error } = await supabase.from('projects').upsert(
      {
        id: project.id,
        owner_id: userId,
        name: project.name,
        data: {
          objects: project.objects,
          steps: project.steps,
        },
        thumbnail_url: project.thumbnail ?? null,
        created_at: project.createdAt || now,
        updated_at: now,
        deleted_at: null,
      },
      { onConflict: 'id' }
    );

    if (error) {
      throw new Error(`Failed to save cloud project: ${error.message}`);
    }
  }

  async deleteProject(id: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to delete cloud project: ${error.message}`);
    }
  }
}
